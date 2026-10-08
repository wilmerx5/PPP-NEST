import type { IncomingWhatsappMessage } from './whatsapp-meta.service';

/**
 * Espera de silencio antes de procesar textos del mismo waId.
 * ~3s deja tiempo a burbujas seguidas (calle+apto, pollo+gaseosa, etc.).
 */
export const WHATSAPP_INBOUND_COALESCE_MS = 3000;

/** confirm / número / reinicia: un poco más rápido para no sentir el bot “trabado”. */
export const WHATSAPP_INBOUND_COALESCE_QUICK_MS = 900;

/** Máximo de textos a fusionar en un solo turno (anti-abuso). */
export const WHATSAPP_INBOUND_COALESCE_MAX = 8;

export function isCoalesceableInboundMessage(msg: IncomingWhatsappMessage): boolean {
  if (msg.messageType !== 'text') return false;
  if (msg.mediaId) return false;
  return Boolean((msg.text || '').trim());
}

/** Respuestas de una palabra / dígito: no hace falta esperar 3s. */
export function isQuickCoalesceText(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  return /^(confirmar|confirma|confirm|listo|ok|okay|si|sí|no|reinicia|reiniciar|reinicio|reset|asesor|\d{1,2})$/i.test(
    t,
  );
}

export function coalesceDelayMsForText(text: string): number {
  if (isQuickCoalesceText(text)) return WHATSAPP_INBOUND_COALESCE_QUICK_MS;
  return WHATSAPP_INBOUND_COALESCE_MS;
}

/** Si el lote mezcla un “confirmar” con un texto largo, gana el delay largo. */
export function coalesceDelayMsForBatch(messages: IncomingWhatsappMessage[]): number {
  if (!messages.length) return WHATSAPP_INBOUND_COALESCE_MS;
  return Math.max(...messages.map((m) => coalesceDelayMsForText(m.text || '')));
}

/**
 * Une varios textos rápidos en un solo inbound para una sola respuesta.
 * Ej.: calle + "Torre 9 502" → un mensaje multilínea.
 */
export function mergeCoalescedInboundMessages(
  messages: IncomingWhatsappMessage[],
): IncomingWhatsappMessage {
  if (messages.length === 0) {
    throw new Error('mergeCoalescedInboundMessages: empty batch');
  }
  if (messages.length === 1) return messages[0];

  // Meta puede reenviar el mismo messageId mientras el lote sigue pendiente.
  // Deduplicar por identificador, no solo por texto consecutivo: A, B, A
  // debe procesarse como A, B (nunca volver a sumar el pedido de A).
  const seenMessageIds = new Set<string>();
  const uniqueMessages = messages.filter((m) => {
    const id = (m.messageId || '').trim();
    if (!id) return true;
    if (seenMessageIds.has(id)) return false;
    seenMessageIds.add(id);
    return true;
  });

  const texts = uniqueMessages
    .map((m) => (m.text || '').trim())
    .filter(Boolean);
  const uniqueOrdered: string[] = [];
  for (const t of texts) {
    if (uniqueOrdered[uniqueOrdered.length - 1] === t) continue;
    uniqueOrdered.push(t);
  }

  const first = uniqueMessages[0];
  const last = uniqueMessages[uniqueMessages.length - 1];
  return {
    ...first,
    messageId: first.messageId || last.messageId,
    text: uniqueOrdered.join('\n'),
    timestamp: last.timestamp || first.timestamp,
    raw: {
      ...first.raw,
      coalescedFrom: uniqueMessages.map((m) => m.messageId).filter(Boolean),
      coalescedCount: uniqueMessages.length,
    },
  };
}
