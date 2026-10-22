import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';

const menus = [
  { name: 'Combo Pollo Dorado', ref: 'combo de pollo', side: 'Porcion Papa Francesa', ask: 'papa francesa', drink: 'Manzana' },
  { name: 'Menu Hamburguesa Clasica', ref: 'hamburguesa', side: 'Aros De Cebolla', ask: 'aros de cebolla', drink: 'Limonada' },
  { name: 'Plato Pasta Napolitana', ref: 'plato de pasta', side: 'Pan De Ajo', ask: 'pan de ajo', drink: 'Agua' },
];
const pin = { messageType: 'location', latitude: 4.6368, longitude: -74.1486 };
const address = 'Calle 10 # 79-15 conjunto Prado Real torre 4 apto 410';

describe.each(menus)('$name: complete purchase, correction and checkout', m => {
  describe.each([false, true])('agent %s', agent => {
    const start = async (correctQuantity = false) => {
      const h = harness([
        { id: 811, code: 81, name: m.name, price: 30000, availableNow: true, hasAttributes: true,
          description: `Incluye ${m.ask}, ensalada y bebida`, attributes: [{ attributeName: 'Bebida', options: ['Colombiana', m.drink] }] },
        { id: 812, code: 82, name: m.side, price: 7000, availableNow: true, hasAttributes: false, attributes: [] },
      ] as never, agent);
      h.service.reply = (WhatsappOrchestratorService.prototype as any).reply.bind(h.service);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.agent.runTurn.mockResolvedValue({ reply: '¿Algo más?', actions: {}, toolCalls: [] });
      (h.conv as any).customerName = null;
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 109, dailyOrderNumber: 109 });
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      Object.assign(h.cfg, { deliveryFeeMode: 'distance', restaurantLat: 4.63, restaurantLng: -74.15 });
      const quote = jest.fn(async (q: any) => q.customerCoords
        ? { ok: true, fee: 2000, distanceKm: 0.7, source: 'google_directions', customer: q.customerCoords }
        : { ok: false, reason: 'address_ambiguous', message: 'No pude ubicarla. ¿Me compartes la ubicación de WhatsApp?' });
      h.service.deliveryRouting = { quoteDeliveryFee: quote };
      await h.sendQueued('para un domicilio');
      await h.sendQueued(`quiero un ${m.name}`);
      expect(h.conv.sessionData.cart.map((l: any) => [l.productId, l.quantity])).toEqual([[811, 1]]);
      const info = await h.sendQueued(`ese viene con ${m.ask}?`);
      expect(info).toMatch(/Sí ✅/);
      expect(h.conv.sessionData.cart).toHaveLength(1);
      await h.sendQueued(`dame una porción de ${m.ask} con el ${m.ref}`);
      expect(h.conv.sessionData.cart.map((l: any) => [l.productId, l.quantity])).toEqual([[811, 1], [812, 1]]);
      if (correctQuantity) {
        await h.sendQueued(`dame otro ${m.name}`);
        expect(h.conv.sessionData.cart.find((l: any) => l.productId === 811)?.quantity).toBe(2);
        const correction = await h.sendQueued(`solo pedí un ${m.name}`);
        expect(correction).not.toMatch(/¿Cuál|¿Cuánt/);
        expect(h.conv.sessionData.cart.map((l: any) => [l.productId, l.quantity])).toEqual([[811, 1], [812, 1]]);
      }
      await h.sendQueued(`la bebida del ${m.ref} con ${m.drink}`);
      expect(JSON.stringify(h.conv.sessionData.cart[0])).toContain(m.drink);
      await h.sendQueued('nada mas');
      expect(h.conv.state).toBe('awaiting_name');
      await h.sendQueued('Paula Jaramillo');
      expect(h.conv.customerName).toBe('Paula Jaramillo');
      await h.sendQueued(address);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      return { h, quote };
    };
    it('a pin resolving an unlocated street preserves access details through the order DTO', async () => {
      const { h, quote } = await start(true);
      const pinReply = await h.sendQueued('', pin);
      expect(pinReply).toContain('torre 4');
      expect(pinReply).toContain('apto 410');
      expect(quote.mock.calls.at(-1)?.[0].customerCoords).toEqual({ lat: pin.latitude, lng: pin.longitude });
      expect(h.conv.sessionData.address).toContain('torre 4');
      expect(h.conv.sessionData.address).toContain('apto 410');
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
      expect(h.conv.state).toBe('awaiting_payment');
      const amount = await h.sendQueued('Te transformo 39.000?');
      expect(amount).toContain('39.000');
      expect(h.conv.sessionData.cart.map((l: any) => [l.productId, l.quantity])).toEqual([[811, 1], [812, 1]]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('contraentrega');
      expect(h.conv.state).toBe('awaiting_final_confirm');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.address).toContain('torre 4');
      expect(dto.address).toContain('apto 410');
      expect(dto.items.map((i: any) => i.productId)).toEqual([811, 812]);
      expect(JSON.stringify(dto.items[0])).toContain(m.drink);
    });
    it('different options on two lines require clarification without deleting the side', async () => {
      const { h } = await start();
      await h.sendQueued(`dame otro ${m.name} con Colombiana`);
      const before = structuredClone(h.conv.sessionData.cart);
      expect(before.filter((line: any) => line.productId === 811)).toHaveLength(2);
      const reply = await h.sendQueued(`solo pedí un ${m.name}`);
      expect(reply).toContain('cuál quitamos');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    it.each(['confirmed', 'new-address-requested', 'named-pin', 'out-of-coverage'])(
      'contrast: %s does not carry the old apartment to a new pin', async kind => {
        const { h } = await start();
        if (kind === 'confirmed') Object.assign(h.conv.sessionData, { deliveryFeeCalculated: 2000, deliveryLat: 4.63, deliveryLng: -74.15 });
        if (kind === 'new-address-requested') await h.sendQueued('a una nueva');
        if (kind === 'out-of-coverage') h.conv.sessionData.deliveryOutOfCoverage = true;
        await h.sendQueued('', { ...pin, ...(kind === 'named-pin' ? { locationName: 'Edificio Nuevo', locationAddress: 'Carrera 7 # 20-30' } : {}) });
        expect(h.conv.sessionData.address).not.toContain('apto 410');
        expect(h.conv.sessionData.deliveryLat).toBe(pin.latitude);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    it('cancelling after the same conversation never creates an order', async () => {
      const { h } = await start();
      await h.sendQueued('', pin);
      const reply = await h.sendQueued('Cancela ya lo pedí por llamada');
      expect(h.conv.sessionData.cart).toHaveLength(0);
      expect(reply).not.toMatch(/No encontré|No entendí/);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  });
});
