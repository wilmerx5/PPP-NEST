import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  ['Combo Arroz Con Cerdo', 'Combo Arroz Con Pollo', 'Bebida', 'Limonada', 'Uva'],
  ['Combo Hamburguesa Con Queso', 'Combo Hamburguesa Con Tocineta', 'Bebida', 'Pepsi', 'Ginger'],
  ['Pizza Con Jamon', 'Pizza Con Champinones', 'Borde', 'Normal', 'Queso'],
];
describe.each(menus)('%s compound replacement', (oldName, newName, attributeName, defaultOption, chosen) => {
  describe.each([false, true])('agent %s', agent => {
    const start = async () => {
      const products = [oldName, newName].map((name, i) => ({id: 610+i, code: 610+i, name, price: 20000+i*1000,
        categoryName: 'Platos', availableNow: true, hasAttributes: true,
        attributes: [{attributeName, options: [defaultOption, chosen]}]}));
      const h = harness(products as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      await h.send(`dame un ${oldName} con ${chosen}`);
      expect(h.cartRows().map(r => r.id)).toEqual([610]);
      return h;
    };
    it.each(['building_cart', 'awaiting_payment'])('replaces in %s without losing the option', async state => {
      const h = await start();
      h.conv.state = state as never;
      const reply = await h.send(`quita el ${oldName} y dame el ${newName}`);
      expect(h.cartRows().map(r => r.id)).toEqual([611]);
      expect(h.cartRows()[0].attrs).toContain(`${attributeName}:${chosen}`);
      expect(reply).not.toMatch(/no manejamos|no encontr|no pude/i);
      expect(h.conv.state).toBe(state);
    });
    it('an explicit new option overrides the inherited option', async () => {
      const h = await start();
      await h.send(`quita el ${oldName} y dame el ${newName} con ${defaultOption}`);
      expect(h.cartRows().map(r => r.id)).toEqual([611]);
      expect(h.cartRows()[0].attrs).toContain(`${attributeName}:${defaultOption}`);
    });
    it('an explicit additional purchase keeps both products', async () => {
      const h = await start();
      await h.send(`agrega un ${newName} con ${chosen}`);
      expect(h.cartRows().map(r => r.id).sort()).toEqual([610, 611]);
    });
    it('the simulated order contains only the replacement and its option', async () => {
      const h = await start();
      h.service.ordersService.create = jest.fn().mockResolvedValue({id: 9971, dailyOrderNumber: 107});
      await h.send(`quita el ${oldName} y dame el ${newName}`);
      await h.sendQueued('Para domicilio\nCarlos Torres\n3000000006\nCalle 10 #81A-20\nTorre 4 apto 505');
      await h.sendQueued('contraentrega');
      expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(1);
      expect(dto.items[0]).toMatchObject({productId:611});
      expect(JSON.stringify(dto.items[0])).toContain(chosen);
    });
    it('an unavailable replacement does not remove the original', async () => {
      const h = await start();
      const before = JSON.stringify(h.cartRows());
      await h.send(`quita el ${oldName} y dame el plato inexistente`);
      expect(JSON.stringify(h.cartRows())).toBe(before);
    });
  });
});

describe.each([false, true])('real shorthand stays safe, agent %s', agent => {
  it('does not treat removal words as products or add a second combo when the target is incomplete', async () => {
    const products = [
      {id: 850, code:850, name:'Combo Arroz Chino Con Costillas De Cerdo'},
      {id: 970, code:970, name:'Combo Arroz Chino Con Medio Pollo'},
    ].map(p => ({...p, price:50000, availableNow:true, hasAttributes:true,
      attributes:[{attributeName:'Bebida',options:['Colombiana','7up']}]}));
    const h = harness(products as never,agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    await h.send('dame un combo arroz chino con costillas de cerdo con 7up');
    const before=JSON.stringify(h.cartRows());
    expect(h.cartRows().map(r=>r.id)).toEqual([850]);
    const reply=await h.send('quita el de costilla y dame el combo con medio broaster y up');
    expect(JSON.stringify(h.cartRows())).toBe(before);
    expect(reply).not.toMatch(/no manejamos|Listo.*Combo/i);
    expect(reply).toMatch(/no encontr|nombre|opcion/i);
  });
});
