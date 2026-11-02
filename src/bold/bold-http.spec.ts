import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { BoldController } from './bold.controller';
import { BoldService } from './bold.service';

describe('Bold HTTP permissions and validation', () => {
  let app: INestApplication;
  const service = {
    list: jest.fn(() => ({ items: [] })),
    claim: jest.fn(() => ({ ok: true })),
    returnAdvance: jest.fn(() => ({ ok: true })),
    receive: jest.fn(() => ({ ok: true })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BoldController],
      providers: [{ provide: BoldService, useValue: service }],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = {
            id: 'test-user',
            fullName: 'Test user',
            roles: [req.headers['x-test-role'] || 'user'],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication({ rawBody: true });
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
  const id = '11111111-1111-4111-8111-111111111111';
  it('denies clients and unrelated staff access to receipts', async () => {
    for (const role of ['user', 'ordersUser', 'kitchenUser', 'whatsappUser'])
      await request(app.getHttpServer())
        .get('/bold/receipts')
        .set('x-test-role', role)
        .expect(403);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('lets drivers consult and claim but only admins record cash returns', async () => {
    await request(app.getHttpServer())
      .get('/bold/receipts')
      .set('x-test-role', 'paymentsUser')
      .expect(200);
    await request(app.getHttpServer())
      .post(`/bold/receipts/${id}/claim`)
      .set('x-test-role', 'paymentsUser')
      .send({ orderId: 1, advanceAmount: 30000 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/bold/receipts/${id}/return`)
      .set('x-test-role', 'paymentsUser')
      .expect(403);
    expect(service.returnAdvance).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post(`/bold/receipts/${id}/return`)
      .set('x-test-role', 'admin')
      .expect(201);
  });
  it('rejects invalid financial inputs before reaching the service', async () => {
    for (const body of [
      { orderId: 0, advanceAmount: 30 },
      { orderId: 1, advanceAmount: -10 },
      { orderId: 1, advanceAmount: 1.234 },
      { advanceAmount: 30000 },
    ]) {
      await request(app.getHttpServer())
        .post(`/bold/receipts/${id}/claim`)
        .set('x-test-role', 'paymentsUser')
        .send(body)
        .expect(400);
    }
    expect(service.claim).not.toHaveBeenCalled();
  });
  it('preserves raw webhook bytes including whitespace for signature verification', async () => {
    const body = '{ "id": "test" }';
    await request(app.getHttpServer())
      .post('/bold/webhook')
      .set('Content-Type', 'application/json')
      .set('x-bold-signature', 'signature')
      .send(body)
      .expect(200);
    expect(service.receive).toHaveBeenCalledWith(
      Buffer.from(body),
      'signature',
    );
  });
});
