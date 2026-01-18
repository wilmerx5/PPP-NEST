import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Injectable()
export class CookieService {
    private readonly secure: boolean;
    private readonly sameSite: 'lax' | 'strict' | 'none';
    private readonly accessMaxAge: number;
    private readonly refreshMaxAge: number;
    private readonly cookieDomain: string | undefined;

    constructor(private config: ConfigService) {
        this.secure = this.config.get<string>('COOKIE_SECURE') === 'true';

        const sameSiteEnv = this.config.get<string>('COOKIE_SAMESITE');
        this.sameSite =
            sameSiteEnv === 'lax' ||
                sameSiteEnv === 'strict' ||
                sameSiteEnv === 'none'
                ? sameSiteEnv
                : 'lax';

        // Convertir explícitamente a número (las variables de entorno son strings)
        const accessMaxAgeEnv = this.config.get<string>('ACCESS_TOKEN_MAXAGE');
        const refreshMaxAgeEnv = this.config.get<string>('REFRESH_TOKEN_MAXAGE');
        
        this.accessMaxAge = accessMaxAgeEnv ? parseInt(accessMaxAgeEnv, 10) : 900000;
        this.refreshMaxAge = refreshMaxAgeEnv ? parseInt(refreshMaxAgeEnv, 10) : 604800000;

        // Si no hay COOKIE_DOMAIN configurado, usar undefined para que funcione en cualquier dominio
        // Si está configurado, usarlo (debe empezar con punto para subdominios, ej: .ppp.local)
        const cookieDomainEnv = this.config.get<string>('COOKIE_DOMAIN');
        this.cookieDomain = cookieDomainEnv || undefined;
        
        // Log para debugging
        console.log('[CookieService] Cookie domain configurado:', this.cookieDomain || 'undefined (funciona en cualquier dominio)');
        console.log('[CookieService] Access maxAge (ms):', this.accessMaxAge, '(tipo:', typeof this.accessMaxAge, ')');
        console.log('[CookieService] Refresh maxAge (ms):', this.refreshMaxAge, '(tipo:', typeof this.refreshMaxAge, ')');
        console.log('[CookieService] SameSite:', this.sameSite);
        console.log('[CookieService] Secure:', this.secure);
    }

    setAccessToken(res: Response, token: string) {
        const cookieOptions: any = {
            httpOnly: true,
            secure: this.secure,
            sameSite: this.sameSite,
            path: '/',
            maxAge: this.accessMaxAge,
        };
        
        // Establecer dominio si está configurado (necesario para compartir cookies entre subdominios)
        if (this.cookieDomain) {
            cookieOptions.domain = this.cookieDomain;
        }
        
        console.log('[CookieService] Estableciendo access_token con opciones:', cookieOptions);
        console.log('[CookieService] Token length:', token?.length || 0);
        
        res.cookie('access_token', token, cookieOptions);
        
        console.log('[CookieService] access_token establecido');
    }

    setRefreshToken(res: Response, token: string) {
        const cookieOptions: any = {
            httpOnly: true,
            secure: this.secure,
            sameSite: this.sameSite,
            maxAge: this.refreshMaxAge,
            path: '/',
        };
        
        // Establecer dominio si está configurado (necesario para compartir cookies entre subdominios)
        if (this.cookieDomain) {
            cookieOptions.domain = this.cookieDomain;
        }
        
        console.log('[CookieService] Estableciendo refresh_token con opciones:', cookieOptions);
        console.log('[CookieService] Token length:', token?.length || 0);
        
        res.cookie('refresh_token', token, cookieOptions);
        
        console.log('[CookieService] refresh_token establecido');
    }

    clearAuthCookies(res: Response) {
        const clearOptions: any = { path: '/' };
        if (this.cookieDomain) {
            clearOptions.domain = this.cookieDomain;
        }
        
        res.clearCookie('access_token', clearOptions);
        res.clearCookie('refresh_token', clearOptions);
    }
}
