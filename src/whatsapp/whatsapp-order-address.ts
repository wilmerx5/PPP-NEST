import type { WhatsappSessionData } from './types/whatsapp-session.types';
import type { WhatsappPaymentMethodConfig } from './whatsapp-payment-methods';
import { paymentMethodLabel } from './whatsapp-payment-methods';
import { splitAddressReference } from './whatsapp-address-parts';

/**
 * WhatsApp: no usar order.extras para pago/notas (extras = salsas/productos extra).
 * Pago, cambio y notas van en la dirección con " / ".
 * Ej: "Bosques de Castilla / Efectivo / cambio de 50"
 */
export function composeWhatsappOrderAddress(
  session: Pick<
    WhatsappSessionData,
    'address' | 'paymentMethod' | 'cashChangeFor' | 'customerNotes'
  >,
  paymentMethods: WhatsappPaymentMethodConfig[] = [],
): string {
  const written = splitAddressReference((session.address || '').trim());
  const base = written.reference ? `${written.address} / Ref: ${written.reference}` : written.address;
  const parts: string[] = [];

  if (session.paymentMethod?.trim()) {
    parts.push(paymentMethodLabel(session.paymentMethod, paymentMethods).trim());
  }
  if (session.cashChangeFor?.trim()) {
    parts.push(session.cashChangeFor.trim());
  }
  if (session.customerNotes?.trim()) {
    parts.push(session.customerNotes.trim());
  }

  if (!parts.length) return base;

  const suffix = parts.join(' / ');
  if (!base) return suffix.slice(0, 500);

  const lower = base.toLowerCase();
  // Evitar duplicar si ya se pegó en un reintento
  if (parts.every((p) => lower.includes(p.toLowerCase()))) {
    return base.slice(0, 500);
  }
  return `${base} / ${suffix}`.slice(0, 500);
}
