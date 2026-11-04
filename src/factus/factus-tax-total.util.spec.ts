import { consumptionTax } from './factus-tax-total.util';

describe('issued invoice consumption tax', () => {
  it('sums INC rates without including IVA', () => {
    expect(consumptionTax({ taxes: [
      { tribute: { code: '01' }, rates: [{ tax_amount: '190.00' }] },
      { tribute: { code: '04' }, rates: [{ tax_amount: '80.12' }, { tax_amount: '20.34' }] },
    ] })).toBe(100.46);
  });
  it('distinguishes absent breakdown from a verified zero', () => {
    expect(consumptionTax({})).toBeNull();
    expect(consumptionTax({ taxes: [] })).toBe(0);
    expect(consumptionTax({ taxes: [{ tribute: { code: '04' } }] })).toBeNull();
    expect(consumptionTax({ taxes: [{ tribute: { code: '04' }, rates: [{ tax_amount: '' }] }] })).toBeNull();
  });
  it('ignores excluded INC', () => {
    expect(consumptionTax({ taxes: [{ tribute: { code: '04' }, is_excluded: true }] })).toBe(0);
  });
});
