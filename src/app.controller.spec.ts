import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CircuitBreakerService } from './common/circuit-breaker/circuit-breaker.service';
import { CacheService } from './common/cache/cache.service';

describe('AppController', () => {
  let appController: AppController;
  const dataSourceMock = { query: jest.fn().mockResolvedValue([{ '1': 1 }]) };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: DataSource, useValue: dataSourceMock },
        {
          provide: CircuitBreakerService,
          useValue: { getState: jest.fn().mockReturnValue('CLOSED') },
        },
        { provide: CacheService, useValue: { size: jest.fn().mockReturnValue(0) } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('returns ok when DB responds', async () => {
      const res = await appController.health();
      expect(res.status).toBe('ok');
      expect(res.db).toBe('connected');
    });

    it('throws 503 when DB is down', async () => {
      dataSourceMock.query.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(appController.health()).rejects.toThrow();
    });
  });
});
