import {
  fillInvoiceFromCatalog,
  planBulkInvoicesFromCatalog,
  splitUnevenTargets,
} from './factus-bulk-select.util';

describe('factus-bulk-select (catalog)', () => {
  const catalog = [
    { id: 1, name: 'A', code: 1, price: 20_000 },
    { id: 2, name: 'B', code: 2, price: 35_000 },
    { id: 3, name: 'C', code: 3, price: 12_000 },
    { id: 4, name: 'D', code: 4, price: 45_000 },
    { id: 5, name: 'E', code: 5, price: 28_000 },
  ];

  it('splitUnevenTargets no hace partes iguales', () => {
    const parts = splitUnevenTargets(1_000_000, 4);
    expect(parts).toHaveLength(4);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1_000_000);
    const unique = new Set(parts);
    // Con jitter casi nunca las 4 son iguales; si lo fueran, falla el test de variedad
    expect(unique.size).toBeGreaterThan(1);
  });

  it('fillInvoiceFromCatalog se acerca al objetivo', () => {
    const lines = fillInvoiceFromCatalog(100_000, catalog);
    const sum = lines.reduce((s, l) => s + l.lineTotal, 0);
    expect(lines.length).toBeGreaterThan(0);
    expect(sum).toBeGreaterThan(50_000);
    expect(sum).toBeLessThanOrEqual(100_000 * 1.1);
  });

  it('plan 1M / 4 facturas: 4 planes con montos distintos', () => {
    const plan = planBulkInvoicesFromCatalog(1_000_000, 4, catalog, 0.12);
    expect(plan.invoices).toHaveLength(4);
    expect(plan.invoices.every((inv) => inv.lines.length > 0)).toBe(true);
    const sums = plan.invoices.map((i) => i.sum);
    expect(new Set(sums).size).toBeGreaterThan(1);
    expect(Math.abs(plan.plannedSum - 1_000_000) / 1_000_000).toBeLessThan(0.15);
  });
});
