import {
  classifyWhatsappCustomerIntent,
  intentAllowsAddItems,
  looksLikeAddressOnlyMessage,
  looksLikeClearCartMessage,
  looksLikeExplicitCartItemNote,
  looksLikeNonAddressCommand,
  isDeliverySetupWithoutFood,
  extractDeliverySetupAddress,
  looksLikeDeliveryAddressFragment,
  isDeliveryLogisticsFluff,
  isHumanHandoffRequest,
} from './whatsapp-intent';
import { applyLocalGlossary } from './whatsapp-local-glossary';

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

  it('detecta nota explícita en plato del carrito (no add)', () => {
    const text = 'Pon una nota en la sobrebarriga "WILMER - NO SACAR"';
    expect(looksLikeExplicitCartItemNote(text)).toBe(true);
    const intent = classifyWhatsappCustomerIntent({
      text,
      cartLength: 1,
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

  it("persona's / personas (rinde) no es handoff", () => {
    expect(isHumanHandoffRequest("Para cuantas persona's alcanzas El arroz chino")).toBe(false);
    expect(isHumanHandoffRequest('para cuantas personas alcanza el arroz chino')).toBe(false);
    expect(isHumanHandoffRequest('quiero hablar con una persona')).toBe(true);
    expect(isHumanHandoffRequest('ASESOR')).toBe(true);
    expect(isHumanHandoffRequest('Asesor')).toBe(true);
    expect(isHumanHandoffRequest('asesor')).toBe(true);
    expect(isHumanHandoffRequest('asesor!')).toBe(true);
    expect(isHumanHandoffRequest('humano')).toBe(true);
    expect(isHumanHandoffRequest('3134659001')).toBe(false);
    expect(
      classifyWhatsappCustomerIntent({
        text: "Para cuantas persona's alcanzas El arroz chino",
        cartLength: 0,
      }),
    ).not.toBe('human');
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

  it('detecta dirección con carrito', () => {
    const intent = classifyWhatsappCustomerIntent({
      text: 'para el hospital de kennedy',
      cartLength: 2,
      looksLikeAddressOnly: true,
    });
    expect(intent).toBe('address');
    expect(intentAllowsAddItems(intent)).toBe(false);
  });

  it('detecta vaciar carrito (imperativo y compuesto)', () => {
    for (const text of [
      'borra el pedido y vacio el carrito',
      'borra el pedido y vacia el carrito',
      'vacia el carrito',
      'limpia todo',
      'ya no quiero nada',
      'reiniciar',
      'reiniciar pedido',
      'limpiar',
    ]) {
      expect(looksLikeClearCartMessage(text)).toBe(true);
      const intent = classifyWhatsappCustomerIntent({ text, cartLength: 3 });
      expect(intent).toBe('clear_cart');
      expect(intentAllowsAddItems(intent)).toBe(false);
    }
  });

  it('no confunde vaciar carrito con dirección', () => {
    expect(
      classifyWhatsappCustomerIntent({
        text: 'borra el pedido y vacio el carrito',
        cartLength: 2,
        looksLikeAddressOnly: false,
      }),
    ).toBe('clear_cart');
    expect(looksLikeAddressOnlyMessage('borra el pedido y vacio el carrito')).toBe(false);
    expect(looksLikeNonAddressCommand('borra el pedido y vacio el carrito')).toBe(true);
    expect(looksLikeNonAddressCommand('Pero quiero una porcion Mas pequena')).toBe(true);
    expect(looksLikeNonAddressCommand('Tienes sopa De mondongo')).toBe(true);
    expect(
      looksLikeNonAddressCommand('Puedo cambiar la ensalada por otra cosa'),
    ).toBe(true);
  });

  it('detecta dirección estricta con landmark', () => {
    expect(
      looksLikeAddressOnlyMessage('para el hospital de kennedy'),
    ).toBe(true);
    expect(
      classifyWhatsappCustomerIntent({
        text: 'para el hospital de kennedy',
        cartLength: 2,
      }),
    ).toBe('address');
    expect(looksLikeAddressOnlyMessage('Para el hermano jesus, por favor')).toBe(true);
    expect(
      classifyWhatsappCustomerIntent({
        text: 'Para el hermano jesus, por favor',
        cartLength: 1,
      }),
    ).toBe('address');
  });

  it('detecta conjunto/urbanización por nombre (Bosques de Castilla)', () => {
    expect(looksLikeAddressOnlyMessage('Bosques de castilla')).toBe(true);
    expect(
      classifyWhatsappCustomerIntent({
        text: 'Bosques de castilla',
        cartLength: 1,
      }),
    ).toBe('address');
    expect(looksLikeAddressOnlyMessage('Tierras del Sol')).toBe(true);
    expect(looksLikeAddressOnlyMessage('Portería nuevo sol')).toBe(true);
    expect(looksLikeAddressOnlyMessage('Tabaku central T4 1213')).toBe(true);
  });

  it('no trata frases genéricas como dirección', () => {
    expect(looksLikeAddressOnlyMessage('borra el pedido y vacio el carrito')).toBe(false);
    expect(looksLikeAddressOnlyMessage('ya no quiero nada')).toBe(false);
  });

  it('prioriza nota de combo sobre dirección', () => {
    expect(
      classifyWhatsappCustomerIntent({
        text: 'para el combo no quiero arepas, quiero mas papas',
        cartLength: 1,
        looksLikeSideModificationNote: true,
      }),
    ).toBe('side_note');
    expect(looksLikeAddressOnlyMessage('para el combo no quiero arepas')).toBe(false);
  });
});

describe('delivery setup sin platos (anti multi-tonto)', () => {
  it.each([
    'Para Un domicikio Para bosques De Castilla',
    'Quiero Un domicilio, Para bosques De Castilla',
    'Quiero Un domicilio Para bosques De Castilla',
    'para un domicilio',
  ])('detecta setup: %s', (raw) => {
    const text = applyLocalGlossary(raw);
    expect(isDeliverySetupWithoutFood(text)).toBe(true);
  });

  it('no confunde con pedido de comida', () => {
    expect(isDeliverySetupWithoutFood('quiero un pollo frito a domicilio')).toBe(false);
    expect(isDeliverySetupWithoutFood('medio pollo para Tabaku')).toBe(false);
  });

  it('extrae Bosques de Castilla', () => {
    const a = extractDeliverySetupAddress(
      applyLocalGlossary('Para Un domicikio Para bosques De Castilla'),
    );
    const b = extractDeliverySetupAddress(
      applyLocalGlossary('Quiero Un domicilio, Para bosques De Castilla'),
    );
    expect(a).toMatch(/bosques/i);
    expect(b).toMatch(/bosques/i);
    expect(looksLikeDeliveryAddressFragment('bosques De Castilla')).toBe(true);
  });

  it('NO trata “para un domicilio por favor” como dirección', () => {
    expect(
      extractDeliverySetupAddress('Buenas noches para un domicilio por favor'),
    ).toBeNull();
    expect(isDeliveryLogisticsFluff('un domicilio por favor')).toBe(true);
    expect(isDeliveryLogisticsFluff('por favor')).toBe(true);
  });

  it('NO geocodifica “Para pedir un domicilio porfa”', () => {
    expect(isDeliveryLogisticsFluff('Para pedir un domicilio porfa')).toBe(true);
    expect(isDeliveryLogisticsFluff('pedir un domicilio porfa')).toBe(true);
    expect(isDeliverySetupWithoutFood('Para pedir un domicilio porfa')).toBe(true);
    expect(extractDeliverySetupAddress('Para pedir un domicilio porfa')).toBeNull();
    expect(looksLikeAddressOnlyMessage('Para pedir un domicilio porfa')).toBe(false);
  });

  it('NO geocodifica “Para solicitar un domicilio”', () => {
    expect(isDeliveryLogisticsFluff('Para solicitar un domicilio')).toBe(true);
    expect(isDeliveryLogisticsFluff('solicitar un domicilio')).toBe(true);
    expect(extractDeliverySetupAddress('Para solicitar un domicilio')).toBeNull();
    expect(looksLikeAddressOnlyMessage('Para solicitar un domicilio')).toBe(false);
  });

  it('extrae Tabaku desde “Me colaboras… Dirección Conjunto…”', () => {
    const addr = extractDeliverySetupAddress(
      'Me colaboras por favor con un domicilio. Dirección Conjunto Residencial Tabaku Central',
    );
    expect(addr).toMatch(/tabaku/i);
    expect(addr).not.toMatch(/colaboras/i);
  });
});
