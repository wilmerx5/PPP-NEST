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

/**
 * Varias fotos de un mismo carrito llegan como webhooks separados.
 * Se espera este silencio antes de responder, para mandar un solo resumen.
 */
export const WHATSAPP_IMAGE_BURST_MS = 2000;

export function isImageBurstMessage(msg: IncomingWhatsappMessage): boolean {
  if (msg.messageType === 'image' && !!msg.mediaId) return true;
  // El álbum de WhatsApp a veces llega primero como tipo no soportado.
  return msg.messageType === 'other' || msg.messageType === 'sticker';
}

/** Un álbum ya armó el pedido: una sola burbuja, o ninguna si aún llega otra foto. */
export function collapseImageBurstReplies(input: {
  /** Only a successfully interpreted order photo can replace its acknowledgements. */
  resolvedOrderImage?: boolean;
  /** Suppress only an unsupported envelope followed by an actual photo, never image-read errors. */
  unsupportedEnvelopeSupersededByImage?: boolean;
  newerArrived: boolean;
  hasCart: boolean;
  pending: boolean;
  replies: string[];
  summary: string;
}): string[] {
  if (input.unsupportedEnvelopeSupersededByImage) return [];
  if (!input.resolvedOrderImage) return input.replies;
  if (input.newerArrived) return [];
  if (input.pending || !input.hasCart || !input.summary.trim()) return input.replies;
  return [input.summary.trim()];
}

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
  const profileNames = [...new Set(uniqueMessages
    .filter(message => message.waId === first.waId && message.profileName)
    .map(message => message.profileName))];
  return {
    ...first,
    profileName: profileNames.length === 1 ? profileNames[0] : undefined,
    messageId: first.messageId || last.messageId,
    text: uniqueOrdered.join('\n'),
    timestamp: last.timestamp || first.timestamp,
    raw: {
      ...first.raw,
      coalescedFrom: uniqueMessages.map((m) => m.messageId).filter(Boolean),
      coalescedCount: uniqueMessages.length,
      // ID + texto de cada burbuja: permite reclamar individualmente y
      // reconstruir solo los fragmentos nuevos tras un reenvío parcial de Meta.
      coalescedMessages: uniqueMessages.map((m) => ({
        messageId: m.messageId,
        text: (m.text || '').trim(),
        timestamp: m.timestamp,
        raw: m.raw,
      })),
    },
  };
}
