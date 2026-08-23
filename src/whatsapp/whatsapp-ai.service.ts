import { Injectable, Logger } from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import type { AiTurnResult } from './types/whatsapp-session.types';
import { WHATSAPP_AI_JSON_SCHEMA } from './whatsapp-business-rules';

export type WhatsappImageAnalysis = {
  kind: 'order' | 'payment_proof' | 'other' | 'unclear';
  /** Texto como si el cliente lo hubiera escrito (pedido, dirección, etc.) */
  textForBot: string;
  /** Respuesta corta si no se puede seguir el flujo de pedido */
  reply?: string;
};

@Injectable()
export class WhatsappAiService {
  private readonly logger = new Logger(WhatsappAiService.name);

  constructor(private readonly settingsService: WhatsappSettingsService) {}

  async generateTurn(input: {
    userMessage: string;
    businessRulesBlock: string;
    menuDetailedText: string;
    sessionSummary: string;
    recentMessages: string[];
    customerHint: string;
    /** Más natural al responder dudas (no flujo estricto de pedido) */
    conversational?: boolean;
  }): Promise<AiTurnResult> {
    const cfg = await this.settingsService.getEffectiveConfig();
    if (!cfg.openaiApiKey) {
      return {
        reply:
          'El asistente aún no está configurado. Escribe *humano* para hablar con el restaurante.',
        actions: { requestHuman: true },
      };
    }

    const system = `${cfg.systemPrompt}

${input.businessRulesBlock}

${input.customerHint}

Resumen de sesión (fuente de verdad del carrito y elecciones pendientes):
${input.sessionSummary}

Menú autorizado (SOLO estos productos; ids y precios exactos):
${input.menuDetailedText}

Estilo: tutea, sé cálido y atento como un colombiano del local (sin empalagar). Responde primero la duda del cliente; no te portes como un menú rígido.

${WHATSAPP_AI_JSON_SCHEMA}`;

    const history = this.toChatMessages(input.recentMessages).slice(-12);
    const messages = [
      { role: 'system' as const, content: system },
      ...history,
      { role: 'user' as const, content: input.userMessage },
    ];

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: cfg.openaiModel || 'gpt-4o-mini',
          temperature: input.conversational
            ? Math.min(1.2, (cfg.aiTemperature ?? 0.2) + 0.25)
            : cfg.aiTemperature ?? 0.2,
          response_format: { type: 'json_object' },
          messages,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`OpenAI error ${res.status}: ${err}`);
        return {
          reply: 'Tuve un problema técnico. Escribe *humano* para hablar con el restaurante.',
        };
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as AiTurnResult;

      if (!parsed.reply || typeof parsed.reply !== 'string') {
        return {
          reply:
            'Puedes pedir por *código* o *nombre* del producto. Ejemplo: "28" o "medio pollo". Escribe *humano* si necesitas ayuda.',
        };
      }

      parsed.reply = parsed.reply.trim().slice(0, 3500);
      if (parsed.actions?.requestConfirm) {
        delete parsed.actions.requestConfirm;
      }

      return parsed;
    } catch (err) {
      this.logger.error(`OpenAI call failed: ${err}`);
      return {
        reply: 'No pude procesar tu mensaje. Intenta con el código o nombre del producto, o escribe *humano*.',
      };
    }
  }

  /** Whisper: nota de voz / audio → texto en español. */
  async transcribeAudio(buffer: Buffer, mimeType: string): Promise<string | null> {
    const cfg = await this.settingsService.getEffectiveConfig();
    if (!cfg.openaiApiKey) return null;

    const ext = this.audioExtension(mimeType);
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: mimeType || 'audio/ogg' }),
      `audio.${ext}`,
    );
    form.append('model', 'whisper-1');
    form.append('language', 'es');

    try {
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.openaiApiKey}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Whisper error ${res.status}: ${err}`);
        return null;
      }
      const data = (await res.json()) as { text?: string };
      const text = (data.text || '').trim();
      return text || null;
    } catch (err) {
      this.logger.error(`Whisper failed: ${err}`);
      return null;
    }
  }

  /**
   * Vision: clasifica imagen (pedido vs comprobante vs otra) y extrae texto útil.
   * Usa el mismo modelo configurado (4o-mini / 4.1-mini soportan imagen).
   */
  async analyzeOrderImage(input: {
    buffer: Buffer;
    mimeType: string;
    caption?: string;
    menuSummary: string;
  }): Promise<WhatsappImageAnalysis> {
    const cfg = await this.settingsService.getEffectiveConfig();
    if (!cfg.openaiApiKey) {
      return {
        kind: 'unclear',
        textForBot: '',
        reply: 'No pude ver la imagen. Escríbenos el pedido por texto o *humano*.',
      };
    }

    const b64 = input.buffer.toString('base64');
    const dataUrl = `data:${input.mimeType || 'image/jpeg'};base64,${b64}`;
    const caption = (input.caption || '').trim();

    const system = `Eres el asistente de un restaurante de pollo asado (WhatsApp).
Analizas UNA imagen del cliente. Responde SOLO JSON:
{
  "kind": "order" | "payment_proof" | "other" | "unclear",
  "textForBot": "string",
  "reply": "string opcional"
}

Reglas:
- payment_proof: comprobante de transferencia, captura de banco, Nequi, Daviplata, QR pagado, recibo.
  textForBot vacío; reply breve confirmando que lo recibiste y que un asesor lo revisa (menciona escribir humano si necesita).
- order: la imagen pide comida / muestra menú marcado / lista de productos. textForBot = lo que el cliente querría escribir
  (códigos o nombres del menú si se ven). Usa SOLO productos del menú si aparecen claros.
- other / unclear: no sirve para pedir. textForBot vacío; reply amable pidiendo texto (código o nombre) o *humano*.
- No inventes productos fuera del menú.
Menú (referencia):
${input.menuSummary.slice(0, 6000)}`;

    const userText = caption
      ? `El cliente escribió este pie de foto: "${caption}". Analiza la imagen.`
      : 'Analiza la imagen del cliente.';

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: cfg.openaiModel || 'gpt-4o-mini',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          max_tokens: 500,
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: [
                { type: 'text', text: userText },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Vision error ${res.status}: ${err}`);
        return {
          kind: 'unclear',
          textForBot: '',
          reply: 'No pude leer bien la imagen. ¿Me escribes el pedido por texto o *humano*?',
        };
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const parsed = JSON.parse(
        data.choices?.[0]?.message?.content || '{}',
      ) as Partial<WhatsappImageAnalysis>;
      const kind = parsed.kind;
      if (kind !== 'order' && kind !== 'payment_proof' && kind !== 'other' && kind !== 'unclear') {
        return {
          kind: 'unclear',
          textForBot: '',
          reply: 'No entendí la imagen. Escríbenos el pedido (código o nombre) o *humano*.',
        };
      }
      return {
        kind,
        textForBot: (parsed.textForBot || '').trim().slice(0, 500),
        reply: parsed.reply?.trim().slice(0, 800),
      };
    } catch (err) {
      this.logger.error(`Vision failed: ${err}`);
      return {
        kind: 'unclear',
        textForBot: '',
        reply: 'Tuve un problema viendo la imagen. Prueba por texto o escribe *humano*.',
      };
    }
  }

  private audioExtension(mimeType: string): string {
    const m = (mimeType || '').toLowerCase();
    if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
    if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
    if (m.includes('wav')) return 'wav';
    if (m.includes('webm')) return 'webm';
    return 'ogg';
  }

  /** Convierte "Cliente: …" / "Bot: …" a roles reales de chat. */
  private toChatMessages(
    recent: string[],
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const line of recent) {
      const trimmed = (line || '').trim();
      if (!trimmed) continue;
      if (/^Cliente:\s*/i.test(trimmed)) {
        out.push({ role: 'user', content: trimmed.replace(/^Cliente:\s*/i, '').trim() });
      } else if (/^Bot:\s*/i.test(trimmed)) {
        out.push({ role: 'assistant', content: trimmed.replace(/^Bot:\s*/i, '').trim() });
      } else {
        out.push({ role: 'user', content: trimmed });
      }
    }
    return out.filter((m) => m.content.length > 0);
  }
}
