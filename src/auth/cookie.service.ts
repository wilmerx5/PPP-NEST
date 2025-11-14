import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Injectable()
export class CookieService {
    private readonly secure: boolean;
    private readonly sameSite: 'lax' | 'strict' | 'none';
    private readonly accessMaxAge: number;
    private readonly refreshMaxAge: number;

    constructor(private config: ConfigService) {
        this.secure = this.config.get<string>('COOKIE_SECURE') === 'true';

        const sameSiteEnv = this.config.get<string>('COOKIE_SAMESITE');
        this.sameSite =
            sameSiteEnv === 'lax' ||
                sameSiteEnv === 'strict' ||
                sameSiteEnv === 'none'
                ? sameSiteEnv
                : 'lax';

        this.accessMaxAge = this.config.get<number>('ACCESS_TOKEN_MAXAGE') || 900000;
        this.refreshMaxAge = this.config.get<number>('REFRESH_TOKEN_MAXAGE') || 604800000;
    }

    setAccessToken(res: Response, token: string) {
        res.cookie('access_token', token, {
            httpOnly: true,
            secure: this.secure,
            sameSite: this.sameSite,
            maxAge: this.accessMaxAge,
        });
    }

    setRefreshToken(res: Response, token: string) {
        res.cookie('refresh_token', token, {
            httpOnly: true,
            secure: this.secure,
            sameSite: this.sameSite,
            maxAge: this.refreshMaxAge,
            path: '/auth/refresh',
        });
    }

    clearAuthCookies(res: Response) {
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
    }
}
