import 'reflect-metadata';
import { DataSource, EntitySchema } from 'typeorm';
import { PointsService } from '../src/auth/services/points.service';
import { User } from '../src/auth/entities/user.entity';
import { UserPoints } from '../src/auth/entities/user-points.entity';
import { PointRedemption } from '../src/auth/entities/point-redemption.entity';

if (process.env.WHATSAPP_DB_TEST !== '1' ||
    !['127.0.0.1', 'localhost', '::1'].includes(process.env.TEST_DB_HOST || '') ||
    !/^ppp_test_whatsapp(?:_[a-z0-9]+)?$/.test(process.env.TEST_DB_DATABASE || '')) {
  throw new Error('Requires an explicitly selected local throwaway WhatsApp database');
}
// Minimal schema for the real transaction/repositories; no customer or order integrations.
const entities = [
  new EntitySchema({ name: 'User', target: User, tableName: 'test_users', columns: {
    id: { type: String, primary: true },
  } }),
  new EntitySchema({ name: 'UserPoints', target: UserPoints, tableName: 'test_points', columns: {
    id: { type: Number, primary: true, generated: true }, userId: { type: String },
    isCanceled: { type: Boolean, default: false }, isRedeemed: { type: Boolean, default: false },
    createdAt: { type: Date, createDate: true },
  } }),
  new EntitySchema({ name: 'PointRedemption', target: PointRedemption, tableName: 'test_redemptions', columns: {
    id: { type: Number, primary: true, generated: true }, userId: { type: String },
    code: { type: String, length: 12, unique: true }, isUsed: { type: Boolean, default: false },
    expiresAt: { type: Date, nullable: true },
    usedAt: { type: Date, nullable: true }, usedInOrderId: { type: Number, nullable: true },
  } }),
];

describe('Canje real en MariaDB aislada', () => {
  let db: DataSource;
  let service: PointsService;
  beforeAll(async () => {
    db = new DataSource({ type: 'mariadb', host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT), username: process.env.TEST_DB_USERNAME,
      password: process.env.TEST_DB_PASSWORD, database: process.env.TEST_DB_DATABASE,
      entities, synchronize: true, extra: { connectionLimit: 4 } });
    await db.initialize();
    service = new PointsService(db.getRepository(UserPoints), db.getRepository(PointRedemption),
      db.getRepository(User), {} as never, db);
  });
  beforeEach(async () => {
    await db.getRepository(PointRedemption).clear();
    await db.getRepository(UserPoints).clear();
    await db.getRepository(User).clear();
    await db.getRepository(User).save({ id: 'isolated-account' });
    await db.getRepository(UserPoints).save(Array.from({ length: 9 }, () => ({ userId: 'isolated-account' })));
  });
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  it('dos redenciones simultáneas producen un premio y un rechazo, sin saldo negativo', async () => {
    const results = await Promise.allSettled([
      service.redeemPointsForVoucher('isolated-account'),
      service.redeemPointsForVoucher('isolated-account'),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await db.getRepository(PointRedemption).count()).toBe(1);
    expect(await service.getAvailablePoints('isolated-account')).toBe(0);
  });
  it('dos consumos simultáneos del código lo vinculan a una sola orden', async () => {
    const voucher = await service.redeemPointsForVoucher('isolated-account');
    const results = await Promise.allSettled([
      service.applyRedemptionToOrder(voucher.code, 101), service.applyRedemptionToOrder(voucher.code, 102),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    const used = await db.getRepository(PointRedemption).findOneByOrFail({ code: voucher.code });
    expect(used.isUsed).toBe(true);
    expect([101, 102]).toContain(used.usedInOrderId);
  });
  it('un fallo al guardar puntos revierte también el premio ya guardado', async () => {
    await db.query("CREATE TRIGGER reject_redemption_update BEFORE UPDATE ON test_points FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic persistence failure'");
    try {
      await expect(service.redeemPointsForVoucher('isolated-account')).rejects.toThrow(/synthetic persistence failure/);
      expect(await db.getRepository(PointRedemption).count()).toBe(0);
      expect(await service.getAvailablePoints('isolated-account')).toBe(9);
    } finally { await db.query('DROP TRIGGER reject_redemption_update'); }
  });
});
