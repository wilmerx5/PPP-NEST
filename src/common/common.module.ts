import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { MailService } from './mail/mail.service';
import { CacheService } from './cache/cache.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { SqlMigrationsRunner } from './migrations/sql-migrations.runner';

@Global()
@Module({
  controllers: [CommonController],
  providers: [
    CommonService,
    MailService,
    CacheService,
    CircuitBreakerService,
    SqlMigrationsRunner,
  ],
  imports: [ConfigModule],
  exports: [MailService, CacheService, CircuitBreakerService],
})
export class CommonModule {
  constructor(private readonly cache: CacheService) {
    // Cleanup cada 30 segundos para evitar crecimiento excesivo
    setInterval(() => this.cache.cleanup(), 30000);
  }
}
