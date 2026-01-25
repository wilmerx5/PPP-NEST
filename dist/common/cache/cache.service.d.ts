export declare class CacheService {
    private readonly logger;
    private cache;
    private readonly defaultTtl;
    get<T>(key: string): T | null;
    set<T>(key: string, data: T, ttlMs?: number): void;
    delete(key: string): void;
    clear(): void;
    invalidate(pattern: string): void;
    size(): number;
    cleanup(): void;
}
