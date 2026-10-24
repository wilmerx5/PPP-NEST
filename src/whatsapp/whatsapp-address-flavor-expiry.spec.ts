import { WhatsappCleanupService } from './whatsapp-cleanup.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, drink, flavor] of [
  ['Bowl Vegetal', 'Jugo Natural', 'Mango'],
  ['Sandwich Vegetal', 'Malteada', 'Fresa'],
  ['Ravioles', 'Smoothie', 'Mora'],
]) for (const agent of [false, true]) {
  test(`${drink}: address/flavor collision after real expiry cleanup; agent=${agent}`, async () => {
    const h = harness([
      {id: 95101, code: 81, name: dish, price: 20000, availableNow: true, attributes: []},
      {id: 95102, code: 82, name: drink, categoryName: 'Bebidas', price: 6000, availableNow: true,
        hasAttributes: true, attributes: [{attributeName: 'Sabor', options: [flavor, 'Naranja']}]},
    ], agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({reply: '¿Cuál prefieres?', actions: {}});
    h.service.ordersService.create = jest.fn().mockResolvedValue({id: 155, dailyOrderNumber: 155});
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    Object.assign(h.cfg, {deliveryFeeMode: 'distance', restaurantLat: 4.63, restaurantLng: -74.15});
    h.service.deliveryRouting = {quoteDeliveryFee: jest.fn().mockResolvedValue({ok: true, fee: 2000,
      distanceKm: 1, source: 'google_directions', geocodedAddress: 'Calle 10 #20-30, Bogotá',
      customer: {lat: 4.64, lng: -74.14}})};
    await h.sendQueued(`Quiero un ${dish}`);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`Agrega un ${drink}`);
    expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId: 95102});
    expect(h.conv.sessionData.pendingAttribute?.quantity ?? 1).toBe(1);
    await h.sendQueued('Calle 10 #20-30 apartamento 1 apartamento 2');
    expect(h.conv.sessionData.pendingAddressConflict).toBeDefined();
    const before = structuredClone(h.conv.sessionData);
    const reply = await h.sendQueued('1');
    expect(reply).toMatch(/apartamento/i);
    expect(reply).toMatch(/producto|plato/i);
    expect(h.conv.sessionData).toEqual(before);
    expect(h.service.deliveryRouting.quoteDeliveryFee).not.toHaveBeenCalled();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
      const persistence = {
        getSession: () => structuredClone(h.conv.sessionData),
        saveSession: async (_conv: unknown, patch: any, state?: string) => {
          h.conv.sessionData = JSON.parse(JSON.stringify({...h.conv.sessionData, ...patch}));
          if (state) h.conv.state = state;
        },
      };
      const meta = {sendText: jest.fn().mockResolvedValue(undefined)};
      const conversations = {
        ...persistence,
        findAgentIdleTakeovers: async () => [], findClientIdleTakeovers: async () => [],
        findIdlePendingChoices: async () => [h.conv], findIdleMpPayments: async () => [],
        findIdleOrderDrafts: async () => [], logMessage: async () => undefined, touchOutbound: async () => undefined,
        clearPendingChoices: async (conv: any) => WhatsappConversationService.prototype.clearPendingChoices.call(persistence, conv),
      };
      const cleanup = new WhatsappCleanupService(conversations as any,
        {getEffectiveConfig: async () => ({...h.cfg, sessionIdleNotify: true, pendingChoiceIdleMinutes: 15})} as any, meta as any);
      await (cleanup as any).runSessionExpiry();
      expect(meta.sendText).toHaveBeenCalledWith('customer', expect.stringMatching(/venci[oó].*elecci[oó]n/i));
      const question = await h.sendQueued(`¿Con qué viene el ${dish}?`);
      expect(question).toContain(dish);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.pendingAddressConflict).toBeDefined();
    await h.sendQueued('2');
    expect(h.conv.sessionData.pendingAddressConflict).toBeUndefined();
    expect(h.conv.sessionData.address).toMatch(/apartamento 2/i);
    await h.sendQueued('nada más');
    await h.sendQueued('en efectivo');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto = h.service.ordersService.create.mock.calls[0][0];
    expect(dto.address).toMatch(/apartamento 2/i);
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toMatchObject({productId: 95101});
  });
}
