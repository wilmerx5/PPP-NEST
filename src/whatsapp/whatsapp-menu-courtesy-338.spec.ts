import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Churrasco', 'Bowl Vegetal']) for (const agent of [false, true]) {
  for (const stage of ['empty', 'cart', 'confirm']) for (const text of ['Qué opciones tienen. Gracias', 'Que opciones tienen por favor', 'Gracias, qué opciones tienen?', 'Cuales son las opciones, muchas gracias']) {
    it(`${dish} ${stage}: ${text}, agent=${agent}`, async () => {
      const h = harness([
        { id: 96201, code: 1, name: dish, categoryName: 'Platos', price: 30000, availableNow: true, hasAttributes: false, attributes: [] },
        { id: 96202, code: 2, name: 'Limonada Natural', categoryName: 'Bebidas', price: 5000, availableNow: true, hasAttributes: false, attributes: [] },
      ], agent);
      h.cfg.menuUrl = 'https://example.test/menu';
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 338, dailyOrderNumber: 338 });
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      if (stage !== 'empty') await h.sendQueued(`un ${dish}`);
      if (stage === 'confirm') {
        await h.sendQueued('no mas'); await h.sendQueued('contraentrega');
        expect(h.conv.state).toBe('awaiting_final_confirm');
      }
      const before = structuredClone(h.conv.sessionData.cart);
      const state = h.conv.state;
      const reply = await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.state).toBe(state);
      expect(reply).toMatch(/Platos/);
      expect(reply).toMatch(/Bebidas/);
      expect(reply).not.toMatch(/productos de gracias|no tenemos|no manejamos|no entend[ií]/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if (stage === 'empty') {
        const category = h.conv.sessionData.pendingCategoryBrowse!.categories.indexOf('Bebidas') + 1;
        expect(category).toBeGreaterThan(0);
        await h.sendQueued(String(category));
        expect(h.conv.sessionData.cart).toEqual([]);
        await h.sendQueued('una Limonada Natural');
        expect(h.conv.sessionData.cart.map(item => item.productId)).toEqual([96202]);
      }
      if (stage === 'confirm') {
        expect(reply).toMatch(/confirmar/);
        const receipt = await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.service.ordersService.create.mock.calls[0][0].items.map(item => item.productId)).toEqual([96201]);
        expect(receipt).toContain('30.000');
      }
    });
  }
}

for (const dish of ['Churrasco', 'Bowl Vegetal']) for (const agent of [false, true]) {
  it(`${dish}: preserves pending flavor while browsing, agent=${agent}`, async () => {
    const h = harness([
      { id: 96201, code: 1, name: dish, categoryName: 'Platos', price: 30000, availableNow: true, hasAttributes: false, attributes: [] },
      { id: 96203, code: 3, name: 'Coca Cola 1.5L', categoryName: 'Bebidas', price: 8500, availableNow: true, hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Original', 'Zero'] }] },
    ], agent);
    await h.sendQueued(`un ${dish}`);
    await h.sendQueued('una Coca Cola 1.5L');
    expect(h.conv.sessionData.pendingAttribute).toBeDefined();
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.sendQueued('Que opciones tienen. Gracias');
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
    expect(h.conv.sessionData.pendingCategoryBrowse).toEqual(before.pendingCategoryBrowse);
    expect(reply).toMatch(/Platos/); expect(reply).toMatch(/Bebidas/);
    expect(reply).toMatch(/sabor/i);
    expect(reply).not.toMatch(/número.*categoría/);
    await h.sendQueued('Original');
    expect(h.conv.sessionData.cart.map(item => item.productId)).toEqual([96201, 96203]);
  });
}

for (const text of [
  'qué opciones tienen de bebidas, gracias',
  'qué opciones tienen y agrega un arroz',
  'qué opciones tienen sin azúcar',
  'no me muestres las opciones',
  'quiero un plato llamado Gracias',
  'gracias',
  'qué opciones tienen para pagar',
  'cuánto cuestan las opciones',
]) it(`does not swallow other intents: ${text}`, () => {
  const h = harness([], false);
  expect(h.service.catalogService.isGeneralMenuOptionsInquiry(text)).toBe(false);
});
