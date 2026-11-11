import { harness } from './whatsapp-accuracy.test-support';

const distributions = [
  'dos de mango y uno de lulo',
  '1 lulo, 2 mango',
  'uno de mango y uno de lulo y uno de mango',
];
for (const name of ['Helado Artesanal', 'Paleta Frutal', 'Sorbete Natural']) {
  for (const agent of [false, true]) for (const phrase of distributions) {
    for (const interruption of ['price', 'wrongTotal']) {
      test(`${name}/${agent}/${phrase}/${interruption}: split flavors preserves total quantity`, async () => {
        const h = harness([
          { id: 94871, code: 81, name, price: 9000, availableNow: true, hasAttributes: true,
            attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] },
          { id: 94872, code: 82, name: 'Sopa Vegetal', price: 10000, availableNow: true, attributes: [] },
        ], agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
        h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 487, dailyOrderNumber: 487 });
        h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
        await h.sendQueued('quiero una Sopa Vegetal');
        await h.sendQueued(`quiero tres ${name}`);
        expect(h.conv.sessionData.pendingAttribute?.productId).toBe(94871);
        expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
        const cart = structuredClone(h.conv.sessionData.cart);
        const reply = await h.sendQueued(interruption === 'price'
          ? `cuánto cuesta ${name}` : 'dos de mango y dos de lulo');
        expect(reply).toMatch(interruption === 'price' ? /9[.,]000/ : /Sabor|cantidad|repart|total|tres|3/i);
        expect(h.conv.sessionData.cart).toEqual(cart);
        expect(h.conv.sessionData.pendingAttribute?.productId).toBe(94871);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        const added = await h.sendQueued(phrase);
        expect(added).toMatch(/Mango/i); expect(added).toMatch(/Lulo/i);
        expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
        const desserts = h.cartRows().filter(row => row.id === 94871);
        expect(desserts).toHaveLength(2);
        expect(desserts.find(row => row.attrs.includes('Sabor:Mango'))?.qty).toBe(2);
        expect(desserts.find(row => row.attrs.includes('Sabor:Lulo'))?.qty).toBe(1);
        expect(h.cartRows().find(row => row.id === 94872)?.qty).toBe(1);
        await h.sendQueued('no más, recojo en el local');
        await h.sendQueued('en efectivo');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        expect(h.replies.at(-1)).toMatch(/37[.,]000/);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const items = h.service.ordersService.create.mock.calls[0][0].items;
        expect(items).toHaveLength(4);
        for (const [flavor, count] of [['Mango', 2], ['Lulo', 1]] as const) {
          expect(items.filter((item: any) => item.productId === 94871 &&
            item.attributes.some((a: any) => a.attributeName === 'Sabor' && a.attributeValue === flavor)))
            .toHaveLength(count);
        }
      });
    }
  }
}

async function pendingPair(agent: boolean) {
  const h = harness([{ id: 94873, code: 83, name: 'Helado Artesanal', price: 9000,
    availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }] }], agent);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 487, dailyOrderNumber: 487 });
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  await h.sendQueued('quiero dos Helado Artesanal');
  expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);
  return h;
}
async function closePair(h: ReturnType<typeof harness>, same = false) {
  await h.sendQueued('no más, recojo en el local'); await h.sendQueued('en efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items = h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(2);
  expect(items.every((item: any) => item.productId === 94873)).toBe(true);
  expect(items.filter((item: any) => item.attributes.some((a: any) => a.attributeValue === 'Mango'))).toHaveLength(same ? 2 : 1);
  expect(items.filter((item: any) => item.attributes.some((a: any) => a.attributeValue === 'Lulo'))).toHaveLength(same ? 0 : 1);
}
for (const agent of [false, true]) {
  for (const invalid of ['dos de mango y uno de lulo', 'uno de mango y uno de mora',
    '¿uno de mango y uno de lulo?', 'uno de mango y uno de lulo si hay',
    '0 mango, 2 lulo', 'uno de mango y uno de lulo y agrega sopa']) {
    test(`pair/${agent}/${invalid}: reject the whole unverified distribution`, async () => {
      const h = await pendingPair(agent), before = structuredClone(h.conv.sessionData);
      const reply = await h.sendQueued(invalid);
      expect(reply).toMatch(/carrito sigue igual/);
      expect(h.conv.sessionData).toEqual(before);
      await h.sendQueued('uno de mango y uno de lulo');
      expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
      await closePair(h);
    });
  }
  for (const phrase of ['uno de mango y uno de lulo', '1 mango, 1 lulo',
    'uno de mango y uno de mango', '1 mango; 1 mango']) {
    test(`pair/${agent}/${phrase}: exact distribution closes without duplicates`, async () => {
      const h = await pendingPair(agent);
      const reply = await h.sendQueued(phrase);
      expect(reply).toMatch(/Repartí 2/);
      expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
      expect(h.cartRows().reduce((sum, row) => sum + row.qty, 0)).toBe(2);
      await closePair(h, !phrase.includes('lulo'));
    });
  }
}
