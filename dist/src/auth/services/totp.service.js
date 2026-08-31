"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TotpService = void 0;
const common_1 = require("@nestjs/common");
const otplib_1 = require("otplib");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const QRCode = require("qrcode");
const ISSUER = 'PPP Staff';
const RECOVERY_CODE_COUNT = 8;
let TotpService = class TotpService {
    createSecret() {
        return otplib_1.authenticator.generateSecret();
    }
    buildOtpAuthUri(email, secret) {
        return otplib_1.authenticator.keyuri(email, ISSUER, secret);
    }
    async buildQrDataUrl(otpauthUri) {
        return QRCode.toDataURL(otpauthUri, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 220,
        });
    }
    verifyToken(secret, token) {
        const code = (token || '').replace(/\s/g, '');
        if (!/^\d{6}$/.test(code))
            return false;
        try {
            return otplib_1.authenticator.check(code, secret);
        }
        catch {
            return false;
        }
    }
    generateToken(secret) {
        return otplib_1.authenticator.generate(secret);
    }
    generateRecoveryCodes() {
        const codes = [];
        for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
            const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
            codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
        }
        return codes;
    }
    hashRecoveryCodes(codes) {
        return codes.map((c) => bcrypt.hashSync(this.normalizeRecoveryCode(c), 10));
    }
    consumeRecoveryCode(hashedCodes, presented) {
        if (!hashedCodes?.length)
            return null;
        const normalized = this.normalizeRecoveryCode(presented);
        if (normalized.length < 8)
            return null;
        const idx = hashedCodes.findIndex((hash) => bcrypt.compareSync(normalized, hash));
        if (idx < 0)
            return null;
        return hashedCodes.filter((_, i) => i !== idx);
    }
    normalizeRecoveryCode(code) {
        return (code || '').replace(/[\s-]/g, '').toUpperCase();
    }
};
exports.TotpService = TotpService;
exports.TotpService = TotpService = __decorate([
    (0, common_1.Injectable)()
], TotpService);
//# sourceMappingURL=totp.service.js.map