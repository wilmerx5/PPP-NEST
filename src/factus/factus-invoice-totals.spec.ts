import { FactusService } from './factus.service';

const row = (status: string, number: string, amount = 10800) => ({ status, number, amount, issuedAt: '2026-11-01T15:00:00Z' });
// Construct from the prototype so tests do not initialize unrelated external integrations.
function fixture(orders: any[], bulk: any[], getBill: jest.Mock): FactusService {
  return Object.assign(Object.create(FactusService.prototype), {
    orderRepo: { query: jest.fn().mockResolvedValue(orders) },
    standaloneInvoiceRepo: { query: jest.fn().mockResolvedValue(bulk) },
    api: { getBill }, invoiceTaxCache: new Map(),
  });
}
const opts = { from: '2026-11-01', to: '2026-11-30', groupBy: 'month' };
const bill = { taxes: [{ tribute: { code: '04' }, rates: [{ tax_amount: '800.25' }] }] };
describe('electronic invoice totals INC', () => {
  it('combines orders and bulk, excludes cancelled tax, and caches issued breakdowns', async () => {
    const api = jest.fn().mockResolvedValue(bill);
    const sut = fixture([row('accepted', 'A'), row('credit_noted', 'C')], [row('accepted', 'B')], api);
    const result = await sut.electronicInvoiceTotals(opts);
    expect(result.totals.consumptionTaxAmount).toBe(1600.50);
    expect(result.buckets[0].consumptionTaxAmount).toBe(1600.50);
    expect(result.totals.invoicedCount).toBe(2);
    expect(result.totals.netAmount).toBe(21600); // voided invoices were already excluded
    expect(result.totals.voidedAmount).toBe(10800);
    expect(api.mock.calls).toEqual([['A'], ['B']]);
    await sut.electronicInvoiceTotals(opts);
    expect(api).toHaveBeenCalledTimes(2);
  });
  it('does not report incomplete tax as zero or partial total', async () => {
    const api = jest.fn().mockResolvedValueOnce(bill).mockRejectedValueOnce(new Error('unavailable'));
    const result = await fixture([row('accepted', 'A'), row('accepted', 'B')], [], api).electronicInvoiceTotals(opts);
    expect(result.totals.consumptionTaxAmount).toBeNull();
    expect(result.buckets[0].consumptionTaxAmount).toBeNull();
    expect(result.totals.invoicedAmount).toBe(21600);
  });
  it('empty period exports zero without remote queries', async () => {
    const api = jest.fn();
    expect((await fixture([], [], api).electronicInvoiceTotals(opts)).totals.consumptionTaxAmount).toBe(0);
    expect(api).not.toHaveBeenCalled();
  });
});
