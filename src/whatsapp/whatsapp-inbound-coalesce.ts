import type { IncomingWhatsappMessage } from './whatsapp-meta.service';

/** Espera de silencio antes de procesar textos seguidos del mismo waId. */
export const WHATSAPP_INBOUND_COALESCE_MS = 1200;

/** Máximo de textos a fusionar en un solo turno (anti-abuso). */
export const WHATSAPP_INBOUND_COALESCE_MAX = 8;

export function isCoalesceableInboundMessage(msg: IncomingWhatsappMessage): boolean {
  if (msg.messageType !== 'text') return false;
  if (msg.mediaId) return false;
  return Boolean((msg.text || '').trim());
}

/**
 * Une varios textos rápidos en un solo inbound para una sola respuesta.
 * Ej.: calle + "Apartamento 505 Torre 2" → un mensaje multilínea.
 */
export function mergeCoalescedInboundMessages(
  messages: IncomingWhatsappMessage[],
): IncomingWhatsappMessage {
  if (messages.length === 0) {
    throw new Error('mergeCoalescedInboundMessages: empty batch');
  }
  if (messages.length === 1) return messages[0];

  const texts = messages
    .map((m) => (m.text || '').trim())
    .filter(Boolean);
  const uniqueOrdered: string[] = [];
  for (const t of texts) {
    if (uniqueOrdered[uniqueOrdered.length - 1] === t) continue;
    uniqueOrdered.push(t);
  }

  const first = messages[0];
  const last = messages[messages.length - 1];
  return {
    ...first,
    messageId: first.messageId || last.messageId,
    text: uniqueOrdered.join('\n'),
    timestamp: last.timestamp || first.timestamp,
    raw: {
      ...first.raw,
      coalescedFrom: messages.map((m) => m.messageId).filter(Boolean),
      coalescedCount: messages.length,
    },
  };
}
