import { parseSubstitutionChoice } from './whatsapp-substitution-choice';
import { harness } from './whatsapp-accuracy.test-support';
const menus = [
  {
    dish: 'Ejecutivo Vegetal',
    side: 'Sopa del día',
    removed: 'ensalada',
    choices: ['papa', 'yuca'],
  },
  {
    dish: 'Bowl Andino',
    side: 'Crema del día',
    removed: 'arroz',
    choices: ['quinoa', 'cuscús'],
  },
  {
    dish: 'Pasta Primavera',
    side: 'Pan de ajo',
    removed: 'queso',
    choices: ['albahaca', 'perejil'],
  },
];
for (const m of menus)
  for (const agent of [false, true])
    for (const action of ['first', 'second', 'cancel'])
      it(`${m.dish}/${agent}/${action}`, async () => {
        const h = harness(
          [
            {
              id: 901,
              code: 901,
              name: m.side,
              price: 5000,
              availableNow: true,
              attributes: [],
            },
            {
              id: 902,
              code: 902,
              name: m.dish,
              price: 20000,
              availableNow: true,
              attributes: [],
            },
          ],
          agent,
        );
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.ordersService.findTodayOrdersByPhone = jest
          .fn()
          .mockResolvedValue([]);
        h.service.ordersService.create = jest
          .fn()
          .mockResolvedValue({ id: 999, dailyOrderNumber: 99 });
        Object.assign(h.conv.sessionData, {
          phoneConfirmed: true,
          contactPhone: h.conv.phoneE164,
          notesCollected: true,
        });
        await h.sendQueued(
          `Una ${m.side}\nY me regala un ${m.dish}\nEn ves de ${m.removed} más ${m.choices[0]} o ${m.choices[1]}\nPara villa Serena\nApto 150`,
        );
        expect(
          h.conv.sessionData.cart.map((x) => [x.productId, x.quantity]),
        ).toEqual([
          [901, 1],
          [902, 1],
        ]);
        expect(h.replies.join('\n')).toContain(m.choices[0]);
        expect(h.replies.join('\n')).toContain(m.choices[1]);
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
        await h.sendQueued('cuánto cuesta el pedido?');
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
        expect(h.conv.sessionData.cart).toHaveLength(2);
        await h.sendQueued(
          action === 'cancel'
            ? 'no apliques esa nota'
            : m.choices[action === 'first' ? 0 : 1],
        );
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
        expect(h.conv.sessionData.cart[0].note || '').toBe('');
        if (action === 'cancel')
          expect(h.conv.sessionData.cart[1].note || '').toBe('');
        else {
          expect(h.conv.sessionData.cart[1].note).toContain(m.removed);
          expect(h.conv.sessionData.cart[1].note).toContain(
            m.choices[action === 'first' ? 0 : 1],
          );
        }
        const expectedNote = h.conv.sessionData.cart[1].note || '';
        await h.sendQueued('contraentrega');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto = h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items.map((x) => x.productId)).toEqual([901, 902]);
        expect(dto.address).toMatch(/villa Serena/i);
        expect(dto.items[1].note || '').toBe(expectedNote);
      });
it.each([
  'en vez de arroz más quinoa o cuscús',
  'en ves de ensalada más papa o yuca con gaseosa colombiana',
])('recognizes %s', (s) => expect(parseSubstitutionChoice(s)).not.toBeNull());
it.each([
  'quiero papa o yuca',
  'en vez de arroz más quinoa y cuscús',
  'en vez de arroz más una sopa o dos panes',
  'en vez de arroz más quinoa o quinoa',
])('does not treat %s as a bounded choice', (s) =>
  expect(parseSubstitutionChoice(s)).toBeNull(),
);

for (const agent of [false, true])
  for (const cancel of [false, true])
    it(`original long message ${agent}/${cancel}`, async () => {
      const h = harness(undefined, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.ordersService.create = jest
        .fn()
        .mockResolvedValue({ id: 999, dailyOrderNumber: 99 });
      h.service.ordersService.findTodayOrdersByPhone = jest
        .fn()
        .mockResolvedValue([]);
      Object.assign(h.conv.sessionData, {
        phoneConfirmed: true,
        contactPhone: h.conv.phoneE164,
        notesCollected: true,
      });
      const real = JSON.parse(
        require('fs').readFileSync(
          'docs/whatsapp-open-cases-2510.json',
          'utf8',
        ),
      ).cases[0].messages[0];
      await h.sendQueued(real);
      expect(h.conv.sessionData.cart.map((x) => x.code).sort()).toEqual([
        18, 20,
      ]);
      expect(h.conv.sessionData.pendingSubsetKitchenNote?.substitution).toEqual(
        {
          removed: 'ensalada',
          choices: ['papa', 'yuca'],
        },
      );
      expect(h.replies.join('\n')).toMatch(/papa o yuca/);
      if (cancel) {
        await h.sendQueued('CANCELAR');
        expect(h.conv.sessionData.cart).toEqual([]);
        expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        return;
      }
      await h.sendQueued('yuca');
      expect(h.conv.sessionData.cart.find((x) => x.code === 18)?.note).toMatch(
        /ensalada por yuca/,
      );
      expect(
        h.conv.sessionData.cart.find((x) => x.code === 20)?.note || '',
      ).toBe('');
      await h.sendQueued('contraentrega');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(2);
      expect(
        dto.items.filter((x) => (x.note || '').includes('ensalada por yuca')),
      ).toHaveLength(1);
      expect(dto.address).toMatch(/villa galante/i);
      expect(dto.address).toMatch(/150/);
    });
