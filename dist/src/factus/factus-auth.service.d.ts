import { ConfigService } from '@nestjs/config';
export declare class FactusAuthService {
    private readonly config;
    private readonly logger;
    private accessToken;
    private refreshToken;
    private expiresAtMs;
    constructor(config: ConfigService);
    getBaseUrl(): string;
    isConfigured(): boolean;
    getAccessToken(): Promise<string>;
    invalidateToken(): void;
    private fetchPasswordToken;
    private refreshAccessToken;
    private storeTokens;
}
