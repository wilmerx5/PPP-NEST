import {
  factusInvoiceTotalFromItems,
  factusMoney,
  factusOrderIssueDateYmd,
  factusRound2,
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
    const futureUtcDay = new Date('2026-08-29T02:00:00.000Z');
    expect(factusOrderIssueDateYmd(futureUtcDay, nowBogotaEvening)).toBe('2026-08-28');
  });

  it('respeta fecha de pedido histórica en Bogotá', () => {
    const now = new Date('2026-08-29T15:00:00.000-05:00');
    const orderCreated = new Date('2026-08-27T10:00:00.000-05:00');
    expect(factusOrderIssueDateYmd(orderCreated, now)).toBe('2026-08-27');
  });
});

describe('factusInvoiceTotalFromItems (payment vs total)', () => {
  it('alineado con Factus: redondeo por línea evita 49999.99', () => {
    // Sin redondeo por línea: 42016.81 * 1.19 = 50000.0039 → a veces 49999.99 en float
    const net = factusRound2(50000 / 1.19);
    const items = [
      {
        quantity: '1.00',
        price: factusMoney(net),
        taxes: [{ rate: '19.00' }],
      },
    ];
    const total = factusInvoiceTotalFromItems(items);
    expect(factusMoney(total)).toBe(factusMoney(net + factusRound2(net * 0.19)));
    // payment_details debe ser exactamente ese total (2 decimales)
    expect(factusMoney(total)).toMatch(/^\d+\.\d{2}$/);
  });

  it('suma varias líneas redondeando impuesto por ítem', () => {
    const items = [
      { quantity: '1.00', price: '10000.00', taxes: [{ rate: '19.00' }] },
      { quantity: '2.00', price: '8500.00', taxes: [{ rate: '19.00' }] },
    ];
    // 10000+1900 + 17000+3230 = 32130
    expect(factusInvoiceTotalFromItems(items)).toBe(32130);
    expect(factusMoney(factusInvoiceTotalFromItems(items))).toBe('32130.00');
  });

  it('reproduce el caso Esperado 50000 vs Enviado 49999.99', () => {
    // Total flotante sin redondear impuesto por línea
    const net = 42016.81;
    const floatTotal = net + net * 0.19; // 50000.0039...
    // Bug viejo: a veces Math/float + toFixed mal → 49999.99
    const buggy =
      Math.round((net * 1.19 - 0.01 + Number.EPSILON) * 100) / 100; // simula 49999.99
    expect(buggy).toBe(49999.99);

    const items = [
      { quantity: '1.00', price: '42016.81', taxes: [{ rate: '19.00' }] },
    ];
    const fixed = factusInvoiceTotalFromItems(items);
    // Factus: neto 42016.81 + IVA round(7983.1939)=7983.19 → 50000.00
    expect(fixed).toBe(50000);
    expect(factusMoney(fixed)).toBe('50000.00');
    expect(factusMoney(fixed)).not.toBe('49999.99');
    expect(floatTotal).toBeGreaterThan(50000);
  });
});
