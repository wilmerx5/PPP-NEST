import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  ['Ravioles De Ricota', 'Pan De Ajo'],
  ['Bowl De Garbanzos', 'Falafel'],
  ['Filete Al Horno', 'Porcion De Yuca'],
];
for (const [dish, side] of menus) for (const enabled of [false, true]) for (const reason of ['address_ambiguous', 'out_of_coverage']) for (const exit of ['correct', 'pickup', 'cancel']) {
  test(`${dish}: ${reason} allows price, cart, removal and phone before address recovery; exit=${exit}, agent=${enabled}`, async () => {
    const h = harness([
      { id: 89601, code: 89601, name: dish, price: 20000, availableNow: true, attributes: [] },
      { id: 89602, code: 89602, name: side, price: 5000, availableNow: true, attributes: [] },
    ], enabled);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 136, dailyOrderNumber: 136 });
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    Object.assign(h.conv.sessionData, { orderType: 'delivery', fulfillmentChosen: true });
    Object.assign(h.cfg, { deliveryFeeMode: 'distance', restaurantLat: 4.63, restaurantLng: -74.15 });
    const quote = jest.fn(async ({ customerAddress }: { customerAddress: string }) => customerAddress.includes('20-30')
      ? { ok: true, fee: 2000, distanceKm: 1, source: 'google_directions', customer: { lat: 4.64, lng: -74.14 } }
      : { ok: false, reason, message: reason === 'address_ambiguous' ? 'No pude ubicarla. Comparte calle y número.' : 'Fuera de cobertura.', distanceKm: reason === 'out_of_coverage' ? 12 : undefined });
    h.service.deliveryRouting = { quoteDeliveryFee: quote };
    await h.sendQueued(`Quiero dos ${dish} sin cebolla`);
    await h.sendQueued(`Agrega un ${side}`);
    expect(h.cartRows().map(row => [row.id, row.qty])).toEqual([[89601, 2], [89602, 1]]);
    await h.sendQueued('nada más');
    const unresolved = await h.sendQueued('Calle 90 #90-99 torre 2 apto 401');
    expect(unresolved).toMatch(reason === 'address_ambiguous' ? /ubicar|identificar|calle/i : /fuera.*cobertura/i);
    expect(h.conv.state).not.toBe('awaiting_final_confirm');
    const before = structuredClone(h.conv.sessionData.cart);
    const price = await h.sendQueued('cuánto cuesta todo?');
    expect(price?.replace(/[.,]/g, '')).toContain('45000');
    expect(h.conv.sessionData.cart).toEqual(before);
    const shown = await h.sendQueued('déjame ver el carrito');
    expect(shown).toContain(dish);
    expect(shown).toContain(side);
    expect(h.conv.sessionData.cart).toEqual(before);
    const removed = await h.sendQueued('quita la 2');
    expect(removed).not.toMatch(/no me quedó clara la dirección/i);
    expect(h.cartRows()).toEqual([expect.objectContaining({ id: 89601, qty: 2, note: expect.stringMatching(/sin cebolla/i) })]);
    const phone = await h.sendQueued('Mi teléfono es 3000000007');
    expect(phone).toMatch(/tel[eé]fono|contacto|n[uú]mero|300/i);
    expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toContain('3000000007');
    const premature = await h.sendQueued('confirmar');
    expect(premature).toMatch(reason === 'address_ambiguous' ? /Comparte calle y número/i : /fuera.*cobertura/i);
    expect(premature).not.toMatch(/📍[^\n]*✅/);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.conv.state).not.toBe('completed');

    if (exit === 'cancel') {
      const cancelled = await h.sendQueued('Cancela ya lo pedí por teléfono');
      expect(cancelled).toMatch(/cancel|vaci|reinici/i);
      expect(h.conv.sessionData.cart).toEqual([]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      return;
    }
    if (exit === 'pickup') {
      const pickup = await h.sendQueued('mejor recojo en el local');
      expect(pickup).toMatch(/recog|recoj/i);
      expect(h.conv.sessionData.orderType).toBe('pickup');
    } else {
      const resolved = await h.sendQueued('Cambiar dirección a Calle 10 #20-30 torre 4 apto 502');
      expect(resolved).toContain('502');
      expect(h.conv.sessionData.address).not.toMatch(/90-99|401/);
      expect(h.conv.sessionData.deliveryOutOfCoverage).not.toBe(true);
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
    }
    expect(h.conv.state).toBe('awaiting_payment');
    await h.sendQueued('en efectivo');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(2);
    for (const item of dto.items) expect(item).toMatchObject({ productId: 89601, note: expect.stringMatching(/sin cebolla/i) });
    if (exit === 'correct') expect(dto.address).toMatch(/20-30.*torre 4.*502/i);
    else expect(dto.address || '').not.toMatch(/90-99|401/);
    expect(dto.phone.replace(/\D/g, '')).toContain('3000000007');
    expect(dto.deliveryFee).toBe(exit === 'pickup' ? undefined : 2000);
  });
}
