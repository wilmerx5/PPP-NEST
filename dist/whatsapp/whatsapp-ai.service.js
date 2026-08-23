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
                reply: 'El asistente IA aún no está configurado. Un momento, te atenderá el equipo o configura OPENAI_API_KEY en admin.',
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
            { role: 'system', content: system },
            ...input.recentMessages.slice(-8).map((line, i) => ({
                role: (i % 2 === 0 ? 'user' : 'assistant'),
                content: line,
            })),
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
            const data = (await res.json());
            const content = data.choices?.[0]?.message?.content || '{}';
            const parsed = JSON.parse(content);
            if (!parsed.reply || typeof parsed.reply !== 'string') {
                return { reply: '¿Podrías repetir tu pedido? Recuerda que puedes decir el nombre o el código del producto.' };
            }
            return parsed;
        }
        catch (err) {
            this.logger.error(`OpenAI call failed: ${err}`);
            return {
                reply: 'No pude procesar tu mensaje. Intenta de nuevo o escribe *humano* para ayuda del equipo.',
            };
        }
    }
};
exports.WhatsappAiService = WhatsappAiService;
exports.WhatsappAiService = WhatsappAiService = WhatsappAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_settings_service_1.WhatsappSettingsService])
], WhatsappAiService);
//# sourceMappingURL=whatsapp-ai.service.js.map