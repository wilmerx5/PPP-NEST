import { harness } from './whatsapp-accuracy.test-support';

type Family = { id: string; main: string; mainAsk: string; second: string; secondAsk: string; pair: [string, string]; pairAsk: string };

const families: Family[] = [
  { id: 'grill', main: 'Costilla BBQ', mainAsk: 'una costilla bbq', second: 'Limonada Natural', secondAsk: 'una limonada natural',
    pair: ['Chorizo Santarrosano', 'Chorizo Picante'], pairAsk: 'un chorizo' },
  { id: 'bakery', main: 'Croissant De Almendras', mainAsk: 'un croissant de almendras', second: 'Café Latte', secondAsk: 'un café latte',
    pair: ['Torta De Chocolate', 'Torta De Zanahoria'], pairAsk: 'una torta' },
  { id: 'sushi', main: 'Ramen Tonkotsu', mainAsk: 'un ramen tonkotsu', second: 'Té Verde', secondAsk: 'un té verde',
    pair: ['Rollo California', 'Rollo Filadelfia'], pairAsk: 'un rollo' },
];

const menuOf = (f: Family) => [
  { id: 1, code: 301, name: f.main, price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 2, code: 302, name: f.second, price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 3, code: 303, name: f.pair[0], price: 12000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 4, code: 304, name: f.pair[1], price: 12500, availableNow: true, hasAttributes: false, attributes: [] },
];

const askNumber = /n[uú]mero de orden/i;

function rig(f: Family, agent: boolean, today: Array<Record<string, unknown>> = []) {
  const h = harness(menuOf(f) as never, agent);
  const orders = (h.service as unknown as { ordersService: Record<string, unknown> }).ordersService;
  orders.findTodayOrdersByPhone = async () => today;
  return h;
}

async function said(h: ReturnType<typeof harness>, text: string) {
  const before = h.replies.length;
  await h.send(text);
  return h.replies.slice(before).join('\n');
}

const names = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map(line => line.name);

describe.each(families)('$id: order-number request releases on other topics', f => {
  describe.each([false, true])('agent %s', agent => {
    it('a dish after the request is added, not answered with the number request', async () => {
      const h = rig(f, agent);
      expect(await said(h, 'ya salió mi pedido?')).toMatch(askNumber);
      const reply = await said(h, `quiero ${f.mainAsk}`);
      expect(reply).not.toMatch(askNumber);
      expect(names(h)).toContain(f.main);
      expect(h.conv.sessionData.pendingOrderStatusLookup).toBeFalsy();
    });

    it('a bare dish request after the request is added', async () => {
      const h = rig(f, agent);
      await said(h, 'en qué va mi pedido?');
      expect(await said(h, f.secondAsk)).not.toMatch(askNumber);
      expect(names(h)).toContain(f.second);
    });

    it('thanks after the request does not repeat it', async () => {
      const h = rig(f, agent);
      await said(h, 'ya salió mi pedido?');
      expect(await said(h, 'muchas gracias')).not.toMatch(askNumber);
      expect(h.conv.sessionData.pendingOrderStatusLookup).toBeFalsy();
    });

    it('an address after the request is not answered with the number request, and the next dish is added', async () => {
      const h = rig(f, agent);
      await said(h, 'dónde está mi pedido?');
      expect(await said(h, 'Calle 45 #12-30')).not.toMatch(askNumber);
      expect(await said(h, f.mainAsk)).not.toMatch(askNumber);
      expect(names(h)).toContain(f.main);
    });

    it('a filler after the request does not repeat it', async () => {
      const h = rig(f, agent);
      await said(h, 'ya salió mi pedido?');
      expect(await said(h, 'vale yo espero')).not.toMatch(askNumber);
      expect(await said(h, 'ya estoy pendiente')).not.toMatch(askNumber);
    });

    it('the number request names the phone without the generic misunderstanding line', async () => {
      const h = rig(f, agent);
      const reply = await said(h, 'ya salió mi pedido?');
      expect(reply).toMatch(askNumber);
      expect(reply).not.toMatch(/No entend[ií] bien/i);
      expect(reply).toMatch(/ll[aá]manos al/i);
    });

    it('contrast: a second status question keeps asking for the number', async () => {
      const h = rig(f, agent);
      await said(h, 'ya salió mi pedido?');
      const reply = await said(h, 'y en qué va mi pedido?');
      expect(reply).toMatch(askNumber);
      expect(reply).not.toMatch(/No entend[ií] bien/i);
    });

    it('contrast: the number after the request resolves the order', async () => {
      const h = rig(f, agent, [{ id: 9, dailyOrderNumber: 15, orderStatus: 'cooking' }, { id: 10, dailyOrderNumber: 16, orderStatus: 'cooking' }]);
      expect(await said(h, 'ya salió mi pedido?')).toMatch(/varios pedidos/i);
      const reply = await said(h, '15');
      expect(reply).toMatch(/#15/);
      expect(h.conv.sessionData.pendingOrderStatusLookup).toBeFalsy();
    });
  });
});

describe.each(families)('$id: describing the order being placed is not a status lookup', f => {
  describe.each([false, true])('agent %s', agent => {
    it.each([
      'el pedido es para las 12 del medio en punto por favor',
      'el pedido es para las 7 de la noche',
      'mi pedido es a domicilio',
      'el pedido es para recoger',
    ])('%s', async text => {
      const h = rig(f, agent);
      const reply = await said(h, text);
      expect(reply).not.toMatch(askNumber);
      expect(reply).not.toMatch(/Programa de puntos/i);
      expect(h.conv.sessionData.pendingOrderStatusLookup).toBeFalsy();
      await said(h, f.mainAsk);
      expect(names(h)).toContain(f.main);
    });
  });

  it('contrast (agent off): «el pedido no ha llegado» still asks for the number', async () => {
    const h = rig(f, false);
    expect(await said(h, 'el pedido no ha llegado, en qué va?')).toMatch(askNumber);
  });
});

describe.each(families)('$id: status questions reach the lookup instead of the off-menu refusal', f => {
  it.each([
    'ya vienen?',
    'será que ya viene?',
    'una pregunta ya casi está??',
    'me cuentas qué pasó con el domicilio?',
    'ya salieron?',
    'se demoran?',
    'falta mucho?',
  ])('agent off: %s', async text => {
    const h = rig(f, false);
    const reply = await said(h, text);
    expect(reply).not.toMatch(/Eso no lo resuelvo/i);
    expect(reply).toMatch(/n[uú]mero de orden|demorar|minutos/i);
  });

  it('contrast: «ya viene con papas?» is not a status question', async () => {
    const h = rig(f, false);
    expect(await said(h, `${f.mainAsk.replace(/^un[a]? /, 'el ')} ya viene con papas?`)).not.toMatch(askNumber);
  });

  it('contrast: an unrelated question is still refused', async () => {
    const h = rig(f, false);
    expect(await said(h, 'aceptan mascotas?')).toMatch(/Eso no lo resuelvo/i);
  });
});

describe.each(families)('$id: an unmatched message does not leave a notice to replay', f => {
  describe.each([false, true])('agent %s', agent => {
    it.each([
      ['Es que me salió algo urgente y debo salir', 'vale yo espero'],
      ['Gracias ya te envío el pago', 'quedo atenta al pedido'],
      ['Para aquí para el lado del parque porfa gracias', 'si veci'],
    ])('%s → %s', async (first, second) => {
      const h = rig(f, agent);
      const one = await said(h, first);
      const two = await said(h, second);
      const notice = /No tenemos esos productos|Por ahora no manejamos/i;
      if (notice.test(one)) expect(two).not.toBe(one);
      expect(two).not.toMatch(/No tenemos esos productos/i);
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      const three = await said(h, f.secondAsk);
      expect(three).not.toMatch(/Primero termina de elegir|No tenemos esos productos/i);
      expect(names(h)).toContain(f.second);
    });

  });

  it('contrast (agent off): a list still waiting for a pick keeps the pending choice', async () => {
    const h = rig(f, false);
    await said(h, f.pairAsk);
    const first = h.conv.sessionData.pendingMatch?.candidates[0]?.name;
    expect(f.pair).toContain(first);
    await said(h, '1');
    expect(names(h)).toContain(first);
  });

  it('contrast (agent off): a known dish next to unknown text is still added with the notice', async () => {
    const h = rig(f, false);
    const reply = await said(h, `${f.mainAsk} y un ornitorrinco asado`);
    expect(reply).toMatch(/no manejamos/i);
    expect(names(h)).toContain(f.main);
    expect(await said(h, 'vale gracias')).not.toMatch(/no manejamos|No tenemos esos productos/i);
  });
});

describe('loyalty points are still recognised', () => {
  it.each(families)('$id: «cómo funcionan los puntos» explains the program', async f => {
    const h = rig(f, false);
    expect(await said(h, 'cómo funcionan los puntos?')).toMatch(/Programa de puntos/i);
  });
});
