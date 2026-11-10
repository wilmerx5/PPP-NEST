import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Jugo Natural', 'Batido Frutal', 'Refresco Natural']) {
  for (const agent of [false, true]) {
    for (const flavor of ['Mango', 'Lulo']) {
      for (const addressFirst of [false, true]) {
        test(`${dish}/${agent}/${flavor}/addressFirst=${addressFirst}: chosen options survive quantity correction`, async () => {
          const h = harness([
            { id: 94841, code: 81, name: dish, price: 30000, availableNow: true,
              hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] },
            { id: 94842, code: 82, name: 'Sopa Vegetal', price: 10000, availableNow: true, attributes: [] },
          ], agent);
          h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
          h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
          h.service.deliveryRouting = { quoteDeliveryFee: jest.fn().mockResolvedValue({
            ok: true, fee: 2000, distanceKm: 1, source: 'google_directions', customer: { lat: 4.63, lng: -74.15 },
          }) };
          h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 484, dailyOrderNumber: 484 });
          h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
          await h.sendQueued(`quiero 2 ${dish}`);
          expect(h.conv.sessionData.pendingAttribute).toBeDefined();
          const inquiry = await h.sendQueued(`cuánto cuesta el ${dish}`);
          expect(inquiry).toMatch(/30[.,]000/);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          await h.sendQueued(flavor);
          expect(h.cartRows()).toEqual([expect.objectContaining({ id: 94841, qty: 2, attrs: [`Sabor:${flavor}`] })]);
          await h.sendQueued('agrega una Sopa Vegetal');
          await h.sendQueued('no más, a domicilio');
          const address = 'Calle 12 # 80-20 torre 3 apto 402';
          if (addressFirst) await h.sendQueued(address);
          const previousAddress = h.conv.sessionData.address;
          await h.sendQueued(`cambia la cantidad de ${dish} a 1`);
          expect(h.cartRows()).toEqual([
            expect.objectContaining({ id: 94841, qty: 1, attrs: [`Sabor:${flavor}`] }),
            expect.objectContaining({ id: 94842, qty: 1 }),
          ]);
          expect(h.conv.sessionData.address).toBe(previousAddress);
          if (!addressFirst) await h.sendQueued(address);
          expect(h.conv.sessionData.address).toContain('402');
          expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
          await h.sendQueued('en efectivo');
          expect(h.conv.state).toBe('awaiting_final_confirm');
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          const review = h.replies.at(-1);
          expect(review).toContain(flavor);
          expect(review).toMatch(/42[.,]000/);
          await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const dto = h.service.ordersService.create.mock.calls[0][0];
          expect(dto.items).toHaveLength(2);
          expect(dto.items.map((item: any) => item.productId).sort()).toEqual([94841, 94842]);
          expect(JSON.stringify(dto.items)).toContain(flavor);
          expect(dto.address).toContain('402');
        });
      }
    }
  }
}
