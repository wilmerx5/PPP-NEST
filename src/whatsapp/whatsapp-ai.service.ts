import { Injectable, Logger } from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import type { AiTurnResult } from './types/whatsapp-session.types';
import { WHATSAPP_AI_JSON_SCHEMA } from './whatsapp-business-rules';

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

Resumen de sesión (fuente de verdad del carrito):
${input.sessionSummary}

Menú autorizado (SOLO estos productos; ids y precios exactos):
${input.menuDetailedText}

${WHATSAPP_AI_JSON_SCHEMA}`;

    const messages = [
      { role: 'system' as const, content: system },
      ...input.recentMessages.slice(-6).map((line, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: line,
      })),
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
          model: cfg.openaiModel,
          temperature: 0.15,
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
            'Puedes pedir por *código* o *nombre* del producto. Ejemplo: "2" o "medio pollo". Escribe *humano* si necesitas ayuda.',
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
}
