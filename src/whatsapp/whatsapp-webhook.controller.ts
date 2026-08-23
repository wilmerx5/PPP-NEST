import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Headers,
  Logger,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappRateLimitService } from './whatsapp-rate-limit.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { verifyWhatsappMetaSignature } from './whatsapp-meta-signature';

@ApiExcludeController()
@Controller('whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly settingsService: WhatsappSettingsService,
    private readonly metaService: WhatsappMetaService,
    private readonly orchestrator: WhatsappOrchestratorService,
    private readonly rateLimit: WhatsappRateLimitService,
    private readonly conversationService: WhatsappConversationService,
  ) {}

  /** Verificación webhook Meta (GET). */
  @Get('webhook')
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const cfg = await this.settingsService.getEffectiveConfig();
    const expected = (cfg.verifyToken || '').trim();
    const received = (token || '').trim();

    if (mode === 'subscribe' && received && expected && received === expected) {
      this.logger.log('Webhook Meta verificado correctamente');
      return res.status(200).type('text/plain').send(challenge);
    }

    if (!expected) {
      this.logger.warn(
        'Webhook verify falló: no hay verify token en servidor. Guárdalo en Admin → WhatsApp IA o env WHATSAPP_VERIFY_TOKEN.',
      );
    } else {
      this.logger.warn('Webhook verify falló: token recibido no coincide con el configurado en PPP.');
    }

    return res.status(403).type('text/plain').send('Forbidden');
  }

  @Post('webhook')
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Res() res: Response,
  ) {
    const cfg = await this.settingsService.getEffectiveConfig();
    const appSecret = (cfg.appSecret || '').trim();

    if (appSecret) {
      const raw = req.rawBody;
      if (!raw || !Buffer.isBuffer(raw)) {
        this.logger.warn('Webhook rechazado: falta rawBody para verificar firma Meta');
        return res.status(401).json({ ok: false, error: 'raw_body_missing' });
      }
      if (!verifyWhatsappMetaSignature(raw, signature, appSecret)) {
        this.logger.warn('Webhook rechazado: firma X-Hub-Signature-256 inválida');
        return res.status(401).json({ ok: false, error: 'invalid_signature' });
      }
    } else {
      this.logger.warn(
        'WhatsApp App Secret no configurado — webhook sin verificación de firma. Configúralo en Admin.',
      );
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const messages = this.metaService.parseWebhookPayload(body);
    const limit = Math.max(1, Number(cfg.rateLimitPerMinute) || 25);

    for (const msg of messages) {
      try {
        if (msg.messageId) {
          const dup = await this.conversationService.findByWaMessageId(msg.messageId);
          if (dup) {
            this.logger.debug(`Skip duplicate waMessageId=${msg.messageId}`);
            continue;
          }
        }

        if (!this.rateLimit.allow(msg.waId || msg.phoneE164, limit)) {
          try {
            await this.metaService.sendText(
              msg.waId,
              'Estás enviando muchos mensajes seguidos 🙏 Espera un momento e intenta de nuevo.',
            );
          } catch {
            // ignore send failure on throttle
          }
          continue;
        }

        await this.orchestrator.handleIncoming(msg);
      } catch (err) {
        // Meta requiere 200 aunque falle un mensaje
        this.logger.error('[WhatsApp webhook] message error', err);
      }
    }
    return res.status(200).json({ ok: true });
  }
}
