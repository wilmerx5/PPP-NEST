import type { WhatsappSessionData } from './types/whatsapp-session.types';

/** Read-only references for an inquiry; never pick the first ambiguous candidate. */
export function dialogueProductReferences(session: WhatsappSessionData): number[] {
  const unique = (ids: number[]) => [...new Set(ids)];
  if (session.pendingAttribute) return [session.pendingAttribute.productId];
  if (session.pendingMatch) return unique(session.pendingMatch.candidates.map(item => item.id));
  if (session.pendingMultiOrder) return unique([
    ...session.pendingMultiOrder.ambiguous.flatMap(group => group.candidates.map(item => item.id)),
    ...session.pendingMultiOrder.needsAttributes.map(item => item.productId),
    ...session.pendingMultiOrder.confident.map(item => item.productId),
  ]);
  if (session.pendingAddOffer) return unique(session.pendingAddOffer.productIds?.length
    ? session.pendingAddOffer.productIds : [session.pendingAddOffer.productId]);
  if (session.productFocus) return [session.productFocus.productId];
  return unique(session.cart.map(item => item.productId));
}
