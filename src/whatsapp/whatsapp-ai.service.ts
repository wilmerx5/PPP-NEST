import { Injectable, Logger } from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import type { AiTurnResult } from './types/whatsapp-session.types';

@Injectable()
export class WhatsappAiService {
  private readonly logger = new Logger(WhatsappAiService.name);

  constructor(private readonly settingsService: WhatsappSettingsService) {}

  async generateTurn(input: {
    userMessage: string;
    menuText: string;
    businessOpen: boolean;
    sessionSummary: string;
    recentMessages: string[];
    customerHint: string;
  }): Promise<AiTurnResult> {
    const cfg = await this.settingsService.getEffectiveConfig();
    if (!cfg.openaiApiKey) {
      return {
        reply:
          'El asistente IA aún no está configurado. Un momento, te atenderá el equipo o configura OPENAI_API_KEY en admin.',
        actions: { requestHuman: true },
      };
    }

    const system = `${cfg.systemPrompt}

Estado del restaurante: ${input.businessOpen ? 'ABIERTO' : 'CERRADO'}.
${input.customerHint}

Resumen de sesión:
${input.sessionSummary}

Menú (usa solo estos productos):
${input.menuText}`;

    const messages = [
      { role: 'system' as const, content: system },
      ...input.recentMessages.slice(-8).map((line, i) => ({
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
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`OpenAI error ${res.status}: ${err}`);
        return {
          reply: 'Tuve un problema técnico. Escribe *humano* para hablar con alguien del restaurante.',
        };
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as AiTurnResult;
      if (!parsed.reply || typeof parsed.reply !== 'string') {
        return { reply: '¿Podrías repetir tu pedido? Recuerda que puedes decir el nombre o el código del producto.' };
      }
      return parsed;
    } catch (err) {
      this.logger.error(`OpenAI call failed: ${err}`);
      return {
        reply: 'No pude procesar tu mensaje. Intenta de nuevo o escribe *humano* para ayuda del equipo.',
      };
    }
  }
}
