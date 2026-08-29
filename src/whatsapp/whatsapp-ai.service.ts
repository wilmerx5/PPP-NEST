import { Injectable, Logger } from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import type { AiTurnResult } from './types/whatsapp-session.types';
import { WHATSAPP_AI_JSON_SCHEMA } from './whatsapp-business-rules';
import {
  parseClassifyResult,
  type WhatsappClassifyResult,
} from './whatsapp-message-classify';

export type WhatsappImageAnalysis = {
  kind: 'order' | 'payment_proof' | 'other' | 'unclear';
  /** Texto como si el cliente lo hubiera escrito (pedido, dirección, etc.) */
  textForBot: string;
  /** Texto visible leído en la imagen (OCR) */
  visibleText?: string;
  /** Respuesta corta si no se puede seguir el flujo de pedido */
  reply?: string;
};

@Injectable()
export class WhatsappAiService {
  private readonly logger = new Logger(WhatsappAiService.name);

  constructor(private readonly settingsService: WhatsappSettingsService) {}

  /**
   * Clasificador barato (sin menú completo): intención + typos + dirección.
   * El orquestador valida y ejecuta; esto NO agrega productos.
   */
  async classifyMessage(input: {
    userMessage: string;
    cartLength: number;
    recentMessages?: string[];
  }): Promise<WhatsappClassifyResult | null> {
    const cfg = await this.settingsService.getEffectiveConfig();
    if (!cfg.openaiApiKey) return null;

    const system = `Eres clasificador de mensajes WhatsApp de un restaurante (Bogotá).
NO tomas pedidos ni inventas platos. Solo clasifica el ÚLTIMO mensaje del cliente.

Intents:
- delivery_setup: quiere DOMICILIO (entrega) y/o da dirección, SIN pedir plato concreto. Ej: "para un domickio para Bosques de Castilla", "quiero un domicilio".
- address: solo dirección / conjunto / torre-apto (sin "quiero X plato").
- order: pide comida/bebida (aunque también traiga dirección).
- question: precio, menú, cobertura, puntos, horarios.
- chitchat: saludo/gracias/charla.
- other: resto.

Corrige typos obvios en normalizedText (domickio/domicikio→domicilio, castlla→castilla).
Si hay dirección (Bosques de Castilla, Tabaku, Calle…), llénala en address.
hasFoodItems=true solo si nombra comida/bebida.

Responde SOLO JSON:
{
  "intent": "delivery_setup"|"address"|"order"|"question"|"chitchat"|"other",
  "normalizedText": "texto corregido",
  "address": "dirección o null",
  "hasFoodItems": false,
  "confidence": 0.0
}`;

    const history = this.toChatMessages(input.recentMessages || []).slice(-4);
    const model = cfg.openaiModel || 'gpt-4o-mini';
    const body: Record<string, unknown> = {
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        ...history,
        {
          role: 'user',
          content: `cartLength=${input.cartLength}\nmensaje: ${input.userMessage}`,
        },
      ],
      max_tokens: 220,
    };
    if (!/^gpt-5/i.test(model)) {
      body.temperature = 0;
    }

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`classifyMessage OpenAI ${res.status}: ${err.slice(0, 200)}`);
        return null;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content || '{}';
      return parseClassifyResult(JSON.parse(content), input.userMessage);
    } catch (err) {
      this.logger.warn(`classifyMessage failed: ${err}`);
      return null;
    }
  }

  async generateTurn(input: {
    userMessage: string;
    businessRulesBlock: string;
    menuDetailedText: string;
    sessionSummary: string;
    recentMessages: string[];
    customerHint: string;
    /** Más natural al responder dudas (no flujo estricto de pedido) */
    conversational?: boolean;
    /** Clasificación previa: pedido / nota / duda / etc. */
    detectedIntent?: string;
  }): Promise<AiTurnResult> {
    const cfg = await this.settingsService.getEffectiveConfig();
    if (!cfg.openaiApiKey) {
      return {
        reply:
          'El asistente aún no está configurado. Escribe *humano* para hablar con el restaurante.',
        actions: { requestHuman: true },
      };
    }

    const intentLine = input.detectedIntent
      ? `\nIntención detectada por el sistema: ${input.detectedIntent}. Respeta las restricciones de esa intención en customerHint.`
      : '';

    const system = `${cfg.systemPrompt}

${input.businessRulesBlock}

${input.customerHint}
${intentLine}

Resumen de sesión (fuente de verdad del carrito y elecciones pendientes):
${input.sessionSummary}

Menú autorizado (SOLO estos productos; ids y precios exactos):
${input.menuDetailedText}

Estilo: tutea, sé cálido y atento como un colombiano del local (sin empalagar). Responde primero la duda del cliente; no te portes como un menú rígido.
Si exploran qué pedir: orienta por categorías y ejemplos breves; no enumeres todo el catálogo con códigos.

${WHATSAPP_AI_JSON_SCHEMA}`;

    const history = this.toChatMessages(input.recentMessages).slice(-12);
    const messages = [
      { role: 'system' as const, content: system },
      ...history,
      { role: 'user' as const, content: input.userMessage },
    ];

    try {
      const model = cfg.openaiModel || 'gpt-4o-mini';
      const body: Record<string, unknown> = {
        model,
        response_format: { type: 'json_object' },
        messages,
      };
      // gpt-5* suele rechazar temperature personalizada
      if (!/^gpt-5/i.test(model)) {
        body.temperature = input.conversational
          ? Math.min(1.2, (cfg.aiTemperature ?? 0.2) + 0.25)
          : cfg.aiTemperature ?? 0.2;
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
    /** Segundo intento enfocado solo en leer texto/código */
    ocrRetry?: boolean;
  }): Promise<WhatsappImageAnalysis> {
    const cfg = await this.settingsService.getEffectiveConfig();
    if (!cfg.openaiApiKey) {
      return {
        kind: 'unclear',
        textForBot: '',
        reply: this.imageFallbackReply(),
      };
    }

    const b64 = input.buffer.toString('base64');
    const dataUrl = `data:${input.mimeType || 'image/jpeg'};base64,${b64}`;
    const caption = (input.caption || '').trim();

    const system = input.ocrRetry
      ? `Lee TODO el texto visible en la imagen (OCR). Restaurante WhatsApp. Responde SOLO JSON:
{
  "kind": "order" | "payment_proof" | "other" | "unclear",
  "visibleText": "texto que ves (códigos, nombres, precios)",
  "textForBot": "pedido en lenguaje natural si hay producto/código",
  "reply": "opcional"
}
Si hay un CÓDIGO numérico y nombre de plato → kind=order y textForBot debe incluir el código (ej. "código 28 medio pollo").
Menú referencia:\n${input.menuSummary.slice(0, 4000)}`
      : `Eres el asistente de un restaurante de pollo asado (WhatsApp).
Analizas UNA imagen del cliente. Responde SOLO JSON:
{
  "kind": "order" | "payment_proof" | "other" | "unclear",
  "visibleText": "todo el texto legible en la imagen",
  "textForBot": "string",
  "reply": "string opcional"
}

Reglas:
- payment_proof: comprobante de transferencia, captura de banco, Nequi, Daviplata, QR pagado, recibo.
  textForBot vacío; reply breve confirmando recepción.
- order: pide comida, foto de carta/menú, pantalla con plato, captura con CÓDIGO y nombre visibles.
  visibleText = transcribe título, código, precio si se ven.
  textForBot = lo que el cliente querría escribir ("código 28", "28", "medio pollo frito", nombre del plato).
  Si ves un número de código claro (ej. cód. 12, #28, código 5) → SIEMPRE kind=order e inclúyelo en textForBot.
  Si la imagen muestra UN producto del menú con título legible → kind=order (NO unclear).
- other / unclear: solo si no hay texto de menú ni comprobante legible.
- No inventes productos fuera del menú.
Menú (referencia):
${input.menuSummary.slice(0, 6000)}`;

    const userText = caption
      ? `Pie de foto del cliente: "${caption}". ${input.ocrRetry ? 'Transcribe y detecta pedido.' : 'Analiza la imagen.'}`
      : input.ocrRetry
        ? 'Transcribe el texto visible y detecta si es un pedido (código o nombre de plato).'
        : 'Analiza la imagen del cliente.';

    try {
      const model = cfg.openaiModel || 'gpt-4o-mini';
      const body: Record<string, unknown> = {
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: input.ocrRetry ? 'high' : 'high' },
              },
            ],
          },
        ],
      };
      if (/^gpt-5/i.test(model)) {
        body.max_completion_tokens = 700;
      } else {
        body.temperature = 0.1;
        body.max_tokens = 700;
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Vision error ${res.status}: ${err}`);
        return {
          kind: 'unclear',
          textForBot: '',
          reply: this.imageFallbackReply(),
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
          visibleText: parsed.visibleText?.trim(),
          reply: this.imageFallbackReply(),
        };
      }
      return {
        kind,
        textForBot: (parsed.textForBot || '').trim().slice(0, 500),
        visibleText: (parsed.visibleText || '').trim().slice(0, 800),
        reply: parsed.reply?.trim().slice(0, 800),
      };
    } catch (err) {
      this.logger.error(`Vision failed: ${err}`);
      return {
        kind: 'unclear',
        textForBot: '',
        reply: this.imageFallbackReply(),
      };
    }
  }

  /** Mensaje amable cuando la imagen no se pudo usar para pedir. */
  imageFallbackReply(): string {
    return (
      'Vi tu imagen 👀 pero no pude leer bien el plato o el código.\n\n' +
      '¿Me lo escribes por texto (nombre o código)?\n\n' +
      'Si prefieres, escribe *asesor* o *humano* y una persona te atiende por aquí 😊'
    );
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
