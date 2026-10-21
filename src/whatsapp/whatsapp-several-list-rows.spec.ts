import { harness } from './whatsapp-accuracy.test-support';

type Family = { id: string; dish: string; rows: [string, string, string]; optioned: string; attr: string; options: [string, string] };

const families: Family[] = [
  { id: 'bowl-bar', dish: 'Bowl Vegetal', rows: ['Wrap Pollo', 'Wrap Res', 'Wrap Falafel'], optioned: 'Smoothie', attr: 'Fruta', options: ['Mango', 'Fresa'] },
  { id: 'pasta-place', dish: 'Pasta Del Huerto', rows: ['Lasagna Mixta', 'Ravioles Queso', 'Ñoquis Pesto'], optioned: 'Pizza Personal', attr: 'Sabor', options: ['Hawaiana', 'Pollo'] },
  { id: 'rice-house', dish: 'Arroz Chino', rows: ['Arroz Paisa', 'Arroz Marinero', 'Arroz Mixto'], optioned: 'Jugo Natural', attr: 'Sabor', options: ['Mora', 'Lulo'] },
];

const menuOf = (f: Family) => [
  ...[f.dish, `Combo De ${f.dish}`, `Combo De ${f.dish} Familiar`].map((name, i) => ({
    id: 98801 + i, code: 821 + i, name, price: 15000 + i * 7000, description: i ? 'Incluye bebida' : 'Sin bebida', availableNow: true, hasAttributes: false, attributes: [],
  })),
  ...f.rows.map((name, i) => ({ id: 500 + i, code: 50 + i, name, price: 20000 + i * 3000, availableNow: true, hasAttributes: false, attributes: [] })),
  { id: 503, code: 53, name: f.optioned, price: 9000, availableNow: true, hasAttributes: true, attributes: [{ attributeName: f.attr, options: f.options }] },
];

const rows = (h: ReturnType<typeof harness>) => h.conv.sessionData.cart.map((l: any) => [l.name, l.quantity]);

describe.each(families)('$id: several rows of the open list in one message', f => {
  describe.each([false, true])('agent %s', agent => {
    const rig = () => {
      const menu = menuOf(f);
      const h = harness(menu as never, agent);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 988, dailyOrderNumber: 102 });
      return { h, menu };
    };
    const replacementList = async () => {
      const r = rig();
      Object.assign(r.h.conv.sessionData, { fulfillmentChosen: true, phoneConfirmed: true, contactPhone: r.h.conv.phoneE164, notesCollected: true });
      await r.h.sendQueued(`Quiero dos ${f.dish} sin cebolla`);
      await r.h.sendQueued('Trae bebida?');
      expect(r.h.conv.sessionData.pendingMatch?.candidates.map((c: any) => c.id)).toEqual([98802, 98803]);
      return r;
    };
    const openList = (h: ReturnType<typeof harness>, menu: ReturnType<typeof menuOf>, ids: number[], quantity?: number) => {
      h.conv.sessionData.pendingMatch = {
        query: 'opciones', intent: 'order', quantity,
        candidates: ids.map(id => { const p = menu.find(x => x.id === id)!; return { id: p.id, code: p.code, name: p.name, price: p.price }; }),
      } as never;
    };

    it.each(['el primero o el segundo', '1 o 2', 'cualquiera de los dos'])('replacement list: «%s» keeps the cart and the list and asks', async question => {
      const { h } = await replacementList();
      const before = structuredClone(h.conv.sessionData.cart);
      const pending = structuredClone(h.conv.sessionData.pendingMatch);
      const reply = String(await h.sendQueued(question));
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch).toEqual(pending);
      expect(reply).toContain(`*Combo De ${f.dish}*`);
      expect(reply).toContain(`*Combo De ${f.dish} Familiar*`);
      expect(reply).toMatch(/cuál prefieres/i);
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 98803, quantity: 2, note: before[0].note })]);
    });

    it.each(['el 1 y el 2', 'uno de cada uno', 'el primero y el segundo'])('replacement list: «%s» splits the two units and reaches the order', async answer => {
      const { h } = await replacementList();
      const note = h.conv.sessionData.cart[0].note;
      await h.sendQueued(answer);
      expect(h.conv.sessionData.cart).toEqual([
        expect.objectContaining({ productId: 98802, quantity: 1, note }),
        expect.objectContaining({ productId: 98803, quantity: 1, note }),
      ]);
      expect(h.conv.sessionData.pendingMatch).toBeUndefined();
      if (h.conv.state === 'building_cart') await h.sendQueued('no más, recojo en el local');
      if (h.conv.state === 'awaiting_payment') await h.sendQueued('contraentrega');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create.mock.calls[0][0].items.map((item: any) => item.productId).sort()).toEqual([98802, 98803]);
    });

    it('replacement list: quantities that do not add up to the units ask how to split', async () => {
      const { h } = await replacementList();
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = String(await h.sendQueued('2 del primero y 1 del segundo'));
      expect(reply).toMatch(/Son 2 unidades/);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
    });

    it.each([['la 1 y la 3', [[0, 1], [2, 1]]], ['1, 2 y 3', [[0, 1], [1, 1], [2, 1]]], ['2 de la primera y 1 de la segunda', [[0, 2], [1, 1]]]] as const)(
      'plain list: «%s» adds each row with its quantity', async (answer, expected) => {
        const { h, menu } = rig();
        openList(h, menu, [500, 501, 502]);
        const reply = String(await h.sendQueued(answer));
        expect(rows(h)).toEqual(expected.map(([row, qty]) => [f.rows[row], qty]));
        for (const [row] of expected) expect(reply).toContain(f.rows[row]);
      });

    it('plain list: «1 o 3» asks and adds nothing', async () => {
      const { h, menu } = rig();
      openList(h, menu, [500, 501, 502]);
      const reply = String(await h.sendQueued('1 o 3'));
      expect(rows(h)).toEqual([]);
      expect(reply).toContain(`*${f.rows[0]}*`);
      expect(reply).toContain(`*${f.rows[2]}*`);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(3);
    });

    it('contrast: a single row number still picks only that row', async () => {
      const { h, menu } = rig();
      openList(h, menu, [500, 501, 502]);
      await h.sendQueued('2');
      expect(rows(h)).toEqual([[f.rows[1], 1]]);
    });

    it('contrast: a row whose product has options is not given a silent default', async () => {
      const { h, menu } = rig();
      openList(h, menu, [500, 501, 502, 503]);
      const reply = String(await h.sendQueued('el 1 y el 4'));
      expect(rows(h)).toEqual([]);
      expect(reply).toContain(`*${f.optioned}*`);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(4);
    });

    it('contrast: a list for three units with two rows and no counts asks how to split', async () => {
      const { h, menu } = rig();
      openList(h, menu, [500, 501, 502], 3);
      const reply = String(await h.sendQueued('la 1 y la 2'));
      expect(reply).toMatch(/Son 3 unidades/);
      expect(rows(h)).toEqual([]);
    });

    it('contrast: a row removed from the menu is not bought and nothing else is added', async () => {
      const { h, menu } = rig();
      openList(h, menu, [500, 501, 502]);
      menu.splice(menu.findIndex(p => p.id === 501), 1);
      const reply = String(await h.sendQueued('el 1 y el 2'));
      expect(rows(h)).toEqual([]);
      expect(reply).toMatch(/no está disponible/);
    });
  });
});
