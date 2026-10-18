import type { WhatsappCartItem } from './types/whatsapp-session.types';
import type { UnitOptionEdit } from './whatsapp-unit-option-plan';

const normalize = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** A model-supplied index is insufficient when the customer has several variants.
 * Bind the source to a displayed row or a unique current option, never to the
 * requested destination alone. No-op edits are checked separately by the caller.
 */
export function hasExplicitUnitOptionSource(text: string, cart: WhatsappCartItem[], edit: UnitOptionEdit): boolean {
  const source = cart[edit.cartLineIndex];
  if (!source || source.productId !== edit.productId) return false;
  const peers = cart.filter((line, index) => index !== edit.cartLineIndex && line.productId === source.productId);
  if (!peers.length) return true;
  const message = normalize(text);
  // Negated or preservation references do not positively identify a source.
  // Prefer clarification over interpreting which clause owns such a reference.
  if (/\b(?:no|excepto|deja|dejes|conserva|conserves)\b/.test(message)) return false;
  const references = [...message.matchAll(/\b(?:linea|fila|item|numero)\s+(\d+)\b/g)];
  if (references.some(match => Number(match[1]) === edit.cartLineIndex + 1)) return true;
  const destinations = new Set(edit.attributes.map(attribute => normalize(attribute.attributeValue)));
  return (source.attributes || []).some(attribute => {
    const value = normalize(attribute.attributeValue);
    if (!value || destinations.has(value) || peers.some(line => (line.attributes || []).some(other => normalize(other.attributeValue) === value))) return false;
    // Optional plural suffix supports human references such as "los originales".
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b(?:de|entre) (?:los |las |el |la )?(?:de )?${escaped}(?:s|es)?\\b`).test(message);
  });
}
