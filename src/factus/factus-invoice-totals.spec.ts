import { FactusService } from './factus.service';
const row = (status: string, number: string) => ({ status, number, amount: 10800, issuedAt: '2026-11-01T15:00:00Z' });
const opts = { from: '2026-11-01', to: '2026-11-30', groupBy: 'month' };
function fixture(orders: any[], bulk: any[], cached: any[]) {
  return Object.assign(Object.create(FactusService.prototype), {
    orderRepo: { query: jest.fn().mockResolvedValueOnce(orders).mockResolvedValue(cached) },
    standaloneInvoiceRepo: { query: jest.fn().mockResolvedValue(bulk) },
    auth: { getBaseUrl: () => 'production' }, api: { getBill: jest.fn() },
    queueInvoiceTaxes: jest.fn(),
  });
}
describe('durable invoice tax reporting', () => {
  it('combines snapshots, excludes cancelled tax and avoids double subtraction', async () => {
    const sut = fixture([row('accepted', 'A'), row('credit_noted', 'C')], [row('accepted', 'B')],
      [{ number: 'A', value: '800.25' }, { number: 'B', value: '800.25' }]);
    const result = await sut.electronicInvoiceTotals(opts);
    expect(result.totals.consumptionTaxAmount).toBe(1600.5);
    expect(result.totals.netAmount).toBe(21600);
    expect(result.totals.voidedAmount).toBe(10800);
    expect(sut.api.getBill).not.toHaveBeenCalled();
    expect(sut.queueInvoiceTaxes).toHaveBeenCalledWith([]);
  });
  it('returns promptly and queues only missing distinct invoices', async () => {
    const sut = fixture([row('accepted', 'A'), row('accepted', 'B')], [row('accepted', 'B')], [{ number: 'A', value: 800 }]);
    expect((await sut.electronicInvoiceTotals(opts)).totals.consumptionTaxAmount).toBeNull();
    expect(sut.queueInvoiceTaxes).toHaveBeenCalledWith(['B']);
    expect(sut.api.getBill).not.toHaveBeenCalled();
  });
  it('empty period returns verified zero', async () => {
    expect((await fixture([], [], []).electronicInvoiceTotals(opts)).totals.consumptionTaxAmount).toBe(0);
  });
});
describe('paced tax hydration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  function worker() {
    return Object.assign(Object.create(FactusService.prototype), {
      taxQueue: new Set(), taxUnavailableUntil: new Map(), taxWorkerRunning: false, taxRetryAt: 0,
      auth: { getBaseUrl: () => 'production' }, logger: { warn: jest.fn() },
      orderRepo: { query: jest.fn().mockResolvedValue([]) },
      api: { getBill: jest.fn().mockResolvedValue({ taxes: [{ tribute: { code: '04' }, rates: [{ tax_amount: '80.25' }] }] }) },
    });
  }
  it('deduplicates concurrent reports and spaces requests, persisting issued values', async () => {
    const sut = worker();
    sut.queueInvoiceTaxes(['A', 'B']); sut.queueInvoiceTaxes(['A', 'B']);
    await jest.advanceTimersByTimeAsync(1499);
    expect(sut.api.getBill).toHaveBeenCalledTimes(1);
    expect(sut.orderRepo.query.mock.calls[0][1]).toEqual(['production', 'A', 80.25]);
    await jest.advanceTimersByTimeAsync(1501);
    expect(sut.api.getBill.mock.calls).toEqual([['A'], ['B']]);
    expect(sut.taxWorkerRunning).toBe(false);
  });
  it('skips a missing historical document without blocking valid invoices', async () => {
    const sut = worker();
    sut.api.getBill.mockRejectedValueOnce({ factusStatus: 404 });
    sut.queueInvoiceTaxes(['OLD', 'B']); await jest.advanceTimersByTimeAsync(3000);
    expect(sut.api.getBill.mock.calls).toEqual([['OLD'], ['B']]);
    sut.queueInvoiceTaxes(['OLD']);
    expect(sut.api.getBill).toHaveBeenCalledTimes(2);
    expect(sut.orderRepo.query).toHaveBeenCalledTimes(1);
  });
  it('stops the queue on 429 and prevents immediate retries', async () => {
    const sut = worker(); sut.api.getBill.mockRejectedValue(new Error('429'));
    sut.queueInvoiceTaxes(['A', 'B']); await jest.advanceTimersByTimeAsync(0);
    sut.queueInvoiceTaxes(['A', 'B']);
    expect(sut.api.getBill).toHaveBeenCalledTimes(1);
    expect(sut.taxQueue.size).toBe(0);
    await jest.advanceTimersByTimeAsync(65000);
    sut.queueInvoiceTaxes(['A']); await jest.advanceTimersByTimeAsync(0);
    expect(sut.api.getBill).toHaveBeenCalledTimes(2);
  });
});
