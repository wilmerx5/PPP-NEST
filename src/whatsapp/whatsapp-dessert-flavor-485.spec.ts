import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Helado Artesanal', 'Paleta Frutal', 'Sorbete Natural']) {
  for (const agent of [false, true]) {
    for (const flavor of ['Mango', 'Lulo']) {
      for (const addressFirst of [false, true]) {
        test(`${dish}/${agent}/${flavor}/addressFirst=${addressFirst}: chosen options survive quantity correction`, async () => {
          const h = harness([
            { id: 94851, code: 81, name: dish, price: 30000, availableNow: true,
              hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] },
            { id: 94852, code: 82, name: 'Sopa Vegetal', price: 10000, availableNow: true, attributes: [] },
          ], agent);
          h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
          h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
          h.service.deliveryRouting = { quoteDeliveryFee: jest.fn().mockResolvedValue({
            ok: true, fee: 2000, distanceKm: 1, source: 'google_directions', customer: { lat: 4.63, lng: -74.15 },
          }) };
          h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 485, dailyOrderNumber: 485 });
          h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
          await h.sendQueued(`quiero 2 ${dish}`);
          expect(h.conv.sessionData.pendingAttribute).toBeDefined();
          const inquiry = await h.sendQueued(`cuánto cuesta el ${dish}`);
          expect(inquiry).toMatch(/30[.,]000/);
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          await h.sendQueued(flavor);
          expect(h.cartRows()).toEqual([expect.objectContaining({ id: 94851, qty: 2, attrs: [`Sabor:${flavor}`] })]);
          await h.sendQueued('agrega una Sopa Vegetal');
          await h.sendQueued('no más, a domicilio');
          const address = 'Calle 12 # 80-20 torre 3 apto 402';
          if (addressFirst) await h.sendQueued(address);
          const previousAddress = h.conv.sessionData.address;
          await h.sendQueued(`cambia la cantidad de ${dish} a 1`);
          expect(h.cartRows()).toEqual([
            expect.objectContaining({ id: 94851, qty: 1, attrs: [`Sabor:${flavor}`] }),
            expect.objectContaining({ id: 94852, qty: 1 }),
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
          expect(dto.items.map((item: any) => item.productId).sort()).toEqual([94851, 94852]);
          expect(JSON.stringify(dto.items)).toContain(flavor);
          expect(dto.address).toContain('402');
        });
      }
    }
  }
}

const catalog = new WhatsappCatalogService({} as never);
for (const category of ['Helados', 'Paletas artesanales', 'Sorbetes']) {
  for (const secondary of [false, true]) {
    test(`generic product in ${category}, secondary=${secondary}`, () => {
      const product = { id: 94853, code: 83, name: 'Especial de la casa', price: 9000,
        categoryName: secondary ? 'Especiales' : category,
        categoryNames: secondary ? ['Especiales', category] : [category],
        hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] };
      expect(catalog.fillDefaultAttributes(product, [])).toEqual([]);
      const selected = [{ attributeName: 'Sabor', attributeValue: 'Lulo' }];
      expect(catalog.fillDefaultAttributes(product, selected)).toEqual(selected);
      expect(catalog.fillDefaultAttributes({ ...product,
        attributes: [{ attributeName: 'Sabor', options: ['Mango'] }] }, []))
        .toEqual([{ attributeName: 'Sabor', attributeValue: 'Mango' }]);
    });
  }
}
for (const name of ['Bowl con helado', 'Combo con paleta', 'Menú con sorbete']) {
  test(`${name} does not turn a savory default into a dessert flavor`, () => {
    const product = { id: 94854, code: 84, name, price: 30000,
      hasAttributes: true, attributes: [{ attributeName: 'Sabor', options: ['Suave', 'Picante'] }] };
    expect(catalog.fillDefaultAttributes(product, []))
      .toEqual([{ attributeName: 'Sabor', attributeValue: 'Suave' }]);
  });
}
