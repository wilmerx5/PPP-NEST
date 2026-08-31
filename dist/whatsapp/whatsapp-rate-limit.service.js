"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WhatsappRateLimitService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappRateLimitService = void 0;
const common_1 = require("@nestjs/common");
let WhatsappRateLimitService = WhatsappRateLimitService_1 = class WhatsappRateLimitService {
    logger = new common_1.Logger(WhatsappRateLimitService_1.name);
    buckets = new Map();
    allow(key, maxPerMinute) {
        const limit = Math.max(1, Math.floor(maxPerMinute) || 25);
        const now = Date.now();
        const windowMs = 60_000;
        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = { timestamps: [] };
            this.buckets.set(key, bucket);
        }
        bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
        if (bucket.timestamps.length >= limit) {
            this.logger.warn(`Rate limit hit for ${key} (${bucket.timestamps.length}/${limit}/min)`);
            return false;
        }
        bucket.timestamps.push(now);
        if (this.buckets.size > 5000) {
            const oldest = this.buckets.keys().next().value;
            if (oldest)
                this.buckets.delete(oldest);
        }
        return true;
    }
};
exports.WhatsappRateLimitService = WhatsappRateLimitService;
exports.WhatsappRateLimitService = WhatsappRateLimitService = WhatsappRateLimitService_1 = __decorate([
    (0, common_1.Injectable)()
], WhatsappRateLimitService);
//# sourceMappingURL=whatsapp-rate-limit.service.js.map