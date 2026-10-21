import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Churrasco', 'Bowl Mediterraneo', 'Pescado Al Horno']) {
  for (const enabled of [false, true]) for (const scenario of ['notes', 'form', 'correction']) {
    it(`${dish}: from greeting to order, ${scenario}, agent=${enabled}`, async () => {
      const menu = [
        { id: 99101, code: 99101, name: dish, description: 'Acompañado con arroz y ensalada', price: 24000, availableNow: true, attributes: [] },
        { id: 99102, code: 99102, name: 'Porcion De Arroz', price: 7000, availableNow: true, attributes: [] },
        { id: 99103, code: 99103, name: 'Porcion De Ensalada', price: 6000, availableNow: true, attributes: [] },
      ];
      const h = harness(menu, enabled);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      h.cfg.paymentMethods = h.cfg.paymentMethods.map(method => ({ ...method, enabled: method.flow !== 'mercadopago' }));
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 9910, dailyOrderNumber: 100 });
      // Start with the harness's empty session. No cart, checkout or contact flags seeded.
      await h.sendQueued('Hola buenas tardes');
      expect(h.conv.sessionData.cart).toEqual([]);
      const order = `Me das un ${dish} con poquito arroz y poquita ensalada`;
      let reply = await h.sendQueued(scenario === 'form' ? `${order}\nCarlos Torres\n3000000006\nCalle 10 #81A-20\nTorre 4 apto 505\ncontraentrega` : order);
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({ productId: 99101, quantity: 1, note: expect.stringMatching(/(?:poco|poquito).*arroz/i) });
      expect(h.conv.sessionData.cart[0].note).toMatch(/(?:poca|poquita).*ensalada/i);
      expect(reply).not.toMatch(/no.*(?:manejamos|tenemos)|necesito aclarar/i);
      if (scenario !== 'form') {
        reply = await h.sendQueued('Para domicilio\nCarlos Torres\n3000000006\nCalle 10 #81A-20\nTorre 4 apto 505');
        expect(h.conv.state).toBe('awaiting_payment');
        expect(reply).toMatch(/paga|pago/i);
        expect(reply).not.toMatch(/algo m[aá]s/i);
        if (scenario === 'correction') {
          const before = structuredClone(h.conv.sessionData.cart);
          reply = await h.sendQueued('Cuanto cuesta el pedido?');
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(reply).toMatch(/24.000|26.000/);
          expect(h.conv.state).toBe('awaiting_payment');
          reply = await h.sendQueued('Cambia la dirección a Calle 12 #34-56 apartamento 302');
          expect(h.conv.sessionData.address).toMatch(/12.*34.?56/i);
          expect(h.conv.sessionData.address).not.toMatch(/505|81A/i);
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.state).toBe('awaiting_payment');
        }
        reply = await h.sendQueued('contraentrega');
      }
      expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(reply).toMatch(/confirmar/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(1);
      expect(dto.items[0]).toMatchObject({ productId: 99101, note: expect.stringMatching(/arroz/i) });
      expect(dto.items[0].note).toMatch(/ensalada/i);
      expect(dto.customerName).toBe('Carlos Torres');
      expect(dto.phone.replace(/\D/g, '')).toContain('3000000006');
      expect(dto.address).toMatch(scenario === 'correction' ? /302/ : /505/);
      expect(h.conv.state).toBe('completed');
      await h.sendQueued('Gracias');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    });
  }
}
