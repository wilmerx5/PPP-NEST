import { harness } from './whatsapp-accuracy.test-support';

for (const [dish,plural] of [['Churrasco','churrascos'],['Bowl Vegetal','bowls vegetales']])
for (const agent of [false,true])
for (const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])
describe(`counted note clarification ${dish} ${state} agent=${agent}`,()=>{
  const setup=()=>{
    const menu=[{id:94150,code:150,name:dish,price:38000,availableNow:true,attributes:[]},
      {id:94151,code:151,name:'Sopa De Ajiaco',price:10500,availableNow:true,attributes:[]}];
    const h=harness(menu,agent);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:315,dailyOrderNumber:315});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    h.conv.state=state;
    h.conv.sessionData.cart=menu.map((p)=>({productId:p.id,code:p.code,name:p.name,quantity:3,unitPrice:p.price,attributes:[]}));
    Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,notesCollected:true,paymentMethod:state==='awaiting_final_confirm'?'cash':undefined});
    return h;
  };
  for(const choice of ['cambiar dos de los que ya tengo','agregar dos más']) it(choice,async()=>{
    const h=setup();const before=structuredClone(h.conv.sessionData.cart);
    const request=`Dos ${plural} los quiero sin arroz Mas ensalada`;
    const reply=await h.sendQueued(request);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply).toMatch(/agregar/i);expect(reply).toMatch(/cambiar/i);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued(request);expect(h.conv.sessionData.cart).toEqual(before);
    const result=await h.sendQueued(choice);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    const lines=h.conv.sessionData.cart.filter(p=>p.productId===94150);
    expect(lines.reduce((n,p)=>n+p.quantity,0)).toBe(choice.startsWith('cambiar')?3:5);
    expect(lines.filter(p=>p.note).map(p=>[p.quantity,p.note])).toEqual([[2,expect.stringMatching(/sin arroz.*mas ensalada/i)]]);
    expect(h.conv.sessionData.cart.filter(p=>p.productId===94151)).toEqual([before[1]]);
    expect(result).toMatch(/sin arroz/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const resolved = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(choice);
    expect(h.conv.sessionData.cart).toEqual(resolved);
    await h.sendQueued('no más');await h.sendQueued('efectivo');await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((p: {productId:number})=>p.productId===94150)).toHaveLength(choice.startsWith('cambiar')?3:5);
    expect(dto.items.filter((p: {note?:string})=>p.note?.includes('sin arroz'))).toHaveLength(2);
  });
  it('mismatched quantity, a bare yes and cancellation do not mutate the cart', async()=>{
    const h=setup();const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`Dos ${plural} los quiero sin arroz Mas ensalada`);
    for(const answer of ['sí','agregar tres más','cambiar tres de los que ya tengo']) {
      await h.sendQueued(answer);expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    }
    await h.sendQueued('no apliques esa nota');
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(before);
  });
  it('an explicit addition is still an addition',async()=>{
    const h=setup();await h.sendQueued(`Agrega dos ${plural} sin arroz`);
    expect(h.conv.sessionData.cart.filter(p=>p.productId===94150).reduce((n,p)=>n+p.quantity,0)).toBe(5);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
  });
  it('several existing preparations require a line instead of adding units',async()=>{
    const h=setup();h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],quantity:1,note:'sin sal'});
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued(`Dos ${plural} los quiero sin arroz Mas ensalada`);
    expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/cu[aá]l l[ií]nea/i);
  });

});
