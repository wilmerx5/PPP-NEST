import {
  splitAccompanimentPurchase,
  includesAccompaniment,
} from './whatsapp-accompaniment-offer';
import { harness, products } from './whatsapp-accuracy.test-support';
const menus = [
  ['Arroz Chino', 'gaseosa', 'Bebida de 1.5L'],
  ['Bowl Vegetal', 'ensalada', 'ensalada fresca'],
  ['Pasta Del Huerto', 'pan', 'pan artesanal'],
];
for (const [dish, side, included] of menus)
  for (const enabled of [false, true])
    for (const quantity of [1, 2]) {
      for (const available of [true, false])
        it(`${dish} with ${side} bundle=${available} quantity=${quantity} agent=${enabled}`, async () => {
          const menu = [
            {
              id: 91001,
              code: 91001,
              name: dish,
              price: 15000,
              availableNow: true,
              attributes: [],
            },
            {
              id: 91002,
              code: 91002,
              name: `Combo De ${dish}`,
              description: `Incluye ${included}`,
              price: 22000,
              availableNow: available,
              attributes: [],
            },
            {
              id: 91003,
              code: 91003,
              name: side,
              price: 4000,
              availableNow: true,
              attributes: [],
            },
          ];
          const h = harness(menu, enabled);
          h.cfg.ignoreBusinessHours = false;
          h.service.aiService.generateTurn = jest
            .fn()
            .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
          Object.assign(h.conv.sessionData, {
            fulfillmentChosen: true,
            phoneConfirmed: true,
            contactPhone: h.conv.phoneE164,
            notesCollected: true,
          });
          h.service.ordersService.create = jest
            .fn()
            .mockResolvedValue({ id: 910, dailyOrderNumber: 91 });
          const reply = await h.sendQueued(
            `Quiero ${quantity} ${dish} con ${side}`,
          );
          if (available) {
            expect(h.conv.sessionData.cart).toHaveLength(0);
            expect(
              h.conv.sessionData.pendingMatch?.candidates.map((p) => p.id),
            ).toEqual([91002]);
            expect(reply).toContain(menu[1].name);
            expect(reply).toContain('22.000');
            await h.sendQueued('1');
            expect(h.conv.sessionData.cart).toHaveLength(1);
            expect(h.conv.sessionData.cart[0]).toEqual(
              expect.objectContaining({ productId: 91002, quantity }),
            );
            await h.sendQueued('no más, recojo en el local');
            if (h.conv.state === 'awaiting_payment') await h.sendQueued('1');
            await h.sendQueued('confirmar');
            expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
            const dto = h.service.ordersService.create.mock.calls[0][0];
            expect(dto.items).toHaveLength(quantity);
            expect(dto.items.every((item) => item.productId === 91002)).toBe(
              true,
            );
          } else {
            expect(
              h.conv.sessionData.pendingMatch?.candidates.some(
                (p) => p.id === 91002,
              ),
            ).not.toBe(true);
            expect(h.conv.sessionData.cart.map((p) => p.productId)).toEqual(
              expect.arrayContaining([91001, 91003]),
            );
            expect(
              h.conv.sessionData.cart.some((p) => p.productId === 91002),
            ).toBe(false);
          }
        });
    }
for (const enabled of [false, true])
  it(`exact arroz chino request agent=${enabled}`, async () => {
    const h = harness(products, enabled);
    h.service.aiService.generateTurn = jest
      .fn()
      .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
    const reply = await h.sendQueued('Quiero Un arroz chino con gaseosa');
    expect(h.conv.sessionData.cart).toHaveLength(0);
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.pendingMatch?.candidates.length).toBeGreaterThan(
      0,
    );
    expect(
      h.conv.sessionData.pendingMatch!.candidates.every((p) =>
        /combo.*arroz chino/i.test(p.name),
      ),
    ).toBe(true);
    expect(reply).toMatch(/bebida/i);
    const selected = h.conv.sessionData.pendingMatch!.candidates[0];
    await h.sendQueued('1');
    if (h.conv.sessionData.pendingAttribute) await h.sendQueued('1');
    if (h.conv.sessionData.pendingAttribute) await h.sendQueued('1');
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    expect(h.conv.sessionData.cart).toHaveLength(1);
    expect(h.conv.sessionData.cart[0]).toEqual(
      expect.objectContaining({ productId: selected.id, quantity: 1 }),
    );
  });

describe('catalogue evidence and intent boundaries', () => {
  it.each([
    'Quiero un bowl con ensalada aparte',
    'Quiero una pasta con pan extra',
    'Quiero un pollo con harta papa',
    'Quiero un plato con poquito arroz',
    'Quiero un bowl con ensalada y dos panes',
    'Quiero un bowl con ensalada para calle 8',
    'Quiero un bowl con ensalada?',
    'Quiero un bowl con ensalada; soy Ana',
  ])('does not reinterpret %s', (text) =>
    expect(splitAccompanimentPurchase(text)).toBeNull(),
  );
  it.each([
    'Sin pan',
    'Pan opcional',
    'Incluye pan con recargo',
    'Incluye ensalada',
    'No incluye pan',
  ])('does not infer included pan from %s', (description) =>
    expect(
      includesAccompaniment(
        { id: 1, code: 1, name: 'Plato', price: 1, description },
        'pan',
      ),
    ).toBe(false),
  );
  it('does not turn generic drink into confirmed juice', () =>
    expect(
      includesAccompaniment(
        {
          id: 1,
          code: 1,
          name: 'Plato',
          price: 1,
          description: 'Incluye bebida',
        },
        'jugo',
      ),
    ).toBe(false));
});
for (const [dish, side, included] of menus)
  for (const enabled of [false, true])
    it(`explicit extra stays separate ${dish} agent=${enabled}`, async () => {
      const menu = [
        {
          id: 91001,
          code: 91001,
          name: dish,
          price: 15000,
          availableNow: true,
          attributes: [],
        },
        {
          id: 91002,
          code: 91002,
          name: `Combo De ${dish}`,
          description: `Incluye ${included}`,
          price: 22000,
          availableNow: true,
          attributes: [],
        },
        {
          id: 91003,
          code: 91003,
          name: side,
          price: 4000,
          availableNow: true,
          attributes: [],
        },
      ];
      const h = harness(menu, enabled);
      h.service.aiService.generateTurn = jest
        .fn()
        .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      await h.sendQueued(`Quiero un ${dish} y un ${side} aparte`);
      expect(
        h.conv.sessionData.pendingMatch?.includesRequestedAccompaniment,
      ).not.toBe(true);
      expect(h.conv.sessionData.cart.map((p) => p.productId)).toEqual(
        expect.arrayContaining([91001, 91003]),
      );
      expect(h.conv.sessionData.cart.some((p) => p.productId === 91002)).toBe(
        false,
      );
    });
for (const [dish, side, included] of menus)
  for (const enabled of [false, true])
    it(`multiple bundle choices ${dish} agent=${enabled}`, async () => {
      const menu = [
        {
          id: 91001,
          code: 91001,
          name: dish,
          price: 15000,
          availableNow: true,
          attributes: [],
        },
        {
          id: 91002,
          code: 91002,
          name: `Combo De ${dish}`,
          description: `Incluye ${included}`,
          price: 22000,
          availableNow: true,
          attributes: [],
        },
        {
          id: 91004,
          code: 91004,
          name: `Combo Especial De ${dish}`,
          description: `Incluye ${included}`,
          price: 24000,
          availableNow: true,
          attributes: [],
        },
        {
          id: 91003,
          code: 91003,
          name: side,
          price: 4000,
          availableNow: true,
          attributes: [],
        },
      ];
      const h = harness(menu, enabled);
      h.service.aiService.generateTurn = jest
        .fn()
        .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      await h.sendQueued(`Quiero dos ${dish} con ${side}`);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
      const chosen = h.conv.sessionData.pendingMatch!.candidates[1];
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toEqual(
        expect.objectContaining({ productId: chosen.id, quantity: 2 }),
      );
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    });

it('does not offer an explicitly excluded drink through generic beverage evidence',()=>{
 expect(includesAccompaniment({id:1,code:1,name:'Plato',price:1,description:'Incluye bebida. Sin gaseosa'},'gaseosa')).toBe(false);
});
