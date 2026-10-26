/** Full catalog titles retain their identity beside explicitly separate bottles. */
import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { writeFileSync } from 'fs';
const menus = [
  { key: 'rice', name: 'Arroz Especial Con Medio Pollo', component: 'Medio Pollo', style: 'Frito' },
  { key: 'bowl', name: 'Bowl De Quinoa Con Tofu', component: 'Tofu', style: 'Asado' },
  { key: 'pasta', name: 'Pasta Con Champinones', component: 'Champinones', style: 'Salteados' },
];
for (const m of menus) for (const agent of [false, true]) {
  const menu = [
    { id: 88101, code: 88101, name: m.name, description: 'Incluye ensalada', price: 20000,
      availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Preparación', options: [m.style, 'Normal'] }] },
    { id: 88102, code: 88102, name: m.component, description: 'Porción independiente', price: 9000,
      availableNow: true, hasAttributes: false, attributes: [] },
    { id: 88103, code: 88103, name: 'Gaseosa 400ml', description: 'Bebida independiente', price: 4000,
      availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Manzana', 'Pepsi'] }] },
  ];
  const cases = [
    { key: 'no-style', text: `Quiero dos ${m.name} y una gaseosa 400ml Pepsi aparte`, quantity: 2 },
    { key: 'style', text: `Quiero dos ${m.name} ${m.style} y una gaseosa 400ml Pepsi aparte`, quantity: 2 },
    { key: 'newline', text: `Quiero dos ${m.name} ${m.style}\nUna gaseosa 400ml Pepsi aparte`, quantity: 2 },
    { key: 'single', text: `Quiero un ${m.name} ${m.style}`, quantity: 1 },
  ];
  for (const c of cases) it(`${m.key}/${agent}/${c.key}`, async () => {
    const catalog = new WhatsappCatalogService({} as never);
    const h = harness(menu, agent);
    const reply = await h.sendQueued(c.text);
    const cart = h.conv.sessionData.cart;
    writeFileSync(`/tmp/ppp-206-${m.key}-${agent}-${c.key}.json`, JSON.stringify({
      text: c.text, segments: catalog.splitMultiProductSegments(c.text, menu),
      legacyRiceSplit: catalog.looksLikeArrozComboPlusSizedChicken(c.text),
      cart, state: h.conv.state, reply, pending: h.conv.sessionData.pendingMatch,
    }, null, 2));
    expect(cart.map(line => line.productId).sort()).toEqual(c.key === 'single' ? [88101] : [88101, 88103]);
    expect(cart.find(line => line.productId === 88101)?.quantity).toBe(c.quantity);
    expect(String(reply)).toContain(m.name);
    expect(h.conv.state).toBe('building_cart');
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    if (c.key !== 'no-style') expect(cart.find(line => line.productId === 88101)?.attributes)
      .toContainEqual({ attributeName: 'Preparación', attributeValue: m.style });
    if (c.key !== 'single') expect(cart.find(line => line.productId === 88103))
      .toMatchObject({ quantity: 1, attributes: [{ attributeName: 'Sabor', attributeValue: 'Pepsi' }] });
    Object.assign(h.conv.sessionData, { orderType: 'pickup', fulfillmentChosen: true,
      phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true,
      address: 'Recoge en el local', addressConfirmed: true });
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 987, dailyOrderNumber: 98 });
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    await h.sendQueued('nada más'); await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items = h.service.ordersService.create.mock.calls[0][0].items;
    expect(items.filter(item => item.productId === 88101)).toHaveLength(c.quantity);
    expect(items).toHaveLength(c.quantity + (c.key === 'single' ? 0 : 1));
    expect(items.some(item => item.productId === 88102)).toBe(false);
    if (c.key !== 'single') expect(items.find(item => item.productId === 88103)?.attributes)
      .toContainEqual({ attributeName: 'Sabor', attributeValue: 'Pepsi' });

  });
}
