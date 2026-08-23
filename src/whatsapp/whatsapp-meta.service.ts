import { Injectable, Logger } from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';

const GRAPH_VERSION = 'v21.0';

export type IncomingWhatsappText = {
  waId: string;
  phoneE164: string;
  messageId: string;
  text: string;
  timestamp: number;
  raw: Record<string, unknown>;
};

@Injectable()
export class WhatsappMetaService {
  private readonly logger = new Logger(WhatsappMetaService.name);

  constructor(private readonly settingsService: WhatsappSettingsService) {}

  parseWebhookPayload(body: Record<string, unknown>): IncomingWhatsappText[] {
    const out: IncomingWhatsappText[] = [];
    if (body.object !== 'whatsapp_business_account') return out;

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray((entry as any).changes) ? (entry as any).changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value?.messages) continue;
        const messages = Array.isArray(value.messages) ? value.messages : [];
        for (const msg of messages) {
          if (msg.type !== 'text' || !msg.text?.body) continue;
          const from = String(msg.from || '');
          out.push({
            waId: from,
            phoneE164: this.normalizePhone(from),
            messageId: String(msg.id || ''),
            text: String(msg.text.body).trim(),
            timestamp: Number(msg.timestamp || 0),
            raw: msg,
          });
        }
      }
    }
    return out;
  }

  normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('57') && digits.length >= 12) return `+${digits}`;
    if (digits.length === 10) return `+57${digits}`;
    return digits ? `+${digits}` : raw;
  }

  async sendText(toWaId: string, body: string): Promise<void> {
    const cfg = await this.settingsService.getEffectiveConfig();
    if (!cfg.accessToken || !cfg.phoneNumberId) {
      this.logger.warn('WhatsApp no configurado — no se envía mensaje');
      return;
    }

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toWaId.replace(/\D/g, ''),
        type: 'text',
        text: { preview_url: false, body: body.slice(0, 4096) },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Meta send failed (${res.status}): ${errText}`);
      throw new Error(`WhatsApp send failed: ${res.status}`);
    }
  }
}
