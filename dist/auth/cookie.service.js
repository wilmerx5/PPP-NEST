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
exports.CookieService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let CookieService = class CookieService {
    config;
    secure;
    sameSite;
    accessMaxAge;
    refreshMaxAge;
    cookieDomain;
    constructor(config) {
        this.config = config;
        this.secure = this.config.get('COOKIE_SECURE') === 'true';
        const sameSiteEnv = this.config.get('COOKIE_SAMESITE');
        this.sameSite =
            sameSiteEnv === 'lax' ||
                sameSiteEnv === 'strict' ||
                sameSiteEnv === 'none'
                ? sameSiteEnv
                : 'lax';
        this.accessMaxAge = this.config.get('ACCESS_TOKEN_MAXAGE') || 900000;
        this.refreshMaxAge = this.config.get('REFRESH_TOKEN_MAXAGE') || 604800000;
        const cookieDomainEnv = this.config.get('COOKIE_DOMAIN');
        this.cookieDomain = cookieDomainEnv || undefined;
        console.log('[CookieService] Cookie domain configurado:', this.cookieDomain || 'undefined (funciona en cualquier dominio)');
        console.log('[CookieService] SameSite:', this.sameSite);
        console.log('[CookieService] Secure:', this.secure);
    }
    setAccessToken(res, token) {
        const cookieOptions = {
            httpOnly: true,
            secure: this.secure,
            sameSite: this.sameSite,
            path: '/',
            maxAge: this.accessMaxAge,
        };
        if (this.cookieDomain) {
            cookieOptions.domain = this.cookieDomain;
        }
        res.cookie('access_token', token, cookieOptions);
    }
    setRefreshToken(res, token) {
        const cookieOptions = {
            httpOnly: true,
            secure: this.secure,
            sameSite: this.sameSite,
            maxAge: this.refreshMaxAge,
            path: '/',
        };
        if (this.cookieDomain) {
            cookieOptions.domain = this.cookieDomain;
        }
        res.cookie('refresh_token', token, cookieOptions);
    }
    clearAuthCookies(res) {
        const clearOptions = { path: '/' };
        if (this.cookieDomain) {
            clearOptions.domain = this.cookieDomain;
        }
        res.clearCookie('access_token', clearOptions);
        res.clearCookie('refresh_token', clearOptions);
    }
};
exports.CookieService = CookieService;
exports.CookieService = CookieService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CookieService);
//# sourceMappingURL=cookie.service.js.map