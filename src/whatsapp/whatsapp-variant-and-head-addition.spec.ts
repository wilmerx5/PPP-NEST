import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

type Family = {
  id: string;
  main: string;
  variants: [string, string];
  tails: [string, string];
  familyAsk: string;
  head: { name: string; ask: string };
};

const families: Family[] = [
  {
    id: 'grill-juices',
    main: 'Hamburguesa Doble',
    variants: ['Jugo De Lulo', 'Jugo De Mora'],
    tails: ['lulo', 'mora'],
    familyAsk: 'un jugo',
    head: { name: 'Arepa De Queso', ask: 'una arepa' },
  },
  {
    id: 'regional-empanadas',
    main: 'Bandeja Paisa',
    variants: ['Empanada De Pollo', 'Empanada De Carne'],
    tails: ['pollo', 'carne'],
    familyAsk: 'una empanada',
    head: { name: 'Patacón Con Hogao', ask: 'un patacón' },
  },
  {
    id: 'pizzeria-shakes',
    main: 'Pizza Hawaiana',
    variants: ['Malteada De Fresa', 'Malteada De Vainilla'],
    tails: ['fresa', 'vainilla'],
    familyAsk: 'una malteada',
    head: { name: 'Lasaña Boloñesa', ask: 'una lasaña' },
  },
];

const menuOf = (f: Family) => [
  { id: 1, code: 201, name: f.main, price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 2, code: 202, name: f.variants[0], price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 3, code: 203, name: f.variants[1], price: 7500, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 4, code: 204, name: f.head.name, price: 12000, availableNow: true, hasAttributes: false, attributes: [] },
];

type Step = 'build' | 'pay' | 'final';
type Rig = ReturnType<typeof harness> & { created: jest.Mock };

function rig(f: Family, agent: boolean, step: Step, cartIds: number[]): Rig {
  const menu = menuOf(f);
  const h = harness(menu as never, agent);
  h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.map(method => ({ ...method, enabled: method.flow !== 'mercadopago' }));
  const created = jest.fn().mockResolvedValue({ id: 1, dailyOrderNumber: 1 });
  const orders = (h.service as unknown as { ordersService: Record<string, unknown> }).ordersService;
  orders.create = created;
  orders.findTodayOrdersByPhone = async () => [];
  h.conv.sessionData.cart = cartIds.map(id => {
    const product = menu.find(item => item.id === id)!;
    return { productId: id, code: product.code, name: product.name, unitPrice: product.price, quantity: 1, attributes: [] };
  });
  if (step !== 'build') {
    Object.assign(h.conv.sessionData, {
      orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 10 #20-30', addressConfirmed: true,
      phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true, deliveryFeeCalculated: 2000,
    });
    if (step === 'final') h.conv.sessionData.paymentMethod = 'contraentrega';
    h.conv.state = step === 'final' ? 'awaiting_final_confirm' : 'awaiting_payment';
  }
  return Object.assign(h, { created });
}

const rows = (h: Rig) => h.conv.sessionData.cart.map(line => [line.name, line.quantity]);
const stateOf: Record<Step, string> = { build: 'building_cart', pay: 'awaiting_payment', final: 'awaiting_final_confirm' };

function expectKept(h: Rig, step: Step) {
  expect(h.conv.state).toBe(stateOf[step]);
  expect(h.conv.sessionData.orderType).toBe(step === 'build' ? 'pickup' : 'delivery');
  expect(h.created).not.toHaveBeenCalled();
}

const cases = families.flatMap(family => [false, true].map(agent => ({ family, agent })));

describe.each(cases)('otra unidad por variante y plato por su nombre principal — $family.id agent=$agent', ({ family: f, agent }) => {
  const [v1, v2] = f.variants;
  const [t1, t2] = f.tails;

  it.each(['build', 'pay', 'final'] as Step[])('«y otro de <variante>» agrega esa variante sin tomarlo como dirección (%s)', async step => {
    const h = rig(f, agent, step, [2]);
    await h.sendQueued(`y otro de ${t2}`);
    expect(rows(h)).toEqual([[v1, 1], [v2, 1]]);
    expectKept(h, step);
    if (step === 'build') expect(h.conv.sessionData.address || '').toBe('');
  });

  it('«y otras dos de <variante>» agrega dos', async () => {
    const h = rig(f, agent, 'build', [2]);
    await h.sendQueued(`y otras dos de ${t2}`);
    expect(rows(h)).toEqual([[v1, 1], [v2, 2]]);
    expectKept(h, 'build');
  });

  it('«y otro de <la misma variante>» suma a esa línea', async () => {
    const h = rig(f, agent, 'build', [2]);
    await h.sendQueued(`y otro de ${t1}`);
    expect(rows(h)).toEqual([[v1, 2]]);
    expectKept(h, 'build');
  });

  it('«otra de <variante>» sin esa familia en el carrito agrega el único producto que la nombra', async () => {
    const h = rig(f, agent, 'build', [1]);
    await h.sendQueued(`otra de ${t2}`);
    expect(rows(h)).toEqual([[f.main, 1], [v2, 1]]);
    expectKept(h, 'build');
  });

  it.each(['build', 'pay', 'final'] as Step[])('«agrega <nombre principal>» agrega el único plato con ese nombre (%s)', async step => {
    const h = rig(f, agent, step, [1]);
    const reply = await h.sendQueued(`agrega ${f.head.ask}`);
    expect(reply).not.toMatch(/No encontré ese producto/);
    if (agent && rows(h).length === 1) {
      // The router may delegate a purchase to the agent; it must receive the resolved product.
      expect(String(h.agent.runTurn.mock.calls.at(-1)?.[0]?.userMessage)).toContain(f.head.name);
    } else {
      expect(rows(h)).toEqual([[f.main, 1], [f.head.name, 1]]);
    }
    expectKept(h, step);
  });

  it('paso final: «quiero <nombre principal>» lo agrega en vez de decir que no lo manejamos', async () => {
    const h = rig(f, agent, 'final', [1]);
    const reply = await h.sendQueued(`quiero ${f.head.ask}`);
    expect(rows(h)).toEqual([[f.main, 1], [f.head.name, 1]]);
    expect(reply).not.toMatch(/no manejamos/i);
    expectKept(h, 'final');
  });

  it('«y otro» con una sola línea suma una unidad', async () => {
    const h = rig(f, agent, 'build', [2]);
    await h.sendQueued('y otro');
    expect(rows(h)).toEqual([[v1, 2]]);
    expectKept(h, 'build');
  });

  it('contraste: «dos de <variante>» sigue agregando dos', async () => {
    const h = rig(f, agent, 'build', [2]);
    await h.sendQueued(`dos de ${t2}`);
    expect(rows(h)).toEqual([[v1, 1], [v2, 2]]);
    expectKept(h, 'build');
  });

  it('contraste: «y otro de esos» no cambia el carrito ni se vuelve dirección', async () => {
    const h = rig(f, agent, 'build', [2]);
    await h.sendQueued('y otro de esos');
    expect(rows(h).length).toBeLessThanOrEqual(1);
    expect(h.conv.sessionData.address || '').toBe('');
    expect(h.conv.sessionData.orderType).toBe('pickup');
    expect(h.created).not.toHaveBeenCalled();
  });

  it('contraste: «agrega un mojito» (no está en la carta) no cambia el carrito', async () => {
    const h = rig(f, agent, 'build', [1]);
    const reply = await h.sendQueued('agrega un mojito');
    expect(rows(h)).toEqual([[f.main, 1]]);
    expect(reply).toMatch(/No encontré ese producto/);
  });

  it('contraste: «agrega <familia>» con dos variantes pregunta cuál', async () => {
    const h = rig(f, agent, 'build', [1]);
    await h.sendQueued(`agrega ${f.familyAsk}`);
    expect(rows(h)).toEqual([[f.main, 1]]);
    expect(h.conv.sessionData.pendingMatch?.candidates.map(candidate => candidate.id).sort()).toEqual([2, 3]);
  });

  it('contraste: una dirección real sigue anotándose como domicilio', async () => {
    const h = rig(f, agent, 'build', [1]);
    await h.sendQueued('Calle 45 # 12-30');
    expect(h.conv.sessionData.orderType).toBe('delivery');
    expect(h.conv.sessionData.address).toMatch(/Calle 45/);
    expect(rows(h)).toEqual([[f.main, 1]]);
    expect(h.created).not.toHaveBeenCalled();
  });

  it('contraste: «y otro» con dos líneas no adivina cuál', async () => {
    const h = rig(f, agent, 'build', [1, 2]);
    await h.sendQueued('y otro');
    expect(rows(h)).toEqual([[f.main, 1], [v1, 1]]);
    expect(h.created).not.toHaveBeenCalled();
  });
});
