import {
  coalesceDelayMsForBatch,
  coalesceDelayMsForText,
  isCoalesceableInboundMessage,
  isQuickCoalesceText,
  mergeCoalescedInboundMessages,
  WHATSAPP_INBOUND_COALESCE_MS,
  WHATSAPP_INBOUND_COALESCE_QUICK_MS,
} from './whatsapp-inbound-coalesce';
import type { IncomingWhatsappMessage } from './whatsapp-meta.service';

function textMsg(partial: Partial<IncomingWhatsappMessage> & { text: string }): IncomingWhatsappMessage {
  return {
    waId: '573001112233',
    phoneE164: '+573001112233',
    messageId: `wamid.${Math.random().toString(36).slice(2)}`,
    messageType: 'text',
    timestamp: 1,
    raw: {},
    ...partial,
  };
}

describe('whatsapp-inbound-coalesce', () => {
  it('fusiona calle + apartamento en un solo texto multilínea', () => {
    const merged = mergeCoalescedInboundMessages([
      textMsg({
        messageId: 'a',
        text: 'Cra. 80b #6-94\nConjunto residencial Balcones de techo',
        timestamp: 1,
      }),
      textMsg({
        messageId: 'b',
        text: 'Apartamento 505 Torre 2',
        timestamp: 2,
      }),
    ]);

    expect(merged.text).toBe(
      'Cra. 80b #6-94\nConjunto residencial Balcones de techo\nApartamento 505 Torre 2',
    );
    expect(merged.messageId).toBe('a');
    expect((merged.raw as { coalescedCount?: number }).coalescedCount).toBe(2);
  });

  it('fusiona calle + torre 9 502', () => {
    const merged = mergeCoalescedInboundMessages([
      textMsg({ text: 'Cra. 80b #6-94\nConjunto residencial Balcones de techo' }),
      textMsg({ text: 'torre 9 502' }),
    ]);
    expect(merged.text).toContain('torre 9 502');
    expect(merged.text.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('no duplica el mismo texto enviado dos veces', () => {
    const merged = mergeCoalescedInboundMessages([
      textMsg({ text: 'confirmar' }),
      textMsg({ text: 'confirmar' }),
    ]);
    expect(merged.text).toBe('confirmar');
  });

  it('deduplica reintentos de Meta por messageId aunque haya otros textos entre medio', () => {
    const merged = mergeCoalescedInboundMessages([
      textMsg({ messageId: 'wamid.a', text: 'dos ajiacos', timestamp: 1 }),
      textMsg({ messageId: 'wamid.b', text: 'la dirección es calle 10', timestamp: 2 }),
      textMsg({ messageId: 'wamid.a', text: 'dos ajiacos', timestamp: 3 }),
    ]);
    expect(merged.text).toBe('dos ajiacos\nla dirección es calle 10');
    expect(merged.timestamp).toBe(2);
    expect((merged.raw as { coalescedCount?: number }).coalescedCount).toBe(2);
    expect((merged.raw as { coalescedFrom?: string[] }).coalescedFrom).toEqual([
      'wamid.a',
      'wamid.b',
    ]);
  });

  it('no confunde dos IDs distintos con el mismo contenido: conserva trazabilidad del lote', () => {
    const merged = mergeCoalescedInboundMessages([
      textMsg({ messageId: 'wamid.1', text: 'confirmar' }),
      textMsg({ messageId: 'wamid.2', text: 'confirmar' }),
    ]);
    expect(merged.text).toBe('confirmar');
    expect((merged.raw as { coalescedFrom?: string[] }).coalescedFrom).toEqual([
      'wamid.1',
      'wamid.2',
    ]);
  });

  it('conserva la relación entre cada ID y su texto para deduplicación parcial', () => {
    const merged = mergeCoalescedInboundMessages([
      textMsg({ messageId: 'wamid.a', text: 'un ajiaco', timestamp: 1 }),
      textMsg({ messageId: 'wamid.b', text: 'y una pechuga', timestamp: 2 }),
    ]);
    expect((merged.raw as any).coalescedMessages).toEqual([
      expect.objectContaining({ messageId: 'wamid.a', text: 'un ajiaco', timestamp: 1 }),
      expect.objectContaining({ messageId: 'wamid.b', text: 'y una pechuga', timestamp: 2 }),
    ]);
  });

  it('solo coalesces textos sin media', () => {
    expect(isCoalesceableInboundMessage(textMsg({ text: 'hola' }))).toBe(true);
    expect(
      isCoalesceableInboundMessage({
        ...textMsg({ text: '🎤' }),
        messageType: 'audio',
        mediaId: 'x',
      }),
    ).toBe(false);
  });

  it('~3s para todo; quick solo confirm/número/reinicia', () => {
    expect(coalesceDelayMsForText('Cra. 80b #6-94')).toBe(WHATSAPP_INBOUND_COALESCE_MS);
    expect(coalesceDelayMsForText('torre 9 502')).toBe(WHATSAPP_INBOUND_COALESCE_MS);
    expect(coalesceDelayMsForText('quiero un cuarto de pollo frito')).toBe(
      WHATSAPP_INBOUND_COALESCE_MS,
    );
    expect(coalesceDelayMsForText('y una gaseosa')).toBe(WHATSAPP_INBOUND_COALESCE_MS);
    expect(WHATSAPP_INBOUND_COALESCE_MS).toBe(3000);
    expect(isQuickCoalesceText('confirmar')).toBe(true);
    expect(coalesceDelayMsForText('confirmar')).toBe(WHATSAPP_INBOUND_COALESCE_QUICK_MS);
    expect(coalesceDelayMsForText('1')).toBe(WHATSAPP_INBOUND_COALESCE_QUICK_MS);
    expect(
      coalesceDelayMsForBatch([
        textMsg({ text: 'quiero pollo' }),
        textMsg({ text: 'y gaseosa' }),
      ]),
    ).toBe(WHATSAPP_INBOUND_COALESCE_MS);
  });
});
