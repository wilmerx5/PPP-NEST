import { harness } from './whatsapp-accuracy.test-support';

for (const name of ['Helado Artesanal', 'Paleta Frutal', 'Sorbete Natural']) {
  for (const agent of [false, true]) for (const quantity of [2, 4]) {
    for (const prefix of ['mejor que sean', 'cambia la cantidad a', 'en vez de tres quiero', 'mejor solo']) {
      test(`${name}/${agent}/${quantity}/${prefix}: corrected quantity owns the flavor distribution`, async () => {
        const h = harness([
          { id: 94881, code: 81, name, price: 9000, availableNow: true, hasAttributes: true,
            attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] },
          { id: 94882, code: 82, name: 'Sopa Vegetal', price: 10000, availableNow: true, attributes: [] },
        ], agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
        h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 488, dailyOrderNumber: 488 });
        h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
        await h.sendQueued('quiero una Sopa Vegetal');
        await h.sendQueued(`quiero tres ${name}`);
        expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
        const cart = structuredClone(h.conv.sessionData.cart);
        const correction = await h.sendQueued(`${prefix} ${quantity === 2 ? 'dos' : 'cuatro'}`);
        expect(correction).toContain(`${quantity} unidades`);
        expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(quantity);
        expect(h.conv.sessionData.cart).toEqual(cart);
        const pending = structuredClone(h.conv.sessionData.pendingAttribute);
        const price = await h.sendQueued(`cuánto cuesta ${name}`);
        expect(price).toMatch(/9[.,]000/);
        expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
        const mismatch = await h.sendQueued('dos de mango y uno de lulo');
        expect(mismatch).toContain(`sumar ${quantity}`);
        expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
        expect(h.conv.sessionData.cart).toEqual(cart);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        const split = await h.sendQueued(`${quantity - 1} mango, 1 lulo`);
        expect(split).toContain(`Repartí ${quantity}`);
        expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
        const desserts = h.cartRows().filter(row => row.id === 94881);
        expect(desserts.find(row => row.attrs.includes('Sabor:Mango'))?.qty).toBe(quantity - 1);
        expect(desserts.find(row => row.attrs.includes('Sabor:Lulo'))?.qty).toBe(1);
        expect(h.cartRows().find(row => row.id === 94882)?.qty).toBe(1);
        await h.sendQueued('no más, recojo en el local'); await h.sendQueued('en efectivo');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        expect(h.replies.at(-1)).toContain((10000 + quantity * 9000).toLocaleString('es-CO'));
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const items = h.service.ordersService.create.mock.calls[0][0].items;
        expect(items).toHaveLength(quantity + 1);
        for (const [flavor, count] of [['Mango', quantity - 1], ['Lulo', 1]] as const) {
          expect(items.filter((item: any) => item.productId === 94881 &&
            item.attributes.some((a: any) => a.attributeName === 'Sabor' && a.attributeValue === flavor)))
            .toHaveLength(count);
        }
      });
    }
  }
}
