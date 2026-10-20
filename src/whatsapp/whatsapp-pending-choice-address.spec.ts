import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

type Family = {
  id: string;
  drink: { name: string; options: [string, string, string] };
  combo: { name: string; first: [string, string, string]; second: [string, string, string] };
  list: [string, string];
  main: string;
};

const families: Family[] = [
  {
    id: 'juice-bar',
    drink: { name: 'Jugo Natural', options: ['Lulo', 'Mora', 'Maracuyá'] },
    combo: { name: 'Combo Sándwich', first: ['Integral', 'Blanco', 'Centeno'], second: ['Limonada', 'Té', 'Agua'] },
    list: ['Ensalada De Frutas', 'Ensalada Verde'],
    main: 'Wrap De Pollo',
  },
  {
    id: 'pizzeria',
    drink: { name: 'Pizza Personal', options: ['Hawaiana', 'Pepperoni', 'Vegetariana'] },
    combo: { name: 'Combo Familiar', first: ['Delgada', 'Gruesa', 'Rellena'], second: ['Ginger', 'Uva', 'Manzana'] },
    list: ['Lasaña De Carne', 'Lasaña De Pollo'],
    main: 'Pan De Ajo',
  },
  {
    id: 'grill',
    drink: { name: 'Gaseosa Personal', options: ['Colombiana', 'Pepsi', 'Naranja'] },
    combo: { name: 'Combo Asado', first: ['Francesa', 'Criolla', 'Yuca'], second: ['Cola', 'Kola', 'Soda'] },
    list: ['Chorizo Santarrosano', 'Chorizo Picante'],
    main: 'Costilla BBQ',
  },
];

const menuOf = (f: Family) => [
  { id: 1, code: 201, name: f.main, price: 22000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 2, code: 202, name: f.drink.name, price: 6000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options: [...f.drink.options] }] },
  { id: 3, code: 203, name: f.combo.name, price: 38000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Base', options: [...f.combo.first] }, { attributeName: 'Bebida', options: [...f.combo.second] }] },
  { id: 4, code: 204, name: f.list[0], price: 9000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 5, code: 205, name: f.list[1], price: 9500, availableNow: true, hasAttributes: false, attributes: [] },
];

const street = 'Calle 45 #12-30';
const tower = 'Conjunto Los Pinos\nTorre 4 apto 302';

type Rig = ReturnType<typeof harness> & { created: jest.Mock };

function rig(f: Family, agent: boolean, withCart: boolean): Rig {
  const menu = menuOf(f);
  const h = harness(menu as never, agent);
  h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.map(method => ({ ...method, enabled: method.flow !== 'mercadopago' }));
  const created = jest.fn().mockResolvedValue({ id: 1, dailyOrderNumber: 1 });
  const orders = (h.service as unknown as { ordersService: Record<string, unknown> }).ordersService;
  orders.create = created;
  orders.findTodayOrdersByPhone = async () => [];
  h.conv.sessionData.cart = withCart
    ? [{ productId: 1, code: 201, name: f.main, unitPrice: 22000, quantity: 1, attributes: [] }]
    : [];
  return Object.assign(h, { created });
}

function atOption(f: Family, agent: boolean, withCart = false, product = 2) {
  const h = rig(f, agent, withCart);
  const item = menuOf(f)[product - 1];
  h.conv.sessionData.pendingAttribute = {
    productId: item.id, name: item.name, code: item.code, price: item.price,
    attributes: item.attributes, selected: [], sourceText: `un ${item.name.toLowerCase()}`,
  };
  h.conv.state = 'awaiting_attribute';
  return h;
}

function atList(f: Family, agent: boolean) {
  const h = rig(f, agent, false);
  h.conv.sessionData.pendingMatch = { query: f.list[0].split(' ')[0].toLowerCase(), candidates: menuOf(f).slice(3, 5), intent: 'order' };
  return h;
}

async function burst(h: Rig, texts: string[]) {
  jest.useFakeTimers();
  try {
    const sent = texts.map((text, index) => h.service.handleIncoming({
      waId: 'customer', phoneE164: h.conv.phoneE164, messageId: `bubble-${index}-${text}`,
      messageType: 'text', text, timestamp: Date.now() / 1000, raw: {},
    }));
    await jest.advanceTimersByTimeAsync(8000);
    await Promise.all(sent);
  } finally {
    jest.useRealTimers();
  }
}

const rows = (h: Rig) => h.conv.sessionData.cart.map(line => [line.name, (line.attributes || []).map(a => a.attributeValue).join('+')]);
const flat = (value: string) => value.replace(/\s+/g, ' ').toLowerCase();

function expectAddress(h: Rig, ...parts: string[]) {
  const saved = flat(String(h.conv.sessionData.address || ''));
  for (const part of parts) expect(saved).toContain(flat(part).split(' ')[0]);
  expect(h.conv.sessionData.orderType).toBe('delivery');
}

function expectStillAsking(h: Rig, f: Family, agent: boolean) {
  expect(h.conv.sessionData.pendingAttribute?.name).toBe(f.drink.name);
  expect(h.conv.state).toBe('awaiting_attribute');
  const reply = h.replies.at(-1) || '';
  expect(reply).not.toMatch(/Dime qué se te antoja/);
  if (!agent) for (const option of f.drink.options) expect(reply).toContain(option);
  expect(h.created).not.toHaveBeenCalled();
}

const cases = families.flatMap(family => [false, true].map(agent => ({ family, agent })));

describe.each(cases)('dirección durante una opción pendiente — $family.id agent=$agent', ({ family: f, agent }) => {
  const [o1, o2] = f.drink.options;
  const option = (h: Rig) => rows(h).find(([name]) => name === f.drink.name)?.[1];

  it('solo la dirección con el carrito vacío: la anota y vuelve a pedir la opción', async () => {
    const h = atOption(f, agent);
    await h.sendQueued(street);
    expectAddress(h, street);
    expectStillAsking(h, f, agent);
    expect(rows(h)).toEqual([]);
  });

  it('dirección de varias líneas con el carrito vacío: conserva la opción pendiente', async () => {
    const h = atOption(f, agent);
    await h.sendQueued(tower);
    expectAddress(h, 'Torre');
    expectStillAsking(h, f, agent);
  });

  it('contraste: con carrito lleno también conserva la opción pendiente', async () => {
    const h = atOption(f, agent, true);
    await h.sendQueued(street);
    expectAddress(h, street);
    expectStillAsking(h, f, agent);
    expect(rows(h)).toEqual([[f.main, '']]);
  });

  it.each([
    ['opción primero', (o: string) => `${o}\n${street}`],
    ['opción al final', (o: string) => `${tower}\n${o}`],
    ['opción + «por favor» + dirección', (o: string) => `${o}\nPor favor\n${street}`],
    ['opción en minúscula con cortesía', (o: string) => `${o.toLowerCase()} por favor\n${street}`],
  ])('%s en una burbuja: aplica la opción y la dirección queda sin esa palabra', async (_label, build) => {
    const h = atOption(f, agent);
    await h.sendQueued(build(o2));
    expect(option(h)).toBe(o2);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(flat(String(h.conv.sessionData.address || ''))).not.toContain(flat(o2));
    expect(h.conv.sessionData.orderType).toBe('delivery');
    expect(h.conv.sessionData.address).toBeTruthy();
    expect(h.created).not.toHaveBeenCalled();
  });

  it('ráfaga dirección y luego la opción: aplica ambas', async () => {
    const h = atOption(f, agent);
    await burst(h, [street, o1]);
    expect(option(h)).toBe(o1);
    expectAddress(h, street);
    expect(flat(String(h.conv.sessionData.address))).not.toContain(flat(o1));
    expect(h.created).not.toHaveBeenCalled();
  });

  it('contraste: ráfaga opción y luego dirección sigue funcionando', async () => {
    const h = atOption(f, agent);
    await burst(h, [o1, street]);
    expect(option(h)).toBe(o1);
    expectAddress(h, street);
  });

  it('producto con dos opciones: la palabra de la segunda se aplica y sigue pidiendo la primera', async () => {
    const h = atOption(f, agent, false, 3);
    await h.sendQueued(`${f.combo.second[1]}\n${street}`);
    const pending = h.conv.sessionData.pendingAttribute;
    const line = rows(h).find(([name]) => name === f.combo.name);
    if (line) {
      expect(line[1]).toContain(f.combo.second[1]);
    } else {
      expect(pending?.name).toBe(f.combo.name);
      expect(pending?.selected?.map(s => s.attributeValue)).toEqual([f.combo.second[1]]);
      expect(h.conv.state).toBe('awaiting_attribute');
    }
    expect(flat(String(h.conv.sessionData.address || ''))).not.toContain(flat(f.combo.second[1]));
    expectAddress(h, street);
  });

  it('contraste: dos opciones en líneas aparte no se parten como opción + dirección', async () => {
    const h = atOption(f, agent);
    await h.sendQueued(`${o1}\n${o2}\n${street}`);
    const saved = flat(String(h.conv.sessionData.address || ''));
    expect(saved.includes(flat(o1)) && !saved.includes(flat(o2))).toBe(false);
    expect(h.created).not.toHaveBeenCalled();
  });

  it('contraste: la palabra de la opción dentro de la calle no elige la opción', async () => {
    const h = atOption(f, agent);
    await h.sendQueued(`Calle ${o1} #8-20`);
    expect(option(h)).toBeUndefined();
    expect(h.created).not.toHaveBeenCalled();
  });

  it('lista pendiente con el carrito vacío: la dirección no borra la lista', async () => {
    const h = atList(f, agent);
    await h.sendQueued(street);
    expectAddress(h, street);
    expect(h.conv.sessionData.pendingMatch?.candidates?.map(c => c.name)).toEqual(f.list);
    const reply = h.replies.at(-1) || '';
    expect(reply).not.toMatch(/Dime qué se te antoja/);
    if (!agent) expect(reply).toContain(f.list[0]);
  });
});
