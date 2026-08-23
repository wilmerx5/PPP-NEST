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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappPointsService = void 0;
const common_1 = require("@nestjs/common");
const points_service_1 = require("../auth/services/points.service");
const whatsapp_points_help_1 = require("./whatsapp-points-help");
const TWELVE_CHAR_CODE = /\b([A-Za-z0-9]{12})\b/;
const POINT_CODE_CHARSET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;
const ORDER_INTENT_WORD = /\b(quiero|quieor|qiero|kiero|dame|ponme|pedir|ordenar|agrega|agregame|un|una|unos|unas|medio|cuarto|entero|combo|pollo|arroz|sopa|ejecutivo|frito|broaster|bandeja|bebida|gaseosa|domicilio|habitacion|habitaci[oó]n)\b/i;
let WhatsappPointsService = class WhatsappPointsService {
    pointsService;
    constructor(pointsService) {
        this.pointsService = pointsService;
    }
    extractPointCodeCandidate(text) {
        const raw = (text || '').trim();
        if (!raw)
            return null;
        const bare = raw.match(/^[A-Za-z0-9]{12}$/);
        if (bare) {
            const code = bare[0].toUpperCase();
            return POINT_CODE_CHARSET.test(code) ? code : null;
        }
        const m = raw.match(TWELVE_CHAR_CODE);
        if (!m?.[1])
            return null;
        const code = m[1].toUpperCase();
        if (!POINT_CODE_CHARSET.test(code))
            return null;
        const hasDigit = /\d/.test(code);
        const pointsContext = this.hasPointsKeywords(raw);
        const orderContext = ORDER_INTENT_WORD.test(raw);
        if (orderContext && !pointsContext && !hasDigit)
            return null;
        if (!pointsContext && !hasDigit)
            return null;
        return code;
    }
    extractTwelveCharCode(text) {
        return this.extractPointCodeCandidate(text);
    }
    hasPointsKeywords(text) {
        const t = (text || '').toLowerCase();
        return (/\b(puntos?|premio?s?|cup[oó]n|canjear|redimir|acumular|mis\s+puntos|programa\s+de\s+puntos|factura|recibo|ticket|c[oó]digo\s+de\s+(punto|factura|premio)|registrar)\b/.test(t) ||
            /\b(c[oó]mo\s+(funcionan|gano|acumulo|registro|uso)\s+(los\s+)?puntos)\b/.test(t) ||
            /\b(qu[eé]\s+(son|genera)\s+(los\s+)?puntos)\b/.test(t));
    }
    isPointsTopic(text) {
        if (this.extractPointCodeCandidate(text))
            return true;
        return this.hasPointsKeywords(text);
    }
    isBalanceIntent(text) {
        return /\b(mis\s+puntos|cu[aá]ntos\s+puntos|saldo\s+de\s+puntos|ver\s+puntos)\b/i.test(text);
    }
    isRedeemIntent(text) {
        const t = (text || '').toLowerCase();
        return (/\b(redimir|canjear\s+(mis\s+)?puntos|generar\s+premio|sacar\s+premio)\b/.test(t) ||
            t === 'redimir');
    }
    isRegisterIntent(text) {
        const t = (text || '').toLowerCase();
        return (/\b(registrar(\s+(el\s+)?(punto|c[oó]digo|factura))?|registro\s+de\s+punto|c[oó]digo\s+de\s+factura)\b/.test(t) || (this.extractPointCodeCandidate(text) != null && /\bregistrar\b/i.test(t)));
    }
    isPremioApplyIntent(text) {
        const t = (text || '').toLowerCase();
        return (/\b(premio|cup[oó]n|voucher|canje)\b/.test(t) &&
            (this.extractPointCodeCandidate(text) != null ||
                /\b(usar|aplicar|tengo|aplica)\b/.test(t)));
    }
    isRemovePremioIntent(text) {
        return /\b(quitar|cancelar|sin|remover|borrar)\s+(el\s+)?premio\b/i.test(text);
    }
    cartHasHalfChicken(cart) {
        return cart.some((c) => c.code === 2 || c.code === 5);
    }
    async getAvailablePoints(userId) {
        if (!userId)
            return null;
        return this.pointsService.getAvailablePoints(userId);
    }
    buildHelpContext(websiteUrl, linkedUserName, availablePoints) {
        return { websiteUrl, linkedUserName, availablePoints };
    }
    buildOverviewMessage(ctx) {
        return (0, whatsapp_points_help_1.buildPointsOverviewReply)(ctx);
    }
    buildRegisterHelp(ctx) {
        return (0, whatsapp_points_help_1.buildRegisterPointSteps)(ctx);
    }
    buildRedeemHelp(available) {
        return (0, whatsapp_points_help_1.buildRedeemSteps)(available);
    }
    async registerPointForUser(userId, code) {
        try {
            await this.pointsService.registerPointByCode(userId, code.toUpperCase().trim());
            const available = await this.pointsService.getAvailablePoints(userId);
            return { ok: true, available };
        }
        catch (err) {
            return { ok: false, message: this.mapPointsError(err) };
        }
    }
    async redeemNinePoints(userId) {
        try {
            const redemption = await this.pointsService.redeemPointsForVoucher(userId);
            const availableAfter = await this.pointsService.getAvailablePoints(userId);
            return {
                ok: true,
                code: redemption.code,
                expiresAt: redemption.expiresAt ?? null,
                availableAfter,
            };
        }
        catch (err) {
            return { ok: false, message: this.mapPointsError(err) };
        }
    }
    async validatePremioCode(code, linkedUserId) {
        try {
            const redemption = await this.pointsService.validateRedemptionCode(code.toUpperCase().trim());
            if (linkedUserId && redemption.userId && redemption.userId !== linkedUserId) {
                return {
                    ok: false,
                    message: 'Ese premio pertenece a otra cuenta. Inicia sesión en la web con la cuenta correcta o usa el código en el local.',
                };
            }
            return {
                ok: true,
                code: redemption.code,
                expiresAt: redemption.expiresAt ?? null,
            };
        }
        catch (err) {
            return { ok: false, message: this.mapPointsError(err) };
        }
    }
    async tryRegisterOnly(userId, code) {
        if (!userId) {
            return {
                handled: true,
                message: 'Para registrar ese código necesitas una cuenta web vinculada a este celular. ' +
                    'Entra a la web → *Mis puntos* → *Registrar punto*.',
            };
        }
        const result = await this.registerPointForUser(userId, code);
        if (result.ok) {
            return {
                handled: true,
                message: `✅ *Punto registrado.* Ahora tienes *${result.available}* punto(s) disponible(s).\n\n` +
                    (result.available >= whatsapp_points_help_1.POINTS_REQUIRED_FOR_PRIZE
                        ? `Ya puedes escribir *redimir* para generar tu premio.`
                        : `Te faltan *${whatsapp_points_help_1.POINTS_REQUIRED_FOR_PRIZE - result.available}* para redimir un premio.`),
            };
        }
        return { handled: true, message: result.message };
    }
    mapPointsError(err) {
        if (err instanceof common_1.NotFoundException) {
            const msg = err.message || '';
            if (/premio|redemption/i.test(msg)) {
                return 'Código de premio no encontrado. Revisa que sean 12 caracteres.';
            }
            return 'Código no encontrado. Verifica el código de tu factura (12 caracteres).';
        }
        if (err instanceof common_1.ConflictException) {
            const msg = (err.message || '').toLowerCase();
            if (/already been used|ya fue usado/i.test(msg)) {
                return 'Ese código ya fue usado.';
            }
            if (/otro usuario|another user/i.test(msg)) {
                return 'Ese código ya fue registrado por otro usuario.';
            }
            return err.message || 'Ese código ya no está disponible.';
        }
        if (err instanceof common_1.BadRequestException) {
            const msg = err.message || '';
            if (/expired|expir/i.test(msg)) {
                return 'Ese premio ya venció (30 días desde que lo generaste).';
            }
            if (/12 character|12 caracteres/i.test(msg)) {
                return 'El código debe tener exactamente 12 caracteres (letras y números).';
            }
            if (/at least 9|9 points|9 puntos/i.test(msg)) {
                return `Necesitas al menos ${whatsapp_points_help_1.POINTS_REQUIRED_FOR_PRIZE} puntos disponibles para redimir.`;
            }
            return msg;
        }
        if (err instanceof Error)
            return err.message;
        return 'No pude procesar el código. Intenta de nuevo o escribe *humano*.';
    }
};
exports.WhatsappPointsService = WhatsappPointsService;
exports.WhatsappPointsService = WhatsappPointsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [points_service_1.PointsService])
], WhatsappPointsService);
//# sourceMappingURL=whatsapp-points.service.js.map