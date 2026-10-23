import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  { name: 'Malteada Artesanal', base: ['Entera', 'Deslactosada'], drinks: ['Vainilla', 'Fresa'] },
  { name: 'Batido Tropical', base: ['Entera', 'Vegetal'], drinks: ['Mango', 'Banano'] },
  { name: 'Smoothie Natural', base: ['Frío', 'Al clima'], drinks: ['Mora', 'Fresa'] },
  { name: 'Jugo Natural En Agua', base: ['Fría', 'Al clima'], drinks: ['Lulo', 'Mora'] },
  { name: 'Jugo Natural En Leche', base: ['Entera', 'Deslactosada'], drinks: ['Vainilla', 'Fresa'] },
  { name: 'Gaseosa Personal', base: ['Fría', 'Al clima'], drinks: ['Colombiana', 'Ginger'] },
];

for (const menu of menus) for (const agent of [false, true])
for (const interruption of ['price', 'name', 'invalid']) {
  test(`${menu.name}: two attributes with ${interruption}, agent=${agent}`, async () => {
    const h = harness([{ id: 91001, code: 81, name: menu.name, price: 30000,
      availableNow: true, hasAttributes: true, attributes: [
        { attributeName: 'Base', options: menu.base },
        { attributeName: 'Sabor', options: menu.drinks },
      ] }], agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 141, dailyOrderNumber: 141 });
    const opened = await h.sendQueued(`Quiero un ${menu.name}, qué sabores tienes?`);
    expect(opened).toContain(menu.base[1]);
    expect(h.conv.state).toBe('awaiting_attribute');
    expect(h.conv.sessionData.cart).toEqual([]);
    const first = await h.sendQueued('2');
    expect(first).toContain(menu.drinks[1]);
    expect(h.conv.sessionData.pendingAttribute?.selected).toEqual([
      { attributeName: 'Base', attributeValue: menu.base[1] },
    ]);
    const pending = structuredClone(h.conv.sessionData.pendingAttribute);
    const reply = await h.sendQueued(interruption === 'price' ? 'cuánto cuesta ese plato?' :
      interruption === 'name' ? 'a nombre de Ana Torres' : '9');
    expect(reply).toMatch(interruption === 'price' ? /30.000/ :
      interruption === 'name' ? /Ana Torres/ : /opci[oó]n|elige|prefieres|Sabor/);
    expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
    expect(h.conv.sessionData.cart).toEqual([]);
    const chosen = await h.sendQueued('2');
    expect(chosen).toContain(menu.base[1]);
    expect(chosen).toContain(menu.drinks[1]);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 91001, qty: 1,
      attrs: [`Base:${menu.base[1]}`, `Sabor:${menu.drinks[1]}`] })]);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    await h.sendQueued('no más, recojo en el local');
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('en efectivo');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.conv.state).toBe('completed');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toMatchObject({ productId: 91001, attributes: [
      { attributeName: 'Base', attributeValue: menu.base[1] },
      { attributeName: 'Sabor', attributeValue: menu.drinks[1] },
    ] });
    if (interruption === 'name') expect(dto.customerName).toBe('Ana Torres');
  });
}

const catalog = new WhatsappCatalogService({} as never);
test.each(['Malteadas', 'Batidos naturales', 'Smoothies'])('category %s keeps flavor explicit', categoryName => {
  const product = { id: 92001, code: 82, name: 'Especial Tropical', price: 9000, categoryName,
    hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Fresa'] }] };
  expect(catalog.requiresExplicitAttributeChoice(product, product.attributes[0])).toBe(true);
  expect(catalog.fillDefaultAttributes(product, [])).toEqual([]);
});
test.each(['Hamburguesa con malteada', 'Bowl con batido', 'Desayuno con smoothie'])('dish %s stays food', name => {
  const product = { id: 92002, code: 83, name, price: 30000, categoryName: 'Combos con bebidas',
    hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Suave', 'Picante'] }] };
  expect(catalog.isLikelyDrinkProduct(product)).toBe(false);
  expect(catalog.fillDefaultAttributes(product, [])).toEqual([{ attributeName: 'Sabor', attributeValue: 'Suave' }]);
});
