import {
  isCoalesceableInboundMessage,
  mergeCoalescedInboundMessages,
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

  it('no duplica el mismo texto enviado dos veces', () => {
    const merged = mergeCoalescedInboundMessages([
      textMsg({ text: 'confirmar' }),
      textMsg({ text: 'confirmar' }),
    ]);
    expect(merged.text).toBe('confirmar');
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
});
