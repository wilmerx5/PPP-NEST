import { DataSource, EntitySchema } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { BoldService } from './bold.service';
import { BoldReceipt, BoldEvent } from './entities/bold-receipt.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../auth/entities/user.entity';

// Explicit opt-in, isolated disposable MariaDB only; never use application env credentials.
const isolated = process.env.BOLD_TEST_DB_PORT ? describe : describe.skip;
isolated('Bold MariaDB concurrency and lifecycle', () => {
  let db: DataSource;
  let service: BoldService;
  const cfg = new ConfigService({
    BOLD_WEBHOOK_SECRET: 'isolated-secret',
    BOLD_MERCHANT_ID: 'merchant',
    BOLD_STATIC_QR_VERIFIED: 'true',
  });
  const actor = { id: 'driver-1', fullName: 'Domiciliario 1' } as User;
  const orderSchema = new EntitySchema({
    name: 'Order',
    target: Order,
    tableName: 'ppp_orders',
    columns: {
      id: { type: Number, primary: true },
      orderType: { type: String },
      orderStatus: { type: String },
    },
  });
  const payload = (id: string, type = 'SALE_APPROVED', payment = 'pay-1') =>
    Buffer.from(
      JSON.stringify({
        id,
        type,
        data: {
          payment_id: payment,
          merchant_id: 'merchant',
          created_at: '2026-11-01T18:00:00-05:00',
          amount: { total: 35000, currency: 'COP' },
          payment_method: 'QR',
        },
      }),
    );
  const send = (raw: Buffer) =>
    service.receive(
      raw,
      createHmac('sha256', 'isolated-secret')
        .update(raw.toString('base64'))
        .digest('hex'),
    );
  beforeAll(async () => {
    db = new DataSource({
      type: 'mariadb',
      host: '127.0.0.1',
      port: Number(process.env.BOLD_TEST_DB_PORT),
      username: 'root',
      password: 'bold-isolated-test',
      database: 'bold_isolated',
      entities: [BoldReceipt, BoldEvent, orderSchema],
      synchronize: false,
      timezone: 'Z',
    });
    await db.initialize();
    // Schema is installed from the actual migration by the test launcher.
    service = new BoldService(db, cfg);
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  beforeEach(async () => {
    await db.query('DELETE FROM ppp_bold_events');
    await db.query('DELETE FROM ppp_bold_receipts');
    await db.query('DELETE FROM ppp_orders');
    await db.query(
      "INSERT INTO ppp_orders (id, orderType, orderStatus) VALUES (1,'delivery','inDelivery'),(2,'delivery','inDelivery'),(3,'pickup','completed')",
    );
  });
  it('deduplicates concurrent webhooks and refuses unsigned input', async () => {
    await expect(
      service.receive(payload('bad'), '0'.repeat(64)),
    ).rejects.toThrow();
    await Promise.all([send(payload('evt-1')), send(payload('evt-1'))]);
    expect(await db.getRepository(BoldReceipt).count()).toBe(1);
    expect(await db.getRepository(BoldEvent).count()).toBe(1);
  });
  it('allows one claimant and one cash return under simultaneous requests', async () => {
    await send(payload('evt-1'));
    const row = (await db.getRepository(BoldReceipt).find())[0];
    const claims = await Promise.allSettled([
      service.claim(row.id, { orderId: 1, advanceAmount: 30000 }, actor),
      service.claim(row.id, { orderId: 2, advanceAmount: 30000 }, {
        ...actor,
        id: 'driver-2',
      } as User),
    ]);
    expect(claims.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const returns = await Promise.allSettled([
      service.returnAdvance(row.id, actor),
      service.returnAdvance(row.id, actor),
    ]);
    expect(returns.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const stored = await db
      .getRepository(BoldReceipt)
      .findOneByOrFail({ id: row.id });
    expect(stored.returnedAt).not.toBeNull();
    expect(Number(stored.advanceAmount)).toBe(30000);
  });
  it('blocks unverified pilot, excessive advances, non-delivery and duplicate order', async () => {
    await send(payload('evt-1'));
    await send(payload('evt-2', 'SALE_APPROVED', 'pay-2'));
    const [a, b] = await db
      .getRepository(BoldReceipt)
      .find({ order: { paymentId: 'ASC' } });
    await expect(
      service.claim(a.id, { orderId: 1, advanceAmount: 40000 }, actor),
    ).rejects.toThrow();
    await expect(
      service.claim(a.id, { orderId: 3, advanceAmount: 30000 }, actor),
    ).rejects.toThrow();
    cfg.set('BOLD_STATIC_QR_VERIFIED', 'false');
    await expect(
      service.claim(a.id, { orderId: 1, advanceAmount: 30000 }, actor),
    ).rejects.toThrow();
    cfg.set('BOLD_STATIC_QR_VERIFIED', 'true');
    await service.claim(a.id, { orderId: 1, advanceAmount: 30000 }, actor);
    await expect(
      service.claim(b.id, { orderId: 1, advanceAmount: 30000 }, actor),
    ).rejects.toThrow();
  });
  it('keeps void final despite out-of-order approval and preserves cash audit', async () => {
    await send(payload('evt-1'));
    const row = (await db.getRepository(BoldReceipt).find())[0];
    await service.claim(row.id, { orderId: 1, advanceAmount: 30000 }, actor);
    await service.returnAdvance(row.id, actor);
    await send(payload('evt-2', 'VOID_APPROVED'));
    await send(payload('evt-3'));
    const stored = await db
      .getRepository(BoldReceipt)
      .findOneByOrFail({ id: row.id });
    expect(stored.status).toBe('voided');
    expect(stored.returnedAt).not.toBeNull();
    await expect(service.returnAdvance(row.id, actor)).rejects.toThrow();
  });
});
