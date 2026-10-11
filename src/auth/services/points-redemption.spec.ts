import { PointsService } from './points.service';
import { User } from '../entities/user.entity';
import { UserPoints } from '../entities/user-points.entity';
import { PointRedemption } from '../entities/point-redemption.entity';

function fixture(count = 9, fail: 'voucher' | 'points' | null = null) {
  let points = Array.from({ length: count }, (_, id) => ({ id, isRedeemed: false }));
  let vouchers: any[] = [];
  const userRepo = { findOne: jest.fn(async () => ({ id: 'test-account' })) };
  const pointRepo = {
    find: jest.fn(async () => points.filter(p => !p.isRedeemed).slice(0, 9).map(p => ({ ...p }))),
    save: jest.fn(async (rows: any[]) => {
      if (fail === 'points') throw new Error('point storage failed');
      rows.forEach(row => { points[row.id] = row; });
    }),
  };
  const voucherRepo = {
    findOne: jest.fn(async () => null), create: (row: any) => row,
    save: jest.fn(async (row: any) => {
      if (fail === 'voucher') throw new Error('voucher storage failed');
      vouchers.push(row); return row;
    }),
  };
  const manager = { getRepository: (entity: unknown) => {
    if (entity === User) return userRepo;
    if (entity === UserPoints) return pointRepo;
    if (entity === PointRedemption) return voucherRepo;
    throw new Error('unexpected entity');
  } };
  const transaction = jest.fn(async (run: any) => {
    const before = structuredClone({ points, vouchers });
    try { return await run(manager); } catch (error) {
      points = before.points; vouchers = before.vouchers; throw error;
    }
  });
  const service = new PointsService({} as never, {} as never, {} as never, {} as never, { transaction } as never);
  return { service, userRepo, voucherRepo, transaction, state: () => ({ points, vouchers }) };
}

describe('Canje de puntos: código y descuento atómicos', () => {
  it('genera un código real, deja un punto de diez y bloquea la cuenta durante el canje', async () => {
    const h = fixture(10);
    const voucher = await h.service.redeemPointsForVoucher('test-account');
    expect(voucher.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
    expect(voucher.isUsed).toBe(false);
    expect(voucher.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);
    expect(h.state().points.filter(p => !p.isRedeemed)).toHaveLength(1);
    expect(h.userRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    await expect(h.service.redeemPointsForVoucher('test-account')).rejects.toThrow(/at least 9/);
    expect(h.state().vouchers).toHaveLength(1);
  });
  it.each(['voucher', 'points'] as const)('un fallo de %s conserva los nueve puntos y no deja premio', async fail => {
    const h = fixture(9, fail);
    await expect(h.service.redeemPointsForVoucher('test-account')).rejects.toThrow(/storage failed/);
    expect(h.state().points.filter(p => !p.isRedeemed)).toHaveLength(9);
    expect(h.state().vouchers).toHaveLength(0);
  });
  it('si no logra generar un código único conserva todos los puntos', async () => {
    const h = fixture(9);
    h.voucherRepo.findOne.mockImplementation(async () => ({ code: 'collision' }) as never);
    await expect(h.service.redeemPointsForVoucher('test-account')).rejects.toThrow(/código de premio único/);
    expect(h.state().points.filter(p => !p.isRedeemed)).toHaveLength(9);
    expect(h.state().vouchers).toHaveLength(0);
  });
  it('rechaza ocho puntos sin crear código', async () => {
    const h = fixture(8);
    await expect(h.service.redeemPointsForVoucher('test-account')).rejects.toThrow(/at least 9/);
    expect(h.voucherRepo.save).not.toHaveBeenCalled();
  });
});
