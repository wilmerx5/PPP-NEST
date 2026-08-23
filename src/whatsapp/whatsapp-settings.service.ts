import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WhatsappSettings } from './entities/whatsapp-settings.entity';
import { UpdateWhatsappSettingsDto } from './dto/whatsapp.dto';

const DEFAULT_SYSTEM_PROMPT = `Eres el asistente de pedidos de Pronto Pollo Portal por WhatsApp.
Tu rol es conversacional: guiar al cliente dentro de las REGLAS OBLIGATORIAS que recibes en cada mensaje.
El sistema (no tú) valida menú, precios, horarios y creación del pedido.
- Español colombiano, breve y amable.
- Nunca inventes productos, precios, promociones ni tiempos de entrega.
- Si el restaurante está CERRADO, solo informa; no uses addItems ni confirmes pedidos.
- Para confirmar pedido el cliente debe escribir la palabra confirmar (tú no confirmas).
- Si no sabes qué producto es, pide código o nombre exacto del menú.
- Temas fuera del pedido: redirige al pedido o sugiere escribir humano.`;

const DEFAULT_WELCOME =
  '¡Hola! 👋 Soy el asistente de Pronto Pollo Portal. Puedes pedir por nombre o código del producto. ¿Qué te gustaría ordenar hoy?';

@Injectable()
export class WhatsappSettingsService {
  constructor(
    @InjectRepository(WhatsappSettings)
    private readonly settingsRepo: Repository<WhatsappSettings>,
    private readonly config: ConfigService,
  ) {}

  async getSettings(): Promise<WhatsappSettings> {
    let row = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!row) {
      row = this.settingsRepo.create({ id: 1 });
      row = await this.settingsRepo.save(row);
    }
    return row;
  }

  /** Config efectiva: DB + fallback env (útil en dev). */
  async getEffectiveConfig() {
    const row = await this.getSettings();
    const envEnabled = (this.config.get<string>('WHATSAPP_ENABLED') || '')
      .trim()
      .toLowerCase();
    const enabledFromEnv =
      envEnabled === 'true' || envEnabled === '1' || envEnabled === 'yes';
    return {
      ...row,
      // DB gana si enabled=true; si DB está off, permite activar con WHATSAPP_ENABLED
      enabled: !!row.enabled || enabledFromEnv,
      accessToken:
        (row.accessToken || '').trim() ||
        (this.config.get<string>('WHATSAPP_ACCESS_TOKEN') || '').trim() ||
        null,
      phoneNumberId:
        (row.phoneNumberId || '').trim() ||
        (this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '').trim() ||
        null,
      verifyToken:
        (row.verifyToken || '').trim() ||
        (this.config.get<string>('WHATSAPP_VERIFY_TOKEN') || '').trim() ||
        null,
      openaiApiKey:
        (row.openaiApiKey || '').trim() ||
        (this.config.get<string>('OPENAI_API_KEY') || '').trim() ||
        null,
      openaiModel: row.openaiModel || 'gpt-4o-mini',
      systemPrompt: row.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
      welcomeMessage: row.welcomeMessage?.trim() || DEFAULT_WELCOME,
      /**
       * Temporal (pruebas): por defecto ignora horario en WhatsApp.
       * Para volver a respetar horario: WHATSAPP_IGNORE_BUSINESS_HOURS=false
       */
      ignoreBusinessHours: (() => {
        const raw = (this.config.get<string>('WHATSAPP_IGNORE_BUSINESS_HOURS') ?? 'true')
          .trim()
          .toLowerCase();
        return raw !== 'false' && raw !== '0' && raw !== 'no';
      })(),
    };
  }

  async updateSettings(dto: UpdateWhatsappSettingsDto): Promise<WhatsappSettings> {
    const row = await this.getSettings();
    Object.assign(row, {
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      ...(dto.displayPhone !== undefined && { displayPhone: dto.displayPhone || null }),
      ...(dto.phoneNumberId !== undefined && { phoneNumberId: dto.phoneNumberId || null }),
      ...(dto.wabaId !== undefined && { wabaId: dto.wabaId || null }),
      ...(dto.accessToken !== undefined && { accessToken: dto.accessToken || null }),
      ...(dto.verifyToken !== undefined && { verifyToken: dto.verifyToken || null }),
      ...(dto.openaiApiKey !== undefined && { openaiApiKey: dto.openaiApiKey || null }),
      ...(dto.openaiModel !== undefined && { openaiModel: dto.openaiModel || 'gpt-4o-mini' }),
      ...(dto.systemPrompt !== undefined && { systemPrompt: dto.systemPrompt || null }),
      ...(dto.defaultDeliveryFee !== undefined && { defaultDeliveryFee: dto.defaultDeliveryFee }),
      ...(dto.allowMercadoPago !== undefined && { allowMercadoPago: dto.allowMercadoPago }),
      ...(dto.welcomeMessage !== undefined && { welcomeMessage: dto.welcomeMessage || null }),
    });
    return this.settingsRepo.save(row);
  }

  /** Respuesta admin sin exponer tokens completos. */
  maskSettings(row: WhatsappSettings) {
    const mask = (v: string | null | undefined) => {
      const s = (v || '').trim();
      if (!s) return null;
      if (s.length <= 8) return '••••••••';
      return `${s.slice(0, 4)}…${s.slice(-4)}`;
    };
    return {
      id: row.id,
      enabled: !!row.enabled,
      displayPhone: row.displayPhone,
      phoneNumberId: row.phoneNumberId,
      wabaId: row.wabaId,
      accessTokenSet: !!(row.accessToken || '').trim(),
      accessTokenPreview: mask(row.accessToken),
      verifyTokenSet: !!(row.verifyToken || '').trim(),
      verifyTokenPreview: mask(row.verifyToken),
      openaiApiKeySet: !!(row.openaiApiKey || '').trim(),
      openaiApiKeyPreview: mask(row.openaiApiKey),
      openaiModel: row.openaiModel,
      systemPrompt: row.systemPrompt,
      defaultDeliveryFee: row.defaultDeliveryFee,
      allowMercadoPago: !!row.allowMercadoPago,
      welcomeMessage: row.welcomeMessage,
      updatedAt: row.updatedAt,
      webhookUrlHint: '/api/whatsapp/webhook',
    };
  }
}
