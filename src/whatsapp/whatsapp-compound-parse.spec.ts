import {
  isDeliveryCoverageInquiry,
  extractCoverageAddressProbe,
  isDeliveryEtaInquiry,
  isPostOrderFollowUpIntent,
  isAddressChangeIntent,
  isReuseLastAddressIntent,
  isConfirmCurrentAddressIntent,
  isUsableWhatsappCustomerName,
  isSpecificOrderProgressInquiry,
  extractDailyOrderNumberHint,
  parseEachOfQuantity,
  parseQtyMenuCodeLines,
  parseQtyDishCorrection,
  isCartChargeQuestion,
  looksLikeKitchenSendRequest,
  productNamesMentionedInOffer,
  pickProductNamedInLastOffer,
  isInterruptedPhoneOrderInquiry,
} from './whatsapp-session-intents';
import { splitTrailingEmbeddedAddress, stripTrailingAddressFluff } from './whatsapp-compound-parse';
import { applyLocalGlossary } from './whatsapp-local-glossary';
import { looksLikeAddressOnlyMessage, isDeliverySetupWithoutFood } from './whatsapp-intent';
import { WhatsappPointsService } from './whatsapp-points.service';

describe('isPostOrderFollowUpIntent (C13)', () => {
  it.each([
    'Se demora el pedido aún?',
    'Hola oye en cuanto llegaría?',
    'Ya salieron para acá?',
    'Nada que llega',
    'Veci se demora es que debemos salir',
    'Me va tocar cancelarlo',
    'No me regalaron el arroz',
    'Ya llegó, gracias',
  ])('detecta seguimiento: %s', (text) => {
    expect(isPostOrderFollowUpIntent(text)).toBe(true);
  });

  it.each([
    'Me regalas un pollo frito',
    'Quiero un arroz con pollo',
    'Buenas noches',
    'Para un domicilio',
  ])('NO es seguimiento: %s', (text) => {
    expect(isPostOrderFollowUpIntent(text)).toBe(false);
  });
});

describe('isInterruptedPhoneOrderInquiry', () => {
  it('detecta llamada cortada / validar si tomaron el pedido', () => {
    const text =
      'Estaba pidiendo un domicilio y se cortó la llamada.... Me puedes validar si lo alcanzaron a tomar ?';
    expect(isInterruptedPhoneOrderInquiry(text)).toBe(true);
    expect(isDeliverySetupWithoutFood(text)).toBe(false);
  });

  it('no confunde pedido nuevo de comida', () => {
    expect(isInterruptedPhoneOrderInquiry('quiero un pollo broaster a domicilio')).toBe(
      false,
    );
  });
});

describe('isReuseLastAddressIntent (C19)', () => {
  it.each([
    'acá',
    'aca',
    'sí',
    'si',
    'si por favor',
    'la misma',
    'la misma dirección',
    'la de siempre',
    'dale',
    'ok',
    'esta bien',
    'Está bien',
    'todo bien',
  ])('reusa dirección: %s', (text) => {
    expect(isReuseLastAddressIntent(text)).toBe(true);
  });

  it.each(['Calle 10 #5-20', 'quiero un pollo', 'Tabaku T4 1213', 'no'])(
    'NO es reuso: %s',
    (text) => {
      expect(isReuseLastAddressIntent(text)).toBe(false);
    },
  );
});

describe('isConfirmCurrentAddressIntent', () => {
  it.each([
    'A esta dirección plis',
    'a esa direccion',
    'para esta dirección por favor',
    'mándame a esa dirección',
    'envialo a esta direccion',
    'esa dirección',
    'a esa',
  ])('confirma domicilio actual: %s', (text) => {
    expect(isConfirmCurrentAddressIntent(text)).toBe(true);
  });

  it.each([
    'Carrera 80 # 2 20',
    'A esta dirección Carrera 80 #2-20',
    'quiero un pollo',
    'No esa no es mi dirección',
  ])('NO es confirmación suelta: %s', (text) => {
    expect(isConfirmCurrentAddressIntent(text)).toBe(false);
  });
});

describe('stripTrailingAddressFluff', () => {
  it('quita "a esta dirección" del final del domicilio', () => {
    expect(
      stripTrailingAddressFluff('prados de techo 2 torre 9 apto 103 a esta direccion'),
    ).toBe('prados de techo 2 torre 9 apto 103');
  });
});

describe('splitTrailingEmbeddedAddress (C02)', () => {
  it('separa combo + calle/torre sin "para"', () => {
    const split = splitTrailingEmbeddedAddress(
      'Porfa me regalas un combo de pollo Broaster, con coca cola Calle 6b 81b 51 Torre 4 apartamento 416',
    );
    expect(split).not.toBeNull();
    expect(split!.address).toMatch(/Calle 6b/i);
    expect(split!.productText).toMatch(/combo|broaster|coca/i);
    expect(split!.productText).not.toMatch(/Torre 4/i);
  });

  it('separa con "Es para" + Castilla', () => {
    const split = splitTrailingEmbeddedAddress(
      'menú ejecutivo con pollo BROASTER Es para parques de Castilla calle 6D #80B - 89 torre 5 int 2 apto 402',
    );
    expect(split).not.toBeNull();
    expect(split!.address).toMatch(/parques de Castilla/i);
    expect(split!.productText).toMatch(/ejecutivo|BROASTER/i);
  });

  it('separa arroz + Portal de Castilla', () => {
    const split = splitTrailingEmbeddedAddress(
      'Me puedes ayudar con un arroz con pollo Sería para Portal de Castilla, torre 3 apartamento 304',
    );
    expect(split).not.toBeNull();
    expect(split!.address).toMatch(/Portal de Castilla/i);
  });

  it('no corta plato sin dirección', () => {
    expect(splitTrailingEmbeddedAddress('Me regalas un pollo frito por favor')).toBeNull();
  });

  it('Casa 11 terrazas de Castilla (no cortar en Castilla sola + quitar costo)', () => {
    const text =
      'un arroz con pollo y una pechuga, Casa 11 terrazas de Castilla 3, si es tan gentil y me regala el costo';
    const split = splitTrailingEmbeddedAddress(text);
    expect(split).toBeTruthy();
    expect(split!.address).toMatch(/casa\s*11/i);
    expect(split!.address).toMatch(/terrazas/i);
    expect(split!.address).toMatch(/castilla/i);
    expect(split!.address).not.toMatch(/gentil|costo|regala/i);
    expect(split!.productText).toMatch(/arroz/i);
    expect(split!.productText).toMatch(/pechuga/i);
    expect(split!.productText).not.toMatch(/castilla/i);
  });
});

describe('corpus C02 address-only sigue OK', () => {
  it('Tabaku / Nuevo Sol', () => {
    expect(looksLikeAddressOnlyMessage(applyLocalGlossary('Tabaku central T4 1213'))).toBe(
      true,
    );
    expect(looksLikeAddressOnlyMessage('Portería nuevo sol')).toBe(true);
  });

  it('cambio de dirección sigue distinto', () => {
    expect(isAddressChangeIntent('Cambia la direccion a dg 6 b 78b 64')).toBe(true);
  });
});

describe('isDeliveryEtaInquiry', () => {
  it.each([
    'Cuánto demora?',
    'en cuanto llegaría?',
    'Se demora el domicilio?',
    'cuanto tiempo tarda la entrega',
    'Masomenos cuanto se demora',
    'Mas o menos cuanto se demora',
    'aprox cuanto tarda',
  ])('detecta ETA: %s', (text) => {
    expect(isDeliveryEtaInquiry(text)).toBe(true);
  });

  it('no confunde con pedido', () => {
    expect(isDeliveryEtaInquiry('quiero un pollo frito')).toBe(false);
  });
});

describe('isSpecificOrderProgressInquiry / extractDailyOrderNumberHint', () => {
  it.each([
    'Cuánto tarda mi pedido?',
    'En qué va el pedido',
    'Ya salió mi orden?',
    'Dónde está el domiciliario',
    'estado del pedido',
    'Cuánto demora el pedido #15',
  ])('es consulta de pedido concreto: %s', (text) => {
    expect(isSpecificOrderProgressInquiry(text)).toBe(true);
  });

  it.each([
    'Cuánto demora el domicilio?',
    'tiempo de entrega',
    'Masomenos cuanto se demora',
  ])('ETA genérico (sin mi pedido): %s', (text) => {
    expect(isDeliveryEtaInquiry(text)).toBe(true);
    expect(isSpecificOrderProgressInquiry(text)).toBe(false);
  });

  it('viene con gaseosa no es el estado del pedido', () => {
    expect(isSpecificOrderProgressInquiry('el combo ya viene con gaseosa?')).toBe(false);
    expect(isSpecificOrderProgressInquiry('quiero un pollo frito')).toBe(false);
  });

  it('extrae número de orden', () => {
    expect(extractDailyOrderNumberHint('orden #15')).toBe(15);
    expect(extractDailyOrderNumberHint('pedido 7')).toBe(7);
    expect(extractDailyOrderNumberHint('#22')).toBe(22);
    expect(extractDailyOrderNumberHint('15')).toBe(15);
    expect(extractDailyOrderNumberHint('quiero pollo')).toBeNull();
    expect(extractDailyOrderNumberHint('2 #20')).toBeNull();
    expect(extractDailyOrderNumberHint('2 #20\n2 #38')).toBeNull();
    expect(isSpecificOrderProgressInquiry('2 #20\n2 #38')).toBe(false);
  });
});

describe('pedido de sopas (2 de cada una)', () => {
  const offer =
    'Sí, tenemos sopas: Sopa de Ajiaco $12.000 (acompañada con arroz), Sopa de Menudencias $12.000 (acompañada con arroz) y Sopa pequeña $8.500 (elige Ajiaco o Menudencias).';

  it('pide N de cada plato que el bot acaba de nombrar', () => {
    expect(parseEachOfQuantity('Por favor me das 2 de cada una')).toBe(2);
    expect(
      productNamesMentionedInOffer(offer, [
        'Sopa de Ajiaco',
        'Sopa de Menudencias',
        'Sopa pequeña',
        'Ejecutivo Con Pollo Broaster',
        'Sopa',
      ]),
    ).toEqual(['Sopa de Menudencias', 'Sopa de Ajiaco', 'Sopa pequeña']);
  });

  it('2 #20 y 2 #38 son códigos del menú', () => {
    expect(parseQtyMenuCodeLines('2 #20\n2 #38')).toEqual([
      { qty: 2, code: 20 },
      { qty: 2, code: 38 },
    ]);
    expect(parseQtyMenuCodeLines('orden #15')).toBeNull();
  });

  it('la corrección reemplaza por 2 ajiaco y 2 menudencias', () => {
    expect(parseQtyDishCorrection('No, son 4 sopas 2 de ajiaco y 2 de menudencias')).toEqual([
      { qty: 2, dish: 'ajiaco' },
      { qty: 2, dish: 'menudencias' },
    ]);
    expect(parseQtyDishCorrection('Esta mal eso')).toBeNull();
  });

  it('cuánto están cobrando pregunta por el carrito', () => {
    expect(isCartChargeQuestion('Pero cuanto me están cobrando por 4 sopas???')).toBe(true);
    expect(isCartChargeQuestion('Son solo 4 sopas, que estan cobrando??')).toBe(true);
    expect(isCartChargeQuestion('cuanto vale la sopa')).toBe(false);
  });

  it('enviar mucho ají es nota, no nombre', () => {
    expect(looksLikeKitchenSendRequest('Y envias mucho aji, por favor')).toBe(true);
    expect(isUsableWhatsappCustomerName('Y envias mucho aji, por favor')).toBe(false);
    expect(isUsableWhatsappCustomerName('Ana Gómez')).toBe(true);
  });
});

describe('isDeliveryCoverageInquiry (C18)', () => {
  it.each([
    'Hola tienen domicilios para Cra 81A #6B-20?',
    'hacen domicilios a Tabaku Central?',
    '¿Cubren entregas hasta Altavista?',
    'Buenas, hacen servicio a domicilio para Portal de Castilla?',
  ])('detecta cobertura: %s', (text) => {
    expect(isDeliveryCoverageInquiry(text)).toBe(true);
  });

  it.each([
    'quiero un pollo frito',
    'Me regalas un ejecutivo para Castilla',
    'Buenas noches',
    'para un domicilio',
    'Ustedes tienen servicio a domicilio',
    'tienen servicio a domicilio?',
    'hacen domicilio?',
  ])('NO es solo cobertura: %s', (text) => {
    expect(isDeliveryCoverageInquiry(text)).toBe(false);
  });

  it('extrae dirección de la pregunta', () => {
    expect(
      extractCoverageAddressProbe('tienen domicilios para Cra 81A #6B-20?'),
    ).toMatch(/Cra 81A/i);
    expect(
      extractCoverageAddressProbe('hacen domicilios a Tabaku Central?'),
    ).toMatch(/Tabaku/i);
    expect(extractCoverageAddressProbe('Ustedes tienen servicio a domicilio')).toBeNull();
  });
});

describe('puntos / código (C17)', () => {
  const points = new WhatsappPointsService({} as never);

  it.each([
    'procedimiento para redimir',
    'cómo puedo redimir puntos',
    'quiero redimir',
    'pasos para canjear puntos',
  ])('intención redimir/procedimiento: %s', (text) => {
    expect(points.isRedeemIntent(text) || points.isPointsTopic(text)).toBe(true);
  });

  it('espera código sin inventar registro', () => {
    expect(points.isAwaitingPointCodePrompt('mira el código')).toBe(true);
    expect(points.isAwaitingPointCodePrompt('te paso el código')).toBe(true);
    expect(points.extractPointCodeCandidate('mira el código')).toBeNull();
  });

  it('código de 12 chars en contexto puntos', () => {
    expect(points.extractPointCodeCandidate('registrar A3F9K2M8PQ75')).toBe('A3F9K2M8PQ75');
  });
});

describe('isUsableWhatsappCustomerName', () => {
  it.each([
    'Pedidos',
    'Pedido',
    'Cliente',
    'Customer',
    'WhatsApp',
    'Pronto Pollo',
    'Necesito',
    'Quiero',
    'Dame',
    'Para hacer',
    'Para',
    'seria',
    'Sería',
    'Me regalas',
    'me das',
    'Por qué 5?',
    'Este',
    'Esto',
  ])(
    'rechaza placeholder: %s',
    (name) => {
      expect(isUsableWhatsappCustomerName(name)).toBe(false);
    },
  );

  it.each(['Juan Pérez', 'María', 'Carlos Andrés', 'Ana', 'Josseph Arlet Pabón Arévalo', 'Josseph Pabon'])(
    'acepta nombre real: %s',
    (name) => {
      expect(isUsableWhatsappCustomerName(name)).toBe(true);
    },
  );
});

describe('pickProductNamedInLastOffer', () => {
  const products = [
    { id: 25, name: 'Costillas De Cerdo' },
    { id: 72, name: 'Arroz Chino Con Costillas De Cerdo' },
    { id: 50, name: 'Mojarra' },
  ];
  const offer =
    '¿Quieres Costillas De Cerdo ($30.000) o Arroz Chino con Costillas De Cerdo ($50.000)?';

  it('elige la costilla suelta aunque escriba der', () => {
    expect(pickProductNamedInLastOffer('costillas der cerdo', offer, products)?.name).toBe(
      'Costillas De Cerdo',
    );
  });

  it('elige el arroz si lo nombra', () => {
    expect(pickProductNamedInLastOffer('el arroz chino', offer, products)?.name).toBe(
      'Arroz Chino Con Costillas De Cerdo',
    );
  });

  it('no elige si el mensaje es otro plato', () => {
    expect(pickProductNamedInLastOffer('una limonada', offer, products)).toBeNull();
  });
});
