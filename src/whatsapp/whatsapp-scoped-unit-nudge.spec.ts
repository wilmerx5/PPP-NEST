import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

type Family = {
  id: string;
  main: { name: string; ref: string };
  variants: [string, string];
  tails: [string, string];
  familyWord: string;
  absent: { name: string; ref: string };
};

const families: Family[] = [
  {
    id: 'grill-juices',
    main: { name: 'Hamburguesa Doble', ref: 'hamburguesa' },
    variants: ['Jugo De Lulo', 'Jugo De Mora'],
    tails: ['lulo', 'mora'],
    familyWord: 'jugo',
    absent: { name: 'Arepa De Queso', ref: 'arepa' },
  },
  {
    id: 'regional-empanadas',
    main: { name: 'Bandeja Paisa', ref: 'bandeja' },
    variants: ['Empanada De Pollo', 'Empanada De Carne'],
    tails: ['pollo', 'carne'],
    familyWord: 'empanada',
    absent: { name: 'Patacón Con Hogao', ref: 'patacón' },
  },
  {
    id: 'pizzeria-shakes',
    main: { name: 'Pizza Hawaiana', ref: 'pizza' },
    variants: ['Malteada De Fresa', 'Malteada De Vainilla'],
    tails: ['fresa', 'vainilla'],
    familyWord: 'malteada',
    absent: { name: 'Lasaña Boloñesa', ref: 'lasaña' },
  },
];

const menuOf = (f: Family) => [
  { id: 1, code: 301, name: f.main.name, price: 26000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 2, code: 302, name: f.variants[0], price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 3, code: 303, name: f.variants[1], price: 7500, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 4, code: 304, name: f.absent.name, price: 12000, availableNow: true, hasAttributes: false, attributes: [] },
];

type Step = 'build' | 'pay' | 'final';
type Rig = ReturnType<typeof harness> & { created: jest.Mock };

function rig(f: Family, agent: boolean, step: Step, cart: Array<[number, number]> = [[1, 2], [2, 1], [3, 2]]): Rig {
  const menu = menuOf(f);
  const h = harness(menu as never, agent);
  h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.map(method => ({ ...method, enabled: method.flow !== 'mercadopago' }));
  const created = jest.fn().mockResolvedValue({ id: 1, dailyOrderNumber: 1 });
  const orders = (h.service as unknown as { ordersService: Record<string, unknown> }).ordersService;
  orders.create = created;
  orders.findTodayOrdersByPhone = async () => [];
  h.conv.sessionData.cart = cart.map(([id, quantity]) => {
    const product = menu.find(item => item.id === id)!;
    return { productId: id, code: product.code, name: product.name, unitPrice: product.price, quantity, attributes: [] };
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
  if (step === 'build') expect(h.conv.sessionData.address || '').toBe('');
  expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  expect(h.created).not.toHaveBeenCalled();
}

const cases = families.flatMap(family => [false, true].map(agent => ({ family, agent })));

describe.each(cases)('±1 sobre una línea nombrada con varias líneas — $family.id agent=$agent', ({ family: f, agent }) => {
  const main = f.main.name;
  const [v1, v2] = f.variants;
  const [t1, t2] = f.tails;
  const unchanged = () => [[main, 2], [v1, 1], [v2, 2]];

  it.each(['build', 'pay', 'final'] as Step[])('«quita una de <variante>» resta una unidad de esa línea (%s)', async step => {
    const h = rig(f, agent, step);
    const reply = await h.sendQueued(`quita una de ${t2}`);
    expect(rows(h)).toEqual([[main, 2], [v1, 1], [v2, 1]]);
    expect(reply).toContain(`Listo, ahora llevas *${v2}* ×1`);
    if (step === 'final') expect(reply).toMatch(/escribe \*confirmar\*/);
    expectKept(h, step);
  });

  it('«una de <variante> menos»', async () => {
    const h = rig(f, agent, 'build');
    await h.sendQueued(`una de ${t2} menos`);
    expect(rows(h)).toEqual([[main, 2], [v1, 1], [v2, 1]]);
    expectKept(h, 'build');
  });

  it('«uno menos de <variante>»', async () => {
    const h = rig(f, agent, 'build');
    await h.sendQueued(`uno menos de ${t2}`);
    expect(rows(h)).toEqual([[main, 2], [v1, 1], [v2, 1]]);
    expectKept(h, 'build');
  });

  it('«quítale una <plato>» resta una unidad sin abrir una lista', async () => {
    const h = rig(f, agent, 'build');
    await h.sendQueued(`quítale una ${f.main.ref}`);
    expect(rows(h)).toEqual([[main, 1], [v1, 1], [v2, 2]]);
    expectKept(h, 'build');
  });

  it.each(['build', 'final'] as Step[])('«otra <plato> más» suma una unidad sin abrir una lista (%s)', async step => {
    const h = rig(f, agent, step);
    await h.sendQueued(`otra ${f.main.ref} más`);
    expect(rows(h)).toEqual([[main, 3], [v1, 1], [v2, 2]]);
    expectKept(h, step);
  });

  it('«una <plato> más»', async () => {
    const h = rig(f, agent, 'build');
    await h.sendQueued(`una ${f.main.ref} más`);
    expect(rows(h)).toEqual([[main, 3], [v1, 1], [v2, 2]]);
    expectKept(h, 'build');
  });

  it('«pon otro <variante completa>» suma a esa línea', async () => {
    const h = rig(f, agent, 'build');
    await h.sendQueued(`pon otro ${v1.toLowerCase()}`);
    expect(rows(h)).toEqual([[main, 2], [v1, 2], [v2, 2]]);
    expectKept(h, 'build');
  });

  it('«quita una de <variante>» en ×1 quita esa línea y lo dice', async () => {
    const h = rig(f, agent, 'build');
    const reply = await h.sendQueued(`quita una de ${t1}`);
    expect(rows(h)).toEqual([[main, 2], [v2, 2]]);
    expect(reply).toContain(`Listo, quité *${v1}* del pedido`);
    expectKept(h, 'build');
  });

  it('contraste: «quita una <familia>» con dos líneas pregunta cuál y no cambia nada', async () => {
    const h = rig(f, agent, 'build');
    const reply = await h.sendQueued(`quita una ${f.familyWord}`);
    expect(rows(h)).toEqual(unchanged());
    expect(reply).toMatch(/¿De cuál quito una unidad\?/);
    expect(reply).toContain(v1);
    expect(reply).toContain(v2);
    expect(reply).not.toContain(`*${main}*`);
  });

  it('contraste: «quita uno» con varias líneas pregunta cuál', async () => {
    const h = rig(f, agent, 'build');
    const reply = await h.sendQueued('quita uno');
    expect(rows(h)).toEqual(unchanged());
    expect(reply).toMatch(/¿De cuál quito una unidad\?/);
  });

  it('contraste: «agrega otro» con varias líneas pregunta cuál', async () => {
    const h = rig(f, agent, 'build');
    const reply = await h.sendQueued('agrega otro');
    expect(rows(h)).toEqual(unchanged());
    expect(reply).toMatch(/¿De cuál agrego una unidad\?/);
  });

  it('contraste: «una <producto ausente> menos» dice que no está en el pedido', async () => {
    const h = rig(f, agent, 'build');
    const reply = await h.sendQueued(`una ${f.absent.ref} menos`);
    expect(rows(h)).toEqual(unchanged());
    expect(reply).toContain(`No tienes *${f.absent.name}* en el pedido`);
  });

  it('contraste: con una sola línea en ×1 «quita uno» no vacía el pedido', async () => {
    const h = rig(f, agent, 'build', [[1, 1]]);
    const reply = await h.sendQueued('quita uno');
    expect(rows(h)).toEqual([[main, 1]]);
    expect(reply).toMatch(/Solo queda/);
  });

  it('contraste: «quita una cebolla» no cambia cantidades', async () => {
    const h = rig(f, agent, 'build');
    await h.sendQueued('quita una cebolla');
    expect(rows(h)).toEqual(unchanged());
    expect(h.conv.sessionData.address || '').toBe('');
    expect(h.created).not.toHaveBeenCalled();
  });
});
