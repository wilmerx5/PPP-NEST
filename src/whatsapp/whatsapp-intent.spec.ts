import {
  classifyWhatsappCustomerIntent,
  intentAllowsAddItems,
} from './whatsapp-intent';

describe('classifyWhatsappCustomerIntent', () => {
  it('detecta nota de guarnición con carrito', () => {
    const intent = classifyWhatsappCustomerIntent({
      text: 'para el combo no quiero arepas, quiero mas papas',
      cartLength: 1,
      looksLikeSideModificationNote: true,
    });
    expect(intent).toBe('side_note');
    expect(intentAllowsAddItems(intent)).toBe(false);
  });

  it('detecta pedido de producto', () => {
    const intent = classifyWhatsappCustomerIntent({
      text: 'pedi dos sopas de ajiaco pequeñas',
      cartLength: 0,
    });
    expect(intent).toBe('order_product');
    expect(intentAllowsAddItems(intent)).toBe(true);
  });

  it('detecta consulta de precio', () => {
    const intent = classifyWhatsappCustomerIntent({
      text: 'cuanto vale el pollo frito?',
      cartLength: 0,
      isPriceInquiry: true,
    });
    expect(intent).toBe('price_question');
    expect(intentAllowsAddItems(intent)).toBe(false);
  });

  it('detecta humano', () => {
    expect(
      classifyWhatsappCustomerIntent({
        text: 'quiero hablar con un asesor',
        cartLength: 0,
      }),
    ).toBe('human');
  });

  it('detecta pago', () => {
    expect(
      classifyWhatsappCustomerIntent({
        text: 'pago contraentrega',
        cartLength: 2,
        isPaymentMention: true,
      }),
    ).toBe('payment');
  });

  it('detecta charla', () => {
    expect(
      classifyWhatsappCustomerIntent({
        text: 'cuentame un cuento',
        cartLength: 0,
        isOffTopicChitchat: true,
      }),
    ).toBe('chitchat');
  });
});
