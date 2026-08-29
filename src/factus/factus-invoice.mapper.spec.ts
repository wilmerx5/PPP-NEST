import {
  factusOrderIssueDateYmd,
  formatYmdInTimeZone,
} from './factus-invoice.mapper';

describe('factusOrderIssueDateYmd', () => {
  it('usa America/Bogota (no UTC) — 02:51 UTC del 29 aún es 28 en Colombia', () => {
    // 2026-08-29 02:51:27 UTC = 2026-08-28 21:51 Colombia
    const utcMorning = new Date('2026-08-29T02:51:27.000Z');
    expect(formatYmdInTimeZone(utcMorning, 'America/Bogota')).toBe('2026-08-28');
    expect(formatYmdInTimeZone(utcMorning, 'UTC')).toBe('2026-08-29');
  });

  it('nunca envía fecha posterior al hoy de Bogotá', () => {
    const nowBogotaEvening = new Date('2026-08-28T23:30:00.000-05:00');
    // Pedido “futuro” por bug de TZ
    const futureUtcDay = new Date('2026-08-29T02:00:00.000Z');
    expect(factusOrderIssueDateYmd(futureUtcDay, nowBogotaEvening)).toBe('2026-08-28');
  });

  it('respeta fecha de pedido histórica en Bogotá', () => {
    const now = new Date('2026-08-29T15:00:00.000-05:00');
    const orderCreated = new Date('2026-08-27T10:00:00.000-05:00');
    expect(factusOrderIssueDateYmd(orderCreated, now)).toBe('2026-08-27');
  });
});
