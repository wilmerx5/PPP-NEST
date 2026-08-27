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
var FactusAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactusAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let FactusAuthService = FactusAuthService_1 = class FactusAuthService {
    config;
    logger = new common_1.Logger(FactusAuthService_1.name);
    accessToken = null;
    refreshToken = null;
    expiresAtMs = 0;
    constructor(config) {
        this.config = config;
    }
    getBaseUrl() {
        const env = (this.config.get('FACTUS_ENV') || 'sandbox').toLowerCase();
        if (env === 'production' || env === 'prod') {
            return 'https://api.factus.com.co';
        }
        return 'https://api-sandbox.factus.com.co';
    }
    isConfigured() {
        return !!(this.config.get('FACTUS_CLIENT_ID')?.trim() &&
            this.config.get('FACTUS_CLIENT_SECRET')?.trim() &&
            this.config.get('FACTUS_USERNAME')?.trim() &&
            this.config.get('FACTUS_PASSWORD')?.trim());
    }
    async getAccessToken() {
        if (!this.isConfigured()) {
            throw new common_1.ServiceUnavailableException('Factus no está configurado. Define FACTUS_CLIENT_ID, FACTUS_CLIENT_SECRET, FACTUS_USERNAME y FACTUS_PASSWORD.');
        }
        const skewMs = 60_000;
        if (this.accessToken && Date.now() < this.expiresAtMs - skewMs) {
            return this.accessToken;
        }
        if (this.refreshToken) {
            try {
                return await this.refreshAccessToken();
            }
            catch (err) {
                this.logger.warn(`Refresh Factus falló, reautenticando: ${err.message}`);
            }
        }
        return this.fetchPasswordToken();
    }
    invalidateToken() {
        this.accessToken = null;
        this.expiresAtMs = 0;
    }
    async fetchPasswordToken() {
        const body = new URLSearchParams({
            grant_type: 'password',
            client_id: this.config.get('FACTUS_CLIENT_ID').trim(),
            client_secret: this.config.get('FACTUS_CLIENT_SECRET').trim(),
            username: this.config.get('FACTUS_USERNAME').trim(),
            password: this.config.get('FACTUS_PASSWORD').trim(),
        });
        const res = await fetch(`${this.getBaseUrl()}/oauth/token`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        });
        if (!res.ok) {
            const errText = await res.text();
            this.logger.error(`Factus OAuth error ${res.status}: ${errText}`);
            throw new common_1.ServiceUnavailableException('No se pudo autenticar con Factus. Revisa credenciales / sandbox.');
        }
        const data = (await res.json());
        this.storeTokens(data);
        return this.accessToken;
    }
    async refreshAccessToken() {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.config.get('FACTUS_CLIENT_ID').trim(),
            client_secret: this.config.get('FACTUS_CLIENT_SECRET').trim(),
            refresh_token: this.refreshToken,
        });
        const res = await fetch(`${this.getBaseUrl()}/oauth/token`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        });
        if (!res.ok) {
            this.refreshToken = null;
            throw new Error(`refresh failed ${res.status}`);
        }
        const data = (await res.json());
        this.storeTokens(data);
        return this.accessToken;
    }
    storeTokens(data) {
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token || this.refreshToken;
        const expiresIn = Number(data.expires_in) || 3600;
        this.expiresAtMs = Date.now() + expiresIn * 1000;
    }
};
exports.FactusAuthService = FactusAuthService;
exports.FactusAuthService = FactusAuthService = FactusAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FactusAuthService);
//# sourceMappingURL=factus-auth.service.js.map