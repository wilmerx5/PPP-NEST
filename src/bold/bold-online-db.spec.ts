import { Order } from '../orders/entities/order.entity';
import { BoldService } from './bold.service';
import { DataSource, EntitySchema } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { BoldOnlineService } from './bold-online.service';
import { BoldOnlineSettings, BoldQrAttempt } from './entities/bold-qr.entity';
import { BoldReceipt, BoldEvent } from './entities/bold-receipt.entity';
import { User } from '../auth/entities/user.entity';
import * as client from './bold-online-client';
const isolated = process.env.BOLD_TEST_DB_PORT ? describe : describe.skip;
isolated('Bold online isolated database', () => {
  let db: DataSource;
  let service: BoldOnlineService;
  const actor = {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Administrador de prueba',
  } as User;
  const cfg = new ConfigService({
    JWT_SECRET: 'isolated-encryption-seed',
    BOLD_MERCHANT_ID: 'merchant',
    BOLD_WEBHOOK_SECRET: 'secret',
  });
  const dto = () => ({
    requestId: randomUUID(),
    amount: 1000,
    durationMinutes: 60,
    payerName: 'Persona de prueba',
  });
  const png = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
  const mockGeneration = () =>
    jest
      .spyOn(client, 'boldOnlineRequest')
      .mockImplementation(async (_key, path, body: any) => {
        if (path === '/v1/payment-intent')
          return {
            reference_id: body.reference_id,
            amount: body.amount,
            test: false,
          };
        return {
          transaction_id: 'txn-dynamic',
          next_actions: {
            qr_payload: png,
            expires_at: String(BigInt(Date.now() + 600000) * 1000000n),
          },
        };
      });
  beforeAll(async () => {
    db = new DataSource({
      type: 'mariadb',
      host: '127.0.0.1',
      port: Number(process.env.BOLD_TEST_DB_PORT),
      username: 'root',
      password: 'bold-isolated-test',
      database: 'bold_isolated',
      entities: [
        new EntitySchema({
          name: 'Order',
          target: Order,
          tableName: 'ppp_orders',
          columns: {
            id: { type: Number, primary: true },
            orderType: { type: String },
            orderStatus: { type: String },
          },
        }),
        BoldQrAttempt,
        BoldOnlineSettings,
        BoldReceipt,
        BoldEvent,
      ],
      synchronize: false,
      timezone: 'Z',
    });
    await db.initialize();
    service = new BoldOnlineService(db, cfg);
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const t of [
      'ppp_bold_qr_attempts',
      'ppp_bold_online_settings',
      'ppp_bold_receipts',
      'ppp_bold_events',
    ])
      await db.query(`DELETE FROM ${t}`);
    await service.saveKey('production-key-fixture');
  });
  it('encrypts the key and never returns it in configuration', async () => {
    const setting = await db
      .getRepository(BoldOnlineSettings)
      .findOneByOrFail({ id: 'production' });
    expect(setting.identityKeyEnc).not.toContain('production-key-fixture');
    expect(JSON.stringify(await service.overview())).not.toContain(
      'production-key-fixture',
    );
  });
  it('creates one remote attempt on repeated concurrent submissions and respects QR expiry shorter than requested', async () => {
    const spy = mockGeneration();
    const input = dto();
    await Promise.all([
      service.create(input, actor),
      service.create(input, actor),
    ]);
    expect(spy).toHaveBeenCalledTimes(2);
    const a = (await db.getRepository(BoldQrAttempt).find())[0];
    expect(a.status).toBe('running');
    expect(a.intentExpiresAt.getTime() - Date.now()).toBeGreaterThan(3500000);
    expect(a.expiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(600000);
    expect(spy.mock.calls[0][2]).toMatchObject({
      expiration_date: expect.any(String),
      amount: { total_amount: 1000 },
    });
  });
  it('does not start the payment step with a sandbox key', async () => {
    const spy = jest
      .spyOn(client, 'boldOnlineRequest')
      .mockImplementation(async (_key, _path, body: any) => ({
        reference_id: body.reference_id,
        amount: body.amount,
        test: true,
      }));
    await expect(service.create(dto(), actor)).rejects.toThrow('pruebas');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await db.getRepository(BoldReceipt).count()).toBe(0);
  });
  it('keeps pending API responses out of the confirmed receipts table', async () => {
    mockGeneration();
    const a = await service.create(dto(), actor);
    jest.spyOn(client, 'boldOnlineRequest').mockResolvedValue({
      reference_id: a.reference,
      transaction_id: 'txn-dynamic',
      status: 'PROCESSING',
      amount: { total_amount: 1000, currency: 'COP' },
    });
    const refreshed = await service.refresh(a.id);
    expect(refreshed.status).toBe('running');
    expect(await db.getRepository(BoldReceipt).count()).toBe(0);
  });
  it('rejects mismatched amount/reference and never creates a confirmed receipt', async () => {
    mockGeneration();
    const a = await service.create(dto(), actor);
    jest.spyOn(client, 'boldOnlineRequest').mockResolvedValue({
      reference_id: a.reference,
      transaction_id: 'txn-dynamic',
      status: 'APPROVED',
      amount: { total_amount: 999, currency: 'COP' },
      payment_method: 'QR',
      attempt_date: new Date().toISOString(),
    });
    await expect(service.refresh(a.id)).rejects.toThrow('no corresponde');
    expect(await db.getRepository(BoldReceipt).count()).toBe(0);
  });
  it('rejects approvals with a missing or implausible payment date', async () => {
    mockGeneration();
    const a = await service.create(dto(), actor);
    jest.spyOn(client, 'boldOnlineRequest').mockResolvedValue({
      reference_id: a.reference,
      transaction_id: 'txn-dynamic',
      status: 'APPROVED',
      amount: { total_amount: 1000, currency: 'COP' },
      payment_method: 'QR',
      attempt_date: null,
    });
    await expect(service.refresh(a.id)).rejects.toThrow('fecha válida');
    expect(await db.getRepository(BoldReceipt).count()).toBe(0);
  });
  it('confirms via authenticated API once, distinguishes webhook receipt and never revives a voided payment', async () => {
    mockGeneration();
    const a = await service.create(dto(), actor);
    const spy = jest.spyOn(client, 'boldOnlineRequest').mockResolvedValue({
      reference_id: a.reference,
      transaction_id: 'txn-dynamic',
      status: 'APPROVED',
      amount: { total_amount: 1000, currency: 'COP' },
      payment_method: 'QR',
      attempt_date: new Date().toISOString(),
    });
    spy.mockClear();
    const result = await service.refresh(a.id);
    expect(result.status).toBe('paid');
    expect(result.webhookReceived).toBe(false);
    await service.refresh(a.id);
    expect(spy).toHaveBeenCalledTimes(1);
    const receipts = db.getRepository(BoldReceipt);
    const receipt = (await receipts.find())[0];
    expect(receipt.confirmationSource).toBe('online_api');
    await db.query(
      "INSERT INTO ppp_orders (id, orderType, orderStatus) VALUES (88, 'delivery', 'inDelivery') ON DUPLICATE KEY UPDATE orderStatus='inDelivery'",
    );
    const claimed = await new BoldService(db, cfg).claim(
      receipt.id,
      { orderId: 88, advanceAmount: 1000 },
      actor,
    );
    expect(claimed.claimedBy).toBe(actor.id);

    await db.getRepository(BoldEvent).insert({
      eventId: 'event-1',
      paymentId: 'txn-dynamic',
      type: 'SALE_APPROVED',
      bodyHash: '0'.repeat(64),
    });
    expect((await service.refresh(a.id)).webhookReceived).toBe(true);
    const voided = await receipts.findOneByOrFail({ id: receipt.id });
    voided.status = 'voided';
    await receipts.save(voided);
    expect((await service.refresh(a.id)).status).toBe('voided');
    expect((await receipts.findOneByOrFail({ id: receipt.id })).status).toBe(
      'voided',
    );
  });
});
