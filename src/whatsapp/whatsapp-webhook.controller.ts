import { Controller, Get, Post, Query, Req, Res, HttpCode } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';

@ApiExcludeController()
@Controller('whatsapp')
export class WhatsappWebhookController {
  constructor(
    private readonly settingsService: WhatsappSettingsService,
    private readonly metaService: WhatsappMetaService,
    private readonly orchestrator: WhatsappOrchestratorService,
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
    if (mode === 'subscribe' && token && token === cfg.verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  @Post('webhook')
  @HttpCode(200)
  async receive(@Req() req: Request) {
    const body = (req.body || {}) as Record<string, unknown>;
    const messages = this.metaService.parseWebhookPayload(body);
    for (const msg of messages) {
      try {
        await this.orchestrator.handleIncoming(msg);
      } catch (err) {
        // Meta requiere 200 aunque falle un mensaje
        console.error('[WhatsApp webhook]', err);
      }
    }
    return { ok: true };
  }
}
