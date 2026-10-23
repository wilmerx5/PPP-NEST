import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  { name: 'Lasagna De Verduras', side: 'pan de ajo', price: 26000 },
  { name: 'Bowl De Garbanzos', side: 'arroz integral', price: 18000 },
  { name: 'Filete Al Horno', side: 'puré de papa', price: 32000 },
];
const address = 'Calle 12 # 34-56 conjunto Jardines del Sol torre 3 apto 204';

for (const menu of menus) for (const enabled of [false, true]) for (const question of ['price', 'contents']) for (const addressFirst of [false, true]) {
  test(`${menu.name}: missing name, ${question}, full address, new phone and confirmation; addressFirst=${addressFirst}, agent=${enabled}`, async () => {
    const h = harness([{
      id: 89401, code: 89401, name: menu.name, price: menu.price,
      description: `Incluye ${menu.side} y ensalada`, availableNow: true,
      hasAttributes: false, attributes: [],
    }], enabled);
    (h.conv as any).customerName = null;
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.agent.runTurn.mockImplementation(async ({ userMessage }: { userMessage: string }) => userMessage === 'para un domicilio'
      ? { reply: 'Claro, ¿qué te gustaría pedir?', actions: { setOrderType: 'delivery' }, toolCalls: ['set_order_type'] }
      : { reply: '¿Cuál prefieres?', actions: {}, toolCalls: [] });
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 134, dailyOrderNumber: 134 });
    Object.assign(h.cfg, { deliveryFeeMode: 'distance', restaurantLat: 4.63, restaurantLng: -74.15 });
    const quote = jest.fn().mockResolvedValue({
      ok: true, fee: 2000, distanceKm: 1.2, source: 'google_directions',
      customer: { lat: 4.64, lng: -74.14 },
    });
    h.service.deliveryRouting = { quoteDeliveryFee: quote };
    expect(h.conv.sessionData.cart).toEqual([]);
    await h.sendQueued('para un domicilio');
    expect(h.conv.sessionData.orderType).toBe('delivery');
    await h.sendQueued(`Quiero dos ${menu.name} sin cebolla`);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 89401, qty: 2, note: expect.stringMatching(/sin cebolla/i) })]);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('así está bien gracias');
    expect(h.conv.state).toBe('awaiting_name');

    const reply = await h.sendQueued(question === 'price' ? 'cuánto cuesta todo?' : `ese viene con ${menu.side}?`);
    if (question === 'price') expect(reply?.replace(/[.,]/g, '')).toContain(String(menu.price * 2));
    else { expect(reply).toContain(menu.side); expect(reply).toMatch(/sí|incluye|viene/i); }
    expect(h.conv.customerName).toBeNull();
    expect(h.conv.state).toBe('awaiting_name');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(quote).not.toHaveBeenCalled();

    if (addressFirst) {
      await h.sendQueued(address);
      expect(h.conv.state).toBe('awaiting_name');
      expect(h.conv.customerName).toBeNull();
      const beforeName = h.conv.sessionData.address;
      const quoteCallsBeforeName = quote.mock.calls.length;
      expect(quoteCallsBeforeName).toBeGreaterThan(0);
      await h.sendQueued('Camila Rojas');
      expect(h.conv.sessionData.address).toBe(beforeName);
      expect(quote).toHaveBeenCalledTimes(quoteCallsBeforeName);
    } else {
      await h.sendQueued('Camila Rojas');
      expect(h.conv.state).toBe('awaiting_address');
      await h.sendQueued(address);
      expect(quote).toHaveBeenCalled();
    }
    expect(h.conv.customerName).toBe('Camila Rojas');
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.address).toContain('torre 3');
    expect(h.conv.sessionData.address).toContain('apto 204');
    expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
    const destination = h.conv.sessionData.address;
    const quoteCalls = quote.mock.calls.length;
    const phoneReply = await h.sendQueued('Mi teléfono es 3000000007');
    expect(phoneReply).toMatch(/300\s?000\s?0007|tel[eé]fono|contacto|n[uú]mero/i);
    expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toContain('3000000007');
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.customerName).toBe('Camila Rojas');
    expect(h.conv.sessionData.address).toBe(destination);
    expect(quote).toHaveBeenCalledTimes(quoteCalls);
    expect(h.conv.sessionData.cart).toEqual(cart);

    const payment = await h.sendQueued('en efectivo');
    expect(payment).toMatch(/confirm/i);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.customerName).toBe('Camila Rojas');
    expect(dto.phone.replace(/\D/g, '')).toContain('3000000007');
    expect(dto.address).toContain('torre 3');
    expect(dto.address).toContain('apto 204');
    expect(dto.items).toHaveLength(2);
    for (const item of dto.items) expect(item).toMatchObject({ productId: 89401, note: expect.stringMatching(/sin cebolla/i) });
    expect(h.conv.state).toBe('completed');
  });
}
