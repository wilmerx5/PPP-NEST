import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  { base: 'Arroz', dish: 'Arroz Con Pollo', other: 'Arroz Chino', trays: ['Bandeja Con Pollo Frito', 'Bandeja Con Pollo Asado'], soup: 'Sopa De Ajiaco' },
  { base: 'Pasta', dish: 'Pasta Con Camarones', other: 'Pasta Napolitana', trays: ['Bandeja Con Camarones Fritos', 'Bandeja Con Camarones Apanados'], soup: 'Crema De Tomate' },
  { base: 'Quinua', dish: 'Quinua Con Vegetales', other: 'Quinua Salteada', trays: ['Bandeja Con Vegetales Asados', 'Bandeja Con Vegetales Salteados'], soup: 'Sopa De Lentejas' },
];

function menuOf(item: (typeof menus)[number]) {
  const row = (id: number, name: string, price: number, description?: string) =>
    ({ id, code: id, name, price, description, availableNow: true, hasAttributes: false, attributes: [] });
  return [
    row(801, item.dish, 24000, 'Acompañado con papa criolla y ensalada'),
    row(802, `Porción De ${item.base}`, 6000),
    row(803, item.other, 30000),
    row(804, item.trays[0], 19000),
    row(805, item.trays[1], 20000),
    row(806, item.soup, 15000),
    row(807, 'Combo Familiar', 60000),
    row(808, `Combo De ${item.other}`, 38000),
    row(809, `Combo ${item.base} Especial`, 41000),
  ];
}

const rows = (h: ReturnType<typeof harness>) =>
  h.conv.sessionData.cart.map((line) => [line.productId, line.quantity, line.note || '']);

for (const item of menus)
  for (const agent of [false, true])
    describe(`${item.dish} agent=${agent}`, () => {
      const start = () => harness(menuOf(item) as never, agent);
      const checkout = () => {
        const h = start();
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
        h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 999, dailyOrderNumber: 99 });
        Object.assign(h.conv.sessionData, {
          phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true,
        });
        return h;
      };
      const seed = (h: ReturnType<typeof harness>, quantities: [number, number]) => {
        h.conv.sessionData.cart = [
          { productId: 801, code: 801, name: item.dish, quantity: quantities[0], unitPrice: 24000, attributes: [] },
          { productId: 806, code: 806, name: item.soup, quantity: quantities[1], unitPrice: 15000, attributes: [] },
        ] as never;
      };

      it('a closing courtesy is not part of the dish name', async () => {
        for (const courtesy of ['si es tan amable', 'si me hace el favor']) {
          const h = start();
          await h.sendQueued(`Un ${item.dish.toLowerCase()} ${courtesy}`);
          expect(rows(h)).toEqual([[801, 1, '']]);
          expect(h.replies.join('\n')).not.toMatch(/no manejamos|cu[aá]l prefieres|Escribe 1/i);
        }
      });

      it('an additional portion names the catalog portion', async () => {
        const h = start();
        await h.sendQueued(`Me regalas una ${item.soup.toLowerCase()} y una porción adicional de ${item.base.toLowerCase()}`);
        expect(rows(h).sort()).toEqual([[802, 1, ''], [806, 1, '']]);
        expect(h.replies.join('\n')).not.toMatch(/cu[aá]l te gusta|cu[aá]l prefieres/i);
      });

      it('a tray wraps a fully named dish when the catalog has no "bandeja de" product', async () => {
        const h = start();
        await h.sendQueued(`Una bandeja de ${item.dish.toLowerCase()}, sin ensalada y harto ají`);
        expect(rows(h)).toEqual([[801, 1, expect.stringMatching(/sin ensalada.*aj[ií]/i)]]);
        expect(h.replies.join('\n')).not.toMatch(new RegExp(item.trays[0]));
      });

      it('a spoken side swap after a dish keeps the dish, quantity and both sides', async () => {
        const h = start();
        await h.sendQueued(`Mira necesito por favor dos ${item.dish.toLowerCase()} en lugar de ensalada yuca`);
        expect(rows(h)).toEqual([[801, 2, expect.stringMatching(/sin ensalada.*con yuca/i)]]);
        const described = start();
        await described.sendQueued(`dos ${item.dish.toLowerCase()} en lugar de papa criolla`);
        expect(rows(described)).toEqual([[801, 2, expect.stringMatching(/sin papa criolla/i)]]);
        expect(rows(described)[0][2]).not.toMatch(/con criolla/i);
      });

      it('refusing ordered units removes or reduces that line only, even with typos', async () => {
        const all = start();
        seed(all, [4, 2]);
        await all.sendQueued(`no quieor las 4 ${item.dish.toLowerCase().replace(/^(\p{L})/u, '$1`')}`);
        expect(rows(all)).toEqual([[806, 2, '']]);
        expect(all.replies.join('\n')).toMatch(/Quit[eé]/);
        const some = start();
        seed(some, [4, 2]);
        await some.sendQueued(`no quiero los 2 ${item.dish.toLowerCase()}`);
        expect(rows(some)).toEqual([[801, 2, ''], [806, 2, '']]);
        const correction = start();
        seed(correction, [4, 2]);
        await correction.sendQueued(`no, quiero 3 ${item.dish.toLowerCase()}`);
        expect(rows(correction)).toEqual([[801, 3, ''], [806, 2, '']]);
        expect(correction.conv.sessionData.cart).toHaveLength(2);
      });

      it('keeps an explicit extra through payment and the simulated order', async () => {
        const h = checkout();
        await h.sendQueued(`Me regalas una ${item.soup} y una porción adicional de ${item.base}`);
        expect(rows(h).sort()).toEqual([[802, 1, ''], [806, 1, '']]);
        expect(h.replies.join('\n')).toContain(item.soup);
        expect(h.replies.join('\n')).toContain(`Porción De ${item.base}`);
        await h.sendQueued('contraentrega');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.replies.at(-1)).toMatch(/confirmar/i);
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items.map((line: {productId: number}) => line.productId).sort()).toEqual([802, 806]);
      });

      it('preserves the side swap and exact two units through simulated checkout', async () => {
        const h = checkout();
        await h.sendQueued(`Mira necesito por favor dos ${item.dish} en lugar de ensalada yuca`);
        expect(rows(h)).toEqual([[801, 2, expect.stringMatching(/sin ensalada.*con yuca/i)]]);
        expect(h.replies.join('\n')).toMatch(/ensalada.*yuca/i);
        await h.sendQueued('contraentrega');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.replies.at(-1)).toMatch(/confirmar/i);
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items.map((line: {productId: number}) => line.productId)).toEqual([801, 801]);
        expect(dto.items.every((line: {note?: string}) => /sin ensalada.*con yuca/i.test(line.note || ''))).toBe(true);
      });
    });
