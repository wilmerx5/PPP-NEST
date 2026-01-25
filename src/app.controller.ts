import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';
import { CircuitBreakerService } from './common/circuit-breaker/circuit-breaker.service';
import { CacheService } from './common/cache/cache.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly cache: CacheService,
  ) {}

  @Get('health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        db: 'connected',
        circuitBreaker: this.circuitBreaker.getState(),
        cacheSize: this.cache.size(),
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        db: 'disconnected',
        circuitBreaker: this.circuitBreaker.getState(),
        timestamp: new Date().toISOString(),
      });
    }
  }
}
