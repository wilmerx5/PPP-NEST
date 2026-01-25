import { DataSource } from 'typeorm';
import { AppService } from './app.service';
import { CircuitBreakerService } from './common/circuit-breaker/circuit-breaker.service';
import { CacheService } from './common/cache/cache.service';
export declare class AppController {
    private readonly appService;
    private readonly dataSource;
    private readonly circuitBreaker;
    private readonly cache;
    constructor(appService: AppService, dataSource: DataSource, circuitBreaker: CircuitBreakerService, cache: CacheService);
    health(): Promise<{
        status: string;
        db: string;
        circuitBreaker: import("./common/circuit-breaker/circuit-breaker.service").CircuitState;
        cacheSize: number;
        timestamp: string;
    }>;
}
