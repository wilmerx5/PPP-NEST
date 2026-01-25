import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        db: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
