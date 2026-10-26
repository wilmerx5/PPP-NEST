/** Independent components retain their own units, options and notes through checkout. */
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';
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
  for (const reverse of [false, true]) for (const multiple of [false, true]) {
    it(`independent component ${m.key}/${agent}/${reverse}/${multiple}`, async () => {
      const h = harness(menu, agent);
      const hostQuantity = multiple ? 2 : 1;
      const extraQuantity = multiple ? 3 : 1;
      const meals = [
        `${multiple ? 'dos' : 'un'} ${m.name} ${m.style}${multiple ? ' sin cebolla' : ''}`,
        `${multiple ? 'tres' : 'un'} ${m.component}${multiple ? ' sin sal' : ''}`,
      ];
      if (reverse) meals.reverse();
      const reply = await h.sendQueued(`Quiero ${meals.join(' y ')} y una gaseosa 400ml Pepsi aparte`);
      const cart = h.conv.sessionData.cart;
      expect(cart.map(line => line.productId).sort()).toEqual([88101, 88102, 88103]);
      expect(cart.find(line => line.productId === 88101)).toMatchObject({ quantity: hostQuantity,
        attributes: [{ attributeName: 'Preparación', attributeValue: m.style }] });
      expect(cart.find(line => line.productId === 88102)?.quantity).toBe(extraQuantity);
      expect(cart.find(line => line.productId === 88103)).toMatchObject({ quantity: 1,
        attributes: [{ attributeName: 'Sabor', attributeValue: 'Pepsi' }] });
      expect(String(reply)).toContain(m.name);
      expect(String(reply)).toContain(m.component);
      expect(String(reply)).toContain('Gaseosa 400ml');
      expect(String(reply)).not.toMatch(/no manejamos|cu[aá]l prefieres|necesito aclarar/i);
      expect(h.conv.state).toBe('building_cart');
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      if (multiple) {
        expect(cart.find(line => line.productId === 88101)?.note).toMatch(/sin cebolla/i);
        expect(cart.find(line => line.productId === 88101)?.note).not.toMatch(/sin sal/i);
        expect(cart.find(line => line.productId === 88102)?.note).toMatch(/sin sal/i);
        expect(cart.find(line => line.productId === 88102)?.note).not.toMatch(/cebolla/i);
      }
      Object.assign(h.conv.sessionData, { orderType: 'pickup', fulfillmentChosen: true,
        phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true,
        address: 'Recoge en el local', addressConfirmed: true });
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 987, dailyOrderNumber: 98 });
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más'); await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items = h.service.ordersService.create.mock.calls[0][0].items;
      expect(items).toHaveLength(hostQuantity + extraQuantity + 1);
      expect(items.filter(item => item.productId === 88101)).toHaveLength(hostQuantity);
      expect(items.filter(item => item.productId === 88102)).toHaveLength(extraQuantity);
      for (const item of items) {
        if (item.productId === 88101) {
          expect(item.attributes).toContainEqual({ attributeName: 'Preparación', attributeValue: m.style });
          if (multiple) expect(item.note).toMatch(/sin cebolla/i);
        }
        if (multiple && item.productId === 88102) expect(item.note).toMatch(/sin sal/i);
        if (item.productId === 88103) expect(item.attributes)
          .toContainEqual({ attributeName: 'Sabor', attributeValue: 'Pepsi' });
      }
    });
  }
}

for (const [host, component] of [
  ['Ensalada Con Medio Aguacate', 'Medio Aguacate'],
  ['Desayuno Con Media Arepa', 'Media Arepa'],
  ['Postre Con Cuarto De Torta', 'Cuarto De Torta'],
]) for (const agent of [false, true]) {
  it(`fraction clause without article ${component}/${agent}`, async () => {
    const menu = [host, component, 'Agua 600ml'].map((name, index) => ({
      id: 88201 + index, code: 88201 + index, name, description: '', price: 5000,
      availableNow: true, hasAttributes: false, attributes: [],
    }));
    const h = harness(menu, agent);
    const reply = await h.sendQueued(`Quiero un ${host} y ${component} y un agua 600ml aparte`);
    expect(h.conv.sessionData.cart.map(line => line.productId).sort()).toEqual([88201, 88202, 88203]);
    expect(h.conv.sessionData.cart.every(line => line.quantity === 1)).toBe(true);
    expect(String(reply)).toContain(host);
    expect(String(reply)).toContain(component);
    expect(String(reply)).not.toMatch(/no manejamos|necesito aclarar/i);
    expect(h.conv.state).toBe('building_cart');
  });
}

for (const unit of ['litro y medio', 'litro   y medio', 'litro y cuarto', 'kilo y medio', 'libra y media', 'kilogramo y medio']) {
  it(`keeps fractional measurement inside its product clause: ${unit}`, () => {
    const catalog = new WhatsappCatalogService({} as never);
    const product = { id: 88301, code: 88301, name: 'Producto Especial', description: '', price: 2000,
      availableNow: true, hasAttributes: false, attributes: [] };
    const text = `Quiero un ${product.name} de ${unit}`;
    expect(catalog.orderSegmentForProduct(text, product, [product])).toBe(text);
  });
}

for (const extra of ['Medio Pollo', 'Cuarto De Torta']) {
  it(`does not merge a named extra into a measurement: ${extra}`, () => {
    const catalog = new WhatsappCatalogService({} as never);
    const menu = ['Jugo Por Litro', extra].map((name, index) => ({ id: 88401 + index,
      code: 88401 + index, name, description: '', price: 5000, availableNow: true,
      hasAttributes: false, attributes: [] }));
    const text = `Quiero un Jugo Por Litro y ${extra}`;
    expect(catalog.orderSegmentForProduct(text, menu[0], menu)).not.toContain(extra);
    expect(catalog.orderSegmentForProduct(text, menu[1], menu)).not.toContain('Jugo');
  });
}
