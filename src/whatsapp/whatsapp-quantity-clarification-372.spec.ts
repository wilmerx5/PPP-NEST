import { harness } from './whatsapp-accuracy.test-support';

function setup(other: boolean, agent: boolean) {
  const name = other ? 'Bandeja De Pescado Frito' : 'Ejecutivo Con Pollo Frito';
  const menu = [
    {id: 99601,code:961,name,price:20000,availableNow:true,hasAttributes:true,
      attributes:[{attributeName:'Sopa',options:['Ajiaco','Menudencias']},{attributeName:'Bebida',options:['Pepsi','Colombiana']}]},
    {id:99602,code:962,name:'Postre De La Casa',price:5000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  const h = harness(menu,agent);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  h.service.ordersService.create = jest.fn().mockResolvedValue({id:372,dailyOrderNumber:372});
  h.conv.sessionData.cart = [
    ...['Ajiaco','Menudencias'].map((soup,index)=>({productId:99601,code:961,name,unitPrice:20000,quantity:3,
      attributes:[{attributeName:'Sopa',attributeValue:soup},{attributeName:'Bebida',attributeValue:'Pepsi'}],
      note:index ? 'sin arroz':'sin ensalada'})),
    {productId:99602,code:962,name:'Postre De La Casa',unitPrice:5000,quantity:1,attributes:[]},
  ];
  return {h,name};
}
for (const other of [false,true]) for (const agent of [false,true])
  for (const checkout of [false,true])
  for (const choice of ['1','el primero','el de ajiaco','sin ensalada'])
  it(`quantity clarification ${other}/${agent}/${checkout}/${choice}`,async()=>{
    const {h,name}=setup(other,agent);
    if (checkout) {
      await h.sendQueued('no más');
      await h.sendQueued('contraentrega');
      expect(h.conv.state).toBe('awaiting_final_confirm');
    }
    const state=h.conv.state;
    const before=structuredClone(h.conv.sessionData.cart);
    const question=await h.sendQueued(`deja 2 ${name}`);
    expect(question).toMatch(/cuál línea/i);
    expect(question).toMatch(/Ajiaco/);
    expect(question).toMatch(/Menudencias/);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingCartQuantity).toBeTruthy();
    const answer=await h.sendQueued(choice);
    expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>i===0?{...line,quantity:2}:line));
    expect(h.conv.sessionData.pendingCartQuantity).toBeFalsy();
    expect(h.conv.state).toBe(state);
    if (checkout) expect(answer).toMatch(/confirmar/i);
    else {
      expect(answer).toMatch(/algo más/i);
      await h.sendQueued('no más');
      await h.sendQueued('contraentrega');
    }
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items=h.service.ordersService.create.mock.calls[0][0].items;
    expect(items).toHaveLength(6);
    expect(items.filter(i=>i.productId===99602)).toHaveLength(1);
    expect(items.filter(i=>i.note==='sin ensalada')).toHaveLength(2);
    expect(items.filter(i=>i.note==='sin arroz')).toHaveLength(3);
    expect(items.filter(i=>i.productId===99601).every(i=>i.attributes.some(a=>a.attributeValue==='Pepsi'))).toBe(true);
  });
for (const other of [false,true]) for (const agent of [false,true])
  for (const checkout of [false,true])
  for (const interruption of ['total','ambiguous','stale'])
  it(`quantity clarification interrupted ${other}/${agent}/${checkout}/${interruption}`,async()=>{
    const {h,name}=setup(other,agent);
    if (checkout) {await h.sendQueued('no más');await h.sendQueued('contraentrega');}
    const state=h.conv.state;
    await h.sendQueued(`deja 2 ${name}`);
    const before=structuredClone(h.conv.sessionData.cart);
    if (interruption==='stale') {
      h.conv.sessionData.cart[0].quantity=4;
      const changed=structuredClone(h.conv.sessionData.cart);
      const response=await h.sendQueued('1');
      expect(response).toMatch(/carrito cambió/i);
      expect(h.conv.sessionData.cart).toEqual(changed);
      expect(h.conv.sessionData.pendingCartQuantity).toBeFalsy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      return;
    }
    const response=await h.sendQueued(interruption==='total'?'cuánto es todo?':'el de Pepsi');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingCartQuantity).toBeTruthy();
    if (interruption==='ambiguous') expect(response).toMatch(/sola línea|número/i);
    else expect(response).toMatch(/125[.,]000/);
    await h.sendQueued('el de menudencias');
    expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>i===1?{...line,quantity:2}:line));
    expect(h.conv.state).toBe(state);
    if (!checkout) {await h.sendQueued('no más');await h.sendQueued('contraentrega');}
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items=h.service.ordersService.create.mock.calls[0][0].items;
    expect(items).toHaveLength(6);
    expect(items.filter(i=>i.note==='sin ensalada')).toHaveLength(3);
    expect(items.filter(i=>i.note==='sin arroz')).toHaveLength(2);
  });
for (const other of [false,true]) for (const agent of [false,true])
  for (const guard of ['inverse','question','duplicate'])
  it(`quantity note guard ${other}/${agent}/${guard}`,async()=>{
    const {h,name}=setup(other,agent);
    if (guard==='duplicate') h.conv.sessionData.cart[1].note='sin ensalada';
    await h.sendQueued(`deja 2 ${name}`);
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(guard==='inverse'?'con ensalada':guard==='question'?'¿el de sin ensalada?':'sin ensalada');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingCartQuantity).toBeTruthy();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>i===1?{...line,quantity:2}:line));
  });
