"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappTurnTelemetryService = void 0;
const common_1 = require("@nestjs/common");
let WhatsappTurnTelemetryService = class WhatsappTurnTelemetryService {
    logger = new common_1.Logger('WaTurnTelemetry');
    recent = [];
    maxRecent = 100;
    record(event) {
        const full = {
            ...event,
            at: event.at || new Date().toISOString(),
            userTextPreview: event.userTextPreview?.slice(0, 120),
            replyPreview: event.replyPreview?.slice(0, 160),
        };
        this.recent.push(full);
        if (this.recent.length > this.maxRecent)
            this.recent.shift();
        this.logger.log(JSON.stringify(full));
    }
    getRecent(limit = 30) {
        return this.recent.slice(-Math.max(1, Math.min(limit, this.maxRecent)));
    }
};
exports.WhatsappTurnTelemetryService = WhatsappTurnTelemetryService;
exports.WhatsappTurnTelemetryService = WhatsappTurnTelemetryService = __decorate([
    (0, common_1.Injectable)()
], WhatsappTurnTelemetryService);
//# sourceMappingURL=whatsapp-turn-telemetry.service.js.map