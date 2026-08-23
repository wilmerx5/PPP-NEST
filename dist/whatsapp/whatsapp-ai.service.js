"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WhatsappAiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappAiService = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_settings_service_1 = require("./whatsapp-settings.service");
const whatsapp_business_rules_1 = require("./whatsapp-business-rules");
let WhatsappAiService = WhatsappAiService_1 = class WhatsappAiService {
    settingsService;
    logger = new common_1.Logger(WhatsappAiService_1.name);
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    async generateTurn(input) {
        const cfg = await this.settingsService.getEffectiveConfig();
        if (!cfg.openaiApiKey) {
            return {
                reply: 'El asistente aún no está configurado. Escribe *humano* para hablar con el restaurante.',
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

${whatsapp_business_rules_1.WHATSAPP_AI_JSON_SCHEMA}`;
        const history = this.toChatMessages(input.recentMessages).slice(-12);
        const messages = [
            { role: 'system', content: system },
            ...history,
            { role: 'user', content: input.userMessage },
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
            const data = (await res.json());
            const content = data.choices?.[0]?.message?.content || '{}';
            const parsed = JSON.parse(content);
            if (!parsed.reply || typeof parsed.reply !== 'string') {
                return {
                    reply: 'Puedes pedir por *código* o *nombre* del producto. Ejemplo: "28" o "medio pollo". Escribe *humano* si necesitas ayuda.',
                };
            }
            parsed.reply = parsed.reply.trim().slice(0, 3500);
            if (parsed.actions?.requestConfirm) {
                delete parsed.actions.requestConfirm;
            }
            return parsed;
        }
        catch (err) {
            this.logger.error(`OpenAI call failed: ${err}`);
            return {
                reply: 'No pude procesar tu mensaje. Intenta con el código o nombre del producto, o escribe *humano*.',
            };
        }
    }
    toChatMessages(recent) {
        const out = [];
        for (const line of recent) {
            const trimmed = (line || '').trim();
            if (!trimmed)
                continue;
            if (/^Cliente:\s*/i.test(trimmed)) {
                out.push({ role: 'user', content: trimmed.replace(/^Cliente:\s*/i, '').trim() });
            }
            else if (/^Bot:\s*/i.test(trimmed)) {
                out.push({ role: 'assistant', content: trimmed.replace(/^Bot:\s*/i, '').trim() });
            }
            else {
                out.push({ role: 'user', content: trimmed });
            }
        }
        return out.filter((m) => m.content.length > 0);
    }
};
exports.WhatsappAiService = WhatsappAiService;
exports.WhatsappAiService = WhatsappAiService = WhatsappAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_settings_service_1.WhatsappSettingsService])
], WhatsappAiService);
//# sourceMappingURL=whatsapp-ai.service.js.map