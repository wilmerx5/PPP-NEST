import {
  isDeliveryCoverageInquiry,
  extractCoverageAddressProbe,
  isDeliveryEtaInquiry,
  isPostOrderFollowUpIntent,
  isAddressChangeIntent,
  isReuseLastAddressIntent,
  isConfirmCurrentAddressIntent,
  isUsableWhatsappCustomerName,
} from './whatsapp-session-intents';
import { splitTrailingEmbeddedAddress } from './whatsapp-compound-parse';
import { applyLocalGlossary } from './whatsapp-local-glossary';
import { looksLikeAddressOnlyMessage } from './whatsapp-intent';
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
  it.each(['Pedidos', 'Pedido', 'Cliente', 'Customer', 'WhatsApp', 'Pronto Pollo'])(
    'rechaza placeholder: %s',
    (name) => {
      expect(isUsableWhatsappCustomerName(name)).toBe(false);
    },
  );

  it.each(['Juan Pérez', 'María', 'Carlos Andrés', 'Ana'])(
    'acepta nombre real: %s',
    (name) => {
      expect(isUsableWhatsappCustomerName(name)).toBe(true);
    },
  );
});
