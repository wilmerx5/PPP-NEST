import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';

const GRAPH_VERSION = 'v21.0';

export type IncomingWhatsappMessageType =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'other';

export type IncomingWhatsappMessage = {
  waId: string;
  phoneE164: string;
  messageId: string;
  messageType: IncomingWhatsappMessageType;
  /** Texto o caption; para media sin caption, etiqueta corta. */
  text: string;
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  timestamp: number;
  raw: Record<string, unknown>;
};

/** @deprecated usar IncomingWhatsappMessage */
export type IncomingWhatsappText = IncomingWhatsappMessage;

@Injectable()
export class WhatsappMetaService {
  private readonly logger = new Logger(WhatsappMetaService.name);

  constructor(private readonly settingsService: WhatsappSettingsService) {}

  parseWebhookPayload(body: Record<string, unknown>): IncomingWhatsappMessage[] {
    const out: IncomingWhatsappMessage[] = [];
    if (body.object !== 'whatsapp_business_account') return out;

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray((entry as any).changes) ? (entry as any).changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value?.messages) continue;
        const messages = Array.isArray(value.messages) ? value.messages : [];
        for (const msg of messages) {
          const parsed = this.parseOneMessage(msg);
          if (parsed) out.push(parsed);
        }
      }
    }
    return out;
  }

  private parseOneMessage(msg: any): IncomingWhatsappMessage | null {
    const from = String(msg.from || '');
    if (!from) return null;
    const base = {
      waId: from,
      phoneE164: this.normalizePhone(from),
      messageId: String(msg.id || ''),
      timestamp: Number(msg.timestamp || 0),
      raw: msg as Record<string, unknown>,
    };

    const type = String(msg.type || '');

    if (type === 'text' && msg.text?.body) {
      return {
        ...base,
        messageType: 'text',
        text: String(msg.text.body).trim(),
      };
    }

    if (type === 'audio' && msg.audio?.id) {
      return {
        ...base,
        messageType: 'audio',
        text: msg.audio.voice ? '🎤 Nota de voz' : '🎵 Audio',
        mediaId: String(msg.audio.id),
        mimeType: msg.audio.mime_type ? String(msg.audio.mime_type) : 'audio/ogg',
      };
    }

    if (type === 'image' && msg.image?.id) {
      const caption = msg.image.caption ? String(msg.image.caption).trim() : '';
      return {
        ...base,
        messageType: 'image',
        text: caption || '🖼️ Imagen',
        mediaId: String(msg.image.id),
        mimeType: msg.image.mime_type ? String(msg.image.mime_type) : 'image/jpeg',
      };
    }

    if (type === 'video' && msg.video?.id) {
      const caption = msg.video.caption ? String(msg.video.caption).trim() : '';
      return {
        ...base,
        messageType: 'video',
        text: caption || '🎬 Video',
        mediaId: String(msg.video.id),
        mimeType: msg.video.mime_type ? String(msg.video.mime_type) : 'video/mp4',
      };
    }

    if (type === 'document' && msg.document?.id) {
      const name = msg.document.filename ? String(msg.document.filename) : 'Documento';
      const caption = msg.document.caption ? String(msg.document.caption).trim() : '';
      return {
        ...base,
        messageType: 'document',
        text: caption || `📄 ${name}`,
        mediaId: String(msg.document.id),
        mimeType: msg.document.mime_type ? String(msg.document.mime_type) : 'application/octet-stream',
        filename: name,
      };
    }

    if (type === 'sticker' && msg.sticker?.id) {
      return {
        ...base,
        messageType: 'sticker',
        text: 'Sticker',
        mediaId: String(msg.sticker.id),
        mimeType: msg.sticker.mime_type ? String(msg.sticker.mime_type) : 'image/webp',
      };
    }

    if (type === 'location' && msg.location) {
      const lat = msg.location.latitude;
      const lng = msg.location.longitude;
      const name = msg.location.name ? String(msg.location.name) : '';
      const address = msg.location.address ? String(msg.location.address) : '';
      const label = [name, address].filter(Boolean).join(' — ') || `${lat}, ${lng}`;
      return {
        ...base,
        messageType: 'location',
        text: `📍 ${label}`,
      };
    }

    // Tipos no soportados: registrar para que el inbox no “pierda” el mensaje
    if (type && type !== 'text') {
      return {
        ...base,
        messageType: 'other',
        text: `Mensaje (${type})`,
      };
    }

    return null;
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

  /** Descarga binario de media de Meta (audio/imagen/…). */
  async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const cfg = await this.settingsService.getEffectiveConfig();
    if (!cfg.accessToken) {
      throw new NotFoundException('WhatsApp no configurado');
    }

    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${cfg.accessToken}` },
    });
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      this.logger.error(`Meta media meta failed (${metaRes.status}): ${errText}`);
      throw new NotFoundException('Media no disponible (¿expiró en Meta?)');
    }

    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) throw new NotFoundException('Media sin URL');

    const binRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${cfg.accessToken}` },
    });
    if (!binRes.ok) {
      throw new NotFoundException('No se pudo descargar el media');
    }

    const arr = await binRes.arrayBuffer();
    return {
      buffer: Buffer.from(arr),
      mimeType: meta.mime_type || 'application/octet-stream',
    };
  }
}
