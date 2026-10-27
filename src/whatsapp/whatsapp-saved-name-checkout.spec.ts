import { harness } from './whatsapp-accuracy.test-support';

for (const product of ['Arroz Con Pollo', 'Pizza Margarita', 'Bowl Vegetal']) {
  for (const agent of [false, true]) {
    it(`saved recipient skips name request without skipping confirmation: ${product}/${agent}`, async () => {
      const h = harness([{id: 42, code: 42, name: product, price: 20000, availableNow: true, attributes: []}], agent);
      h.conv.customerName = 'Katherine Agudelo';
      Object.assign(h.cfg, {deliveryFeeMode: 'distance', restaurantLat: 4.63, restaurantLng: -74.15});
      h.service.deliveryRouting = {quoteDeliveryFee: jest.fn().mockResolvedValue({ok: true, fee: 2000, distanceKm: 0.6, source: 'google_directions', customer: {lat: 4.63, lng: -74.15}})};
      h.service.ordersService.create = jest.fn().mockResolvedValue({id: 997, dailyOrderNumber: 97});
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      Object.assign(h.conv.sessionData, {phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true});
      await h.sendQueued(`Me das un ${product} para Calle 10 #81A-20`);
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.customerName).toBe('Katherine Agudelo');
      expect(h.replies.at(-1)).toMatch(/cómo pagas|método de pago/i);
      expect(h.replies.join('\n')).not.toMatch(/escribe tu.*nombre|a nombre de qui[eé]n/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('contraentrega');
      expect(h.replies.at(-1)).toMatch(/confirmar/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.customerName).toBe('Katherine Agudelo');
      expect(dto.items).toHaveLength(1);
      expect(dto.items[0].productId).toBe(42);
      expect(h.conv.state).toBe('completed');
    });
  }
}
