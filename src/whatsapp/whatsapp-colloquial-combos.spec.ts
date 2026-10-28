import { harness } from './whatsapp-accuracy.test-support';

const phrases = [
  'quiero un FOOD frito en combo con gaseosa colombiana y arepas fritas',
  'me regalas un FOOD frito en combo con gaseosa colombiana y arepas fritas',
  'un FOOD frito en combo con gaseosa colombiana y arepas fritas',
  'quiero un FOOD frito en combito con gaseosa colombiana y arepas fritas',
  'dame un FOOD frito de combo con gaseosa colombiana y arepas fritas',
  'quiero un FOOD en combo frito con gaseosa colombiana y arepas fritas',
];
for (const food of ['Pollo', 'Pescado', 'Tofu'])
  for (const agent of [false, true]) {
    const meal = (id: number, style: string) => ({
      id,
      code: id,
      name: `Combo De ${food} ${style}`,
      price: 30000,
      availableNow: true,
      hasAttributes: true,
      attributes: [
        { attributeName: 'Bebida', options: ['Colombiana', 'Naranja'] },
        { attributeName: 'Arepas', options: ['Blancas', 'Fritas'] },
      ],
    });
    const menu = [
      meal(9701, 'Frito'),
      meal(9702, 'Broaster'),
      {
        id: 9703,
        code: 9703,
        name: 'Gaseosa 400ml',
        price: 4000,
        availableNow: true,
        hasAttributes: true,
        attributes: [
          { attributeName: 'Sabor', options: ['Colombiana', 'Naranja'] },
        ],
      },
    ];
    for (const phrase of phrases)
      it(`${food}/${agent}: ${phrase}`, async () => {
        const h = harness(menu, agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        await h.sendQueued(phrase.replace('FOOD', food.toLowerCase()));
        expect(h.conv.sessionData.cart).toHaveLength(1);
        expect(h.conv.sessionData.cart[0]).toMatchObject({
          productId: 9701,
          quantity: 1,
          attributes: expect.arrayContaining([
            { attributeName: 'Bebida', attributeValue: 'Colombiana' },
            { attributeName: 'Arepas', attributeValue: 'Fritas' },
          ]),
        });
        expect(h.replies.at(-1)).toContain(menu[0].name);
      });
    for (const prompt of [
      '¿Tienen FOOD frito en combito con gaseosa colombiana?',
      'cuánto vale un FOOD frito en combito con gaseosa colombiana',
    ])
      it(`${food}/${agent}: query ${prompt}`, async () => {
        const h = harness(menu, agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.ordersService.create = jest.fn();
        await h.sendQueued(prompt.replace('FOOD', food.toLowerCase()));
        expect(h.conv.sessionData.cart).toEqual([]);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.replies.at(-1)).not.toMatch(/Listo ✅/);
      });
    it(`${food}/${agent}: separate soda remains separate`, async () => {
      const h = harness(menu, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued('quiero una gaseosa 400ml colombiana');
      const soda = structuredClone(h.conv.sessionData.cart[0]);
      await h.sendQueued(
        `quiero un ${food.toLowerCase()} frito en combito con gaseosa colombiana y arepas fritas`,
      );
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(h.conv.sessionData.cart[0]).toEqual(soda);
      expect(h.conv.sessionData.cart[1]).toMatchObject({
        productId: 9701,
        quantity: 1,
      });
      expect(h.replies.at(-1)).toContain(menu[0].name);
    });

    it(`${food}/${agent}: explicitly additional soda is not swallowed`, async () => {
      const h = harness(menu, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.sendQueued(
        `quiero un combo de ${food.toLowerCase()} frito con bebida colombiana y arepas fritas y una gaseosa 400ml colombiana adicional`,
      );
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(
        h.conv.sessionData.cart.find((row) => row.productId === 9701),
      ).toMatchObject({ quantity: 1 });
      expect(
        h.conv.sessionData.cart.find((row) => row.productId === 9703),
      ).toMatchObject({ quantity: 1 });
      expect(h.replies.at(-1)).toContain('Gaseosa 400ml');
    });
  }
