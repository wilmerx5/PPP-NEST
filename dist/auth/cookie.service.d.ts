import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
export declare class CookieService {
    private config;
    private readonly secure;
    private readonly sameSite;
    private readonly accessMaxAge;
    private readonly refreshMaxAge;
    constructor(config: ConfigService);
    setAccessToken(res: Response, token: string): void;
    setRefreshToken(res: Response, token: string): void;
    clearAuthCookies(res: Response): void;
}
