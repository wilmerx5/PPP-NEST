import type { DeliveryFeeTier } from '../whatsapp/whatsapp-delivery-fee';

/** Tarifas de domicilio para pedidos online (ppp-front). */
export const WEB_DELIVERY_FEE_TIERS: DeliveryFeeTier[] = [
  { maxKm: 4, fee: 4000 },
  { maxKm: 6, fee: 6000 },
];

export const WEB_DELIVERY_MAX_KM = 6;
export const WEB_DELIVERY_DEFAULT_FEE = 4000;

export function formatWebDeliveryTiersHint(
  tiers: DeliveryFeeTier[],
  maxKm: number,
): string {
  const sorted = [...tiers].sort((a, b) => a.maxKm - b.maxKm);
  if (!sorted.length) {
    return `Domicilio según distancia (máx. ${maxKm} km)`;
  }
  const parts: string[] = [];
  let prev = 0;
  for (const t of sorted) {
    if (prev === 0) {
      parts.push(`Hasta ${t.maxKm} km: $${t.fee.toLocaleString('es-CO')}`);
    } else {
      parts.push(`Más de ${prev} km: $${t.fee.toLocaleString('es-CO')}`);
    }
    prev = t.maxKm;
  }
  return `${parts.join(' · ')} (máx. ${maxKm} km)`;
}

/** Texto por defecto si aún no hay config en DB. */
export function formatWebDeliveryTiersHintDefault(): string {
  return formatWebDeliveryTiersHint(WEB_DELIVERY_FEE_TIERS, WEB_DELIVERY_MAX_KM);
}
