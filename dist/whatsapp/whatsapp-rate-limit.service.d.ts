export declare class WhatsappRateLimitService {
    private readonly logger;
    private readonly buckets;
    allow(key: string, maxPerMinute: number): boolean;
}
