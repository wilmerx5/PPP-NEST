/** Contextual combo offers: verbal acceptance must revalidate the quoted price. */
import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  { key: 'rice', name: 'Arroz Especial Con Pollo', option: 'Asado' },
  { key: 'bowl', name: 'Bowl De Quinoa Con Tofu', option: 'Asado' },
  { key: 'pasta', name: 'Pasta Con Champinones', option: 'Salteados' },
];
const product = (id: number, name: string, price: number, description: string, attributes: { attributeName: string; options: string[] }[]) =>
  ({ id, code: id, name, price, description, availableNow: true, hasAttributes: !!attributes.length, attributes });

for (const m of menus) for (const agent of [false, true]) {
  const preparation = { attributeName: 'Preparación', options: [m.option, 'Normal'] };
  const dish = product(99201, m.name, 20000, 'Incluye ensalada', [preparation]);
  const combo = product(99202, `Combo ${m.name}`, 25000, 'Incluye ensalada y bebida de 400ml',
    [preparation, { attributeName: 'Bebida', options: ['Agua', 'Pepsi'] }]);

  for (const scenario of ['accept', 'decline', 'price', 'price_plain', 'price_drink', 'stock'] as const) {
    it(`contextual offer ${m.key}/${agent}/${scenario}`, async () => {
      const h = harness([dish, combo], agent);
      h.cfg.ignoreBusinessHours = false;
      const priceChanged = scenario.startsWith('price');
      // Real router purchase: do not fabricate an originalLine for replacement.
      await h.sendQueued(`Quiero dos ${m.name} ${m.option}, sin cebolla`);
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({ productId: dish.id, quantity: 2, note: expect.stringMatching(/sin cebolla/i) });
      const offer = await h.sendQueued('eso lleva bebida?');
      expect(offer).toContain(combo.name);
      expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine.productId).toBe(dish.id);
      const before = structuredClone(h.conv.sessionData.cart);

      if (priceChanged || scenario === 'stock') {
        h.service.catalogService.getMenuProducts.mockResolvedValue([dish, {
          ...combo, price: priceChanged ? 28000 : combo.price,
          availableNow: scenario !== 'stock',
        }]);
      }
      const reply = await h.sendQueued(scenario === 'decline' ? 'no gracias' : scenario === 'price_plain' ? 'sí' : scenario === 'price_drink' ? 'Pepsi' : 'sí, el combo');
      if (priceChanged || scenario === 'stock') {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
        expect(reply).toMatch(priceChanged ? /precio.*cambi|cambi.*precio/i : /no.*disponible|agotad/i);
        if (scenario === 'stock') return;
        expect(reply).toContain('$28.000');
        expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
        await h.sendQueued('1');
      }
      if (scenario === 'decline') {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingMatch).toBeFalsy();
        expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
        expect(reply).toMatch(/sigue igual|como est[aá]/i);
      } else {
        if (!priceChanged) expect(reply).toMatch(/Bebida/i);
        if (scenario === 'price_drink') {
          // The drink was supplied before the re-quote; accepting its price must retain it.
          expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
          expect(h.conv.sessionData.pendingMatch).toBeFalsy();
        } else {
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.sessionData.pendingAttribute?.productId).toBe(combo.id);
          await h.sendQueued('Pepsi');
        }
        expect(h.conv.sessionData.cart).toHaveLength(1);
        expect(h.conv.sessionData.cart[0]).toMatchObject({ productId: combo.id, quantity: 2, note: before[0].note });
        expect(h.conv.sessionData.cart[0].unitPrice).toBe(priceChanged ? 28000 : combo.price);
        expect(h.conv.sessionData.cart[0].attributes).toEqual(expect.arrayContaining([
          { attributeName: 'Preparación', attributeValue: m.option },
          { attributeName: 'Bebida', attributeValue: 'Pepsi' },
        ]));
      }
      Object.assign(h.conv.sessionData, { orderType: 'pickup', fulfillmentChosen: true, phoneConfirmed: true,
        contactPhone: h.conv.phoneE164, notesCollected: true, address: 'Recoge en el local', addressConfirmed: true });
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 992, dailyOrderNumber: 92 });
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');
      await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(2);
      for (const item of dto.items) {
        expect(item.productId).toBe(scenario === 'decline' ? dish.id : combo.id);
        expect(item.note).toMatch(/sin cebolla/i);
        expect(item.attributes).toContainEqual({ attributeName: 'Preparación', attributeValue: m.option });
        if (scenario !== 'decline') expect(item.attributes).toContainEqual({ attributeName: 'Bebida', attributeValue: 'Pepsi' });
      }
    });
  }
}
