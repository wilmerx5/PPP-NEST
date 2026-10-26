import {harness} from './whatsapp-accuracy.test-support';
for(const [name,plural] of [['Platano Con Queso Y Bocadillo','plátanos con queso y bocadillo'],['Bowl Con Tofu Y Verduras','bowls con tofu y verduras'],['Sandwich Con Jamon Y Queso','sandwiches con jamón y queso']])
for(const agent of [false,true]) it(`catalog name is not a kitchen note: ${name}/${agent}`,async()=>{
 const h=harness([{id:99001,code:91,name,price:15000,availableNow:true,attributes:[]}],agent);
 await h.sendQueued(`Me das 2 ${plural} por favor`);
 expect(h.conv.sessionData.cart).toHaveLength(1);
 expect(h.conv.sessionData.cart[0].quantity).toBe(2);
 expect(h.conv.sessionData.cart[0].note||'').toBe('');
});

for (const agent of [false, true]) {
  it(`mixed purchase preserves product names without residual notes / ${agent}`, async () => {
    const h = harness(undefined, agent);
    await h.sendQueued('Me das un pollo frito y 2 plátanos con queso y bocadillo por favor');
    expect(h.conv.sessionData.cart.map(line => [line.code, line.quantity]).sort()).toEqual([[1, 1], [53, 2]].sort());
    expect(h.conv.sessionData.cart.find(line => line.code === 53)?.note || '').toBe('');
  });
}

const catalogues = [
  ['Platano Con Queso Y Bocadillo', 'plátanos con queso y bocadillo', 'Arroz Blanco'],
  ['Bowl Con Tofu Y Verduras', 'bowls con tofu y verduras', 'Sopa De Miso'],
  ['Sandwich Con Jamon Y Queso', 'sandwiches con jamón y queso', 'Crema De Tomate'],
];
for (const [name, plural, other] of catalogues) for (const agent of [false, true]) {
  for (const note of ['', 'sin cebolla']) {
    it(`mixed catalogue ingredients and real notes survive checkout: ${name}/${agent}/${note}`, async () => {
      const menu = [name, other].map((name, i) => ({id: 99001 + i, code: 91 + i, name, price: 15000, availableNow: true, attributes: []}));
      const h = harness(menu, agent);
      Object.assign(h.conv.sessionData, {orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create = jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      await h.sendQueued(`Me das un ${other} y 2 ${plural} ${note} por favor`);
      expect(h.conv.sessionData.cart.map(line => [line.productId,line.quantity]).sort()).toEqual([[99001,2],[99002,1]]);
      const item = h.conv.sessionData.cart.find(line => line.productId === 99001)!;
      expect(item.note || '').toBe(note);
      expect(h.conv.sessionData.cart.find(line => line.productId === 99002)?.note || '').toBe('');
      expect(h.replies.at(-1)).not.toMatch(/no manejamos|no pude|necesito aclarar/i);
      expect(h.replies.at(-1)).toMatch(/algo más/i);
      expect(h.conv.state).toBe('building_cart');
      await h.sendQueued('nada más'); await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto = h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(3);
      expect(dto.items.filter((line:any) => line.productId === 99001)).toHaveLength(2);
      expect(dto.items.filter((line:any) => line.productId === 99001).every((line:any) => (line.note || '') === note)).toBe(true);
    });
  }
}
