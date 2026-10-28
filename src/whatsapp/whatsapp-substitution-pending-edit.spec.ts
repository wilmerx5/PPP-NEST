import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  { dish: 'Ejecutivo Vegetal', side: 'Sopa del día', removed: 'ensalada', choices: ['papa', 'yuca'] },
  { dish: 'Bowl Andino', side: 'Crema del día', removed: 'arroz', choices: ['quinoa', 'cuscús'] },
  { dish: 'Pasta Primavera', side: 'Pan de ajo', removed: 'queso', choices: ['albahaca', 'perejil'] },
];
const paths = ['remove-owner', 'remove-other', 'quantity', 'follow-up', 'add-on', 'split', 'question'] as const;

function menuOf(item: (typeof menus)[number]) {
  return [
    { id: 901, code: 901, name: item.side, price: 5000, availableNow: true, attributes: [] },
    {
      id: 902,
      code: 902,
      name: item.dish,
      price: 20000,
      description: `Incluye ${item.removed} de la casa`,
      availableNow: true,
      attributes: [],
    },
    { id: 903, code: 903, name: item.choices[0], price: 3000, availableNow: true, attributes: [] },
    { id: 904, code: 904, name: item.choices[1], price: 3000, availableNow: true, attributes: [] },
  ];
}

function prepare(agent: boolean, item: (typeof menus)[number]) {
  const h = harness(menuOf(item) as never, agent);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 999, dailyOrderNumber: 99 });
  Object.assign(h.conv.sessionData, {
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
  });
  return h;
}

const purchase = (item: (typeof menus)[number]) =>
  `Una ${item.side}\nY me regala un ${item.dish}\nEn ves de ${item.removed} más ${item.choices[0]} o ${item.choices[1]}`;
const substitution = (item: (typeof menus)[number]) =>
  `En ves de ${item.removed} más ${item.choices[0]} o ${item.choices[1]}`;

for (const item of menus)
  for (const agent of [false, true])
    for (const path of paths)
      it(`${item.dish}/${agent}/${path}`, async () => {
        const h = prepare(agent, item);
        const ids = () => h.conv.sessionData.cart.map((line) => line.productId);
        if (path === 'split') {
          h.conv.sessionData.cart = [
            { productId: 901, code: 901, name: item.side, quantity: 1, unitPrice: 5000 },
            { productId: 902, code: 902, name: item.dish, quantity: 1, unitPrice: 20000, note: `sin ${item.removed}` },
            { productId: 902, code: 902, name: item.dish, quantity: 1, unitPrice: 20000, note: 'bien frito' },
          ];
          await h.sendQueued(substitution(item));
          expect(ids()).toEqual([901, 902, 902]);
          expect(h.conv.sessionData.cart.map((line) => line.note || '')).toEqual(['', `sin ${item.removed}`, 'bien frito']);
          expect(h.replies.join('\n')).toMatch(/cuál plato/i);
          await h.sendQueued(item.dish);
          expect(h.conv.sessionData.pendingSubsetKitchenNote?.productIds).toEqual([902]);
          await h.sendQueued(item.choices[0]);
          expect(h.conv.sessionData.cart.map((line) => line.note || '')).toEqual(['', `sin ${item.removed}`, 'bien frito']);
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
          await h.sendQueued(`el sin ${item.removed}`);
          expect(h.conv.sessionData.pendingSubsetKitchenNote?.substitution?.hostNote).toBe(`sin ${item.removed}`);
          await h.sendQueued(item.choices[1]);
          const notes = h.conv.sessionData.cart.map((line) => line.note || '');
          expect(notes[0]).toBe('');
          expect(notes[1]).toContain(item.choices[1]);
          expect(notes[1]).toContain(item.removed);
          expect(notes[2]).toBe('bien frito');
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          return;
        }
        if (path === 'follow-up' || path === 'add-on') {
          await h.sendQueued(path === 'add-on' ? `Una ${item.side}` : `Una ${item.side}\nY me regala un ${item.dish}`);
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
          await h.sendQueued(path === 'add-on' ? `Y me regala un ${item.dish}\n${substitution(item)}` : substitution(item));        } else {
          await h.sendQueued(purchase(item));
        }
        expect(ids().filter((id) => id === 903 || id === 904)).toEqual([]);
        expect(ids()).toEqual(expect.arrayContaining([901, 902]));
        expect(h.conv.sessionData.pendingSubsetKitchenNote?.substitution?.choices).toEqual(item.choices);
        if (path === 'follow-up') {
          expect(h.replies.join('\n')).toMatch(/cuál plato/i);
          await h.sendQueued(item.dish);
          expect(h.conv.sessionData.pendingSubsetKitchenNote?.productIds).toEqual([902]);
        }
        if (path === 'question') {
          await h.sendQueued(`¿qué trae el ${item.dish}?`);
          await h.sendQueued('¿cuánto cuesta el pedido?');
          expect(h.conv.sessionData.pendingSubsetKitchenNote?.substitution?.removed).toBe(item.removed);
          expect(ids()).toEqual([901, 902]);
        }
        if (path === 'remove-owner') {
          await h.sendQueued(`quita ${item.dish}`);
          expect(ids()).toEqual([901]);
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
          expect(h.replies.at(-1) || '').not.toMatch(/qué prefieres en vez/);
        } else if (path === 'remove-other') {
          await h.sendQueued(`quita ${item.side}`);
          expect(ids()).toEqual([902]);
          expect(h.conv.sessionData.pendingSubsetKitchenNote?.productIds).toEqual([902]);
        } else if (path === 'quantity') {
          await h.sendQueued(`que sean 2 ${item.dish}`);
          expect(h.conv.sessionData.cart.find((line) => line.productId === 902)?.quantity).toBe(2);
          expect(h.conv.sessionData.cart.find((line) => line.productId === 901)?.quantity).toBe(1);
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
        }
        if (path !== 'remove-owner') {
          await h.sendQueued(item.choices[1]);
          expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
          const noted = h.conv.sessionData.cart.filter((line) => (line.note || '').includes(item.choices[1]));
          expect(noted).toHaveLength(1);
          expect(noted[0].productId).toBe(902);
          expect(h.conv.sessionData.cart.find((line) => line.productId === 901)?.note || '').toBe('');
        }
        expect(ids().filter((id) => id === 903 || id === 904)).toEqual([]);
        await h.sendQueued('contraentrega');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        const expectedIds =
          path === 'remove-owner' ? [901] : path === 'remove-other' ? [902] : path === 'quantity' ? [901, 902, 902] : [901, 902];
        expect(dto.items.map((line: { productId: number }) => line.productId).sort()).toEqual(expectedIds);
        expect(dto.items.some((line: { productId: number }) => line.productId === 903 || line.productId === 904)).toBe(false);
        if (path !== 'remove-owner') {
          expect(dto.items.filter((line: { note?: string }) => (line.note || '').includes(item.choices[1]))).toHaveLength(
            path === 'quantity' ? 2 : 1,
          );
        }
      });
