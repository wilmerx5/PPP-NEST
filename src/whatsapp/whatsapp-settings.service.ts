import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WhatsappSettings } from './entities/whatsapp-settings.entity';
import { UpdateWhatsappSettingsDto } from './dto/whatsapp.dto';

const DEFAULT_WELCOME =
  '¡Hola! 👋 Bienvenido a Pronto Pollo. Dime qué se te antoja y te ayudo con el pedido.';

const TONE_GUIDE = `
TONO (obligatorio en cada reply):
- Tutéa siempre (tú / te / tu), como un colombiano amable del día a día.
- Cálido y atento, pero natural: sin “mi amor”, “corazón”, “precioso” ni exceso de emojis.
- Corto y claro. Usa expresiones suaves tipo “dale”, “listo”, “perfecto”, “con gusto”, “cuando quieras”.
- Suena a persona del local, no a robot ni a publicidad.
`.trim();

const DEFAULT_SYSTEM_PROMPT = `Eres quien atiende pedidos de Pronto Pollo Portal por WhatsApp.
Hablas como un mesero colombiano: cercano, claro y servicial.

${TONE_GUIDE}

Tu rol es conversacional: guiar al cliente dentro de las REGLAS OBLIGATORIAS que recibes en cada mensaje.
El sistema (no tú) valida menú, precios, carrito, horarios y creación del pedido.
- Si el cliente pregunta algo (qué incluye, diferencias, tiempos, etc.), responde primero esa duda.
- Si hay una elección de opciones pendiente, recuérdala en una frase corta al final; no reenvíes toda la lista cada vez.
- NUNCA vacíes el carrito ni inventes que está vacío.
- NUNCA pidas otro producto cuando el cliente ya está dando nombre, dirección o pago.
- Nombre: solo nombre de persona. Dirección: calle/carrera/barrio/referencia. Si dice que pasa/recoge → pickup.
- Nunca inventes productos, precios, promociones ni tiempos de entrega exactos.
- Si el restaurante está CERRADO, solo informa; no uses addItems ni confirmes pedidos.
- Para confirmar, el cliente debe escribir *confirmar* (tú no confirmas).
- Temas fuera del pedido: redirige con amabilidad o sugiere escribir *humano*.`;

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
      row = this.settingsRepo.create({ id: 1, defaultDeliveryFee: 2000 });
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
    const fee = Number(row.defaultDeliveryFee);
    return {
      ...row,
      // Domicilio por defecto: $2.000 si no está configurado
      defaultDeliveryFee: Number.isFinite(fee) && fee > 0 ? fee : 2000,
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
      systemPrompt: `${TONE_GUIDE}\n\n${row.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT}`,
      welcomeMessage: row.welcomeMessage?.trim() || DEFAULT_WELCOME,
      menuUrl: (
        (this.config.get<string>('WHATSAPP_MENU_URL') || '').trim() ||
        `${(this.config.get<string>('FRONTEND_URL') || 'https://prontopolloportal.com').replace(/\/$/, '')}/menu`
      ),
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
      defaultDeliveryFee: Number(row.defaultDeliveryFee) > 0 ? Number(row.defaultDeliveryFee) : 2000,
      allowMercadoPago: !!row.allowMercadoPago,
      welcomeMessage: row.welcomeMessage,
      updatedAt: row.updatedAt,
      webhookUrlHint: '/api/whatsapp/webhook',
    };
  }
}
