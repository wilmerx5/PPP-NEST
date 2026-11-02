import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { BoldOnlineController } from './bold-online.controller';
import { BoldOnlineService } from './bold-online.service';
describe('Bold online admin pilot permissions', () => {
  let app: INestApplication;
  const service = {
    overview: jest.fn(() => ({ configured: false, attempts: [] })),
    saveKey: jest.fn(() => ({ configured: true })),
    checkAccess: jest.fn(() => ({ ok: true })),
    create: jest.fn((_dto: any, _actor: any) => ({ status: 'running' })),
    refresh: jest.fn(() => ({ status: 'running' })),
  };
  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [BoldOnlineController],
      providers: [{ provide: BoldOnlineService, useValue: service }],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = {
            id: 'admin',
            roles: [req.headers['x-test-role'] || 'user'],
          };
          return true;
        },
      })
      .compile();
    app = m.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());
  it('denies drivers access to API credentials and QR pilot creation', async () => {
    await request(app.getHttpServer())
      .put('/bold/online/key')
      .set('x-test-role', 'paymentsUser')
      .send({ identityKey: 'production-key-fixture' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/bold/online/qr')
      .set('x-test-role', 'paymentsUser')
      .send({})
      .expect(403);
    expect(service.saveKey).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
  });
  it('validates real amounts, payer identity and requested duration before calling Bold', async () => {
    const body = {
      requestId: '11111111-1111-4111-8111-111111111111',
      amount: 1000,
      payerName: 'Nombre real',
    };
    await request(app.getHttpServer())
      .post('/bold/online/qr')
      .set('x-test-role', 'admin')
      .send({ ...body, durationMinutes: 60 })
      .expect(201);
    expect(service.create.mock.calls[0][0].durationMinutes).toBe(60);
    service.create.mockClear();
    for (const invalid of [
      { ...body, amount: 0 },
      { ...body, durationMinutes: 200 },
      { ...body, payerName: '' },
      { ...body, payerPhone: 'invalid' },
    ])
      await request(app.getHttpServer())
        .post('/bold/online/qr')
        .set('x-test-role', 'admin')
        .send(invalid)
        .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });
});
