import type { FactusBillDetail } from './types/factus.types';

// Response schema: https://www.factusapi-v2.halltec.co/facturas/descripcion-de-campos/
/** Factus invoice-level taxes only: do not double-count item taxes or include IVA. */
export function consumptionTax(bill: FactusBillDetail): number | null {
  if (!Array.isArray(bill.taxes)) return null;
  let cents = 0;
  for (const tax of bill.taxes) {
    if (!tax.tribute?.code) return null;
    if (tax.tribute.code !== '04' || tax.is_excluded) continue;
    if (!Array.isArray(tax.rates) || !tax.rates.length) return null;
    for (const rate of tax.rates) {
      if (rate.tax_amount == null || !/^\d+(\.\d{1,2})?$/.test(rate.tax_amount)) return null;
      cents += Math.round(Number(rate.tax_amount) * 100);
    }
  }
  return cents / 100;
}
