import { harness, products } from './whatsapp-accuracy.test-support';
for (const enabled of [false, true])
  for (const quantity of [1, 2])
    for (const question of ['de que sabor tienes?', 'qué sabores hay?'])
      for (const [name, flavors] of [
        ['Gaseosa', ['Cola', 'Naranja']],
        ['Helado', ['Vainilla', 'Chocolate']],
        ['Yogur', ['Fresa', 'Natural']],
      ] as const) {
        it(`purchase plus flavor question ${name} qty=${quantity} ${question} agent=${enabled}`, async () => {
          const menu = [
            {
              id: 92001,
              code: 92001,
              name: 'Plato Vegetal',
              price: 15000,
              availableNow: true,
              attributes: [],
            },
            {
              id: 92002,
              code: 92002,
              name,
              price: 4000,
              availableNow: true,
              hasAttributes: true,
              attributes: [{ attributeName: 'Sabor', options: [...flavors] }],
            },
          ];
          const h = harness(menu, enabled);
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
            .mockResolvedValue({ id: 920, dailyOrderNumber: 92 });
          await h.sendQueued('Quiero un Plato Vegetal');
          const before = structuredClone(h.conv.sessionData.cart);
          expect(before).toHaveLength(1);
          const reply = await h.sendQueued(`${quantity} ${name}, ${question}`);
          expect(reply).toContain(flavors[0]);
          expect(reply).toContain(flavors[1]);
          expect(reply).not.toContain('Dime la opción');
          expect(h.conv.sessionData.cart).toEqual(before);
          await h.sendQueued(flavors[1]);
          expect(h.conv.sessionData.cart).toHaveLength(2);
          expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
          expect(h.conv.sessionData.cart[1]).toEqual(
            expect.objectContaining({
              productId: 92002,
              quantity,
              attributes: expect.arrayContaining([
                expect.objectContaining({ attributeValue: flavors[1] }),
              ]),
            }),
          );
          await h.sendQueued('no más, recojo en el local');
          if (h.conv.state === 'awaiting_payment') await h.sendQueued('1');
          await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const dto = h.service.ordersService.create.mock.calls[0][0];
          expect(dto.items).toHaveLength(quantity + 1);
          expect(
            dto.items.filter((item) => item.productId === 92002),
          ).toHaveLength(quantity);
        });
      }
for (const enabled of [false, true])
  it(`exact customer soda question agent=${enabled}`, async () => {
    const h = harness(products, enabled);
    h.service.aiService.generateTurn = jest
      .fn()
      .mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
    h.conv.sessionData.cart = [
      {
        productId: 1,
        code: 1,
        name: '1 Pollo Frito',
        quantity: 1,
        unitPrice: 41000,
        attributes: [{ attributeName: 'Arepas', attributeValue: 'Blancas' }],
      },
    ];
    const before = structuredClone(h.conv.sessionData.cart);
    expect(before).toHaveLength(1);
    const reply = await h.sendQueued('una gaseosa, de que sabor tienes?');
    expect(reply).toMatch(/colombiana|manzana|pepsi/i);
    expect(reply).not.toContain('Dime la opción');
    expect(h.conv.sessionData.cart).toEqual(before);
    const position=h.conv.sessionData.pendingMatch!.candidates.findIndex(product=>product.id===28);
    expect(position).toBeGreaterThanOrEqual(0);
    await h.sendQueued(String(position+1));
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(28);
    await h.sendQueued('Manzana');
    expect(h.conv.sessionData.cart).toHaveLength(2);
    expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    expect(h.conv.sessionData.cart[1]).toEqual(expect.objectContaining({productId:28,quantity:1,attributes:expect.arrayContaining([expect.objectContaining({attributeValue:'Manzana'})])}));
  });
