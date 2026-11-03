import { harness } from './whatsapp-accuracy.test-support';

function setup(other: boolean, agent: boolean) {
  const name = other ? 'Bandeja De Pescado Frito' : 'Ejecutivo Con Pollo Frito';
  const otherName=other?'Bandeja De Pescado Asado':'Ejecutivo Con Pollo Broaster';
  const menu = [
    {id: 99601,code:961,name,price:20000,availableNow:true,hasAttributes:true,
      attributes:[{attributeName:'Sopa',options:['Ajiaco','Menudencias']},{attributeName:'Bebida',options:['Pepsi','Colombiana']}]},
    {id:99603,code:963,name:otherName,price:21000,availableNow:true,hasAttributes:false,attributes:[]},
    {id:99602,code:962,name:'Postre De La Casa',price:5000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  const h = harness(menu,agent);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  h.service.ordersService.create = jest.fn().mockResolvedValue({id:373,dailyOrderNumber:373});
  h.conv.sessionData.cart = [
    ...['Ajiaco','Menudencias'].map((soup,index)=>({productId:99601,code:961,name,unitPrice:20000,quantity:index ? 3 : 4,
      attributes:[{attributeName:'Sopa',attributeValue:soup},{attributeName:'Bebida',attributeValue:'Pepsi'}],
      note:index ? 'sin arroz':'sin ensalada'})),
    {productId:99603,code:963,name:otherName,unitPrice:21000,quantity:2,attributes:[],note:'bien cocido'},
    {productId:99602,code:962,name:'Postre De La Casa',unitPrice:5000,quantity:1,attributes:[]},
  ];
  return {h,name};
}
for (const other of [false,true]) for (const agent of [false,true])
  for (const checkout of [false,true])
  for (const answer of ['dos con ajiaco y uno con menudencias','2 con ajiaco, 1 con menudencias','dos sin ensalada y uno sin arroz'])
  it(`compound quantity distribution ${other}/${agent}/${checkout}/${answer}`,async()=>{
    const {h}=setup(other,agent);
    if (checkout) {await h.sendQueued('no más');await h.sendQueued('contraentrega');}
    const state=h.conv.state;
    const before=structuredClone(h.conv.sessionData.cart);
    const question=await h.sendQueued(other?'solo eran 3 fritos y uno asado':'solo eran 3 fritos y uno rboaster');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(question).toMatch(/Ajiaco/);
    expect(question).toMatch(/Menudencias/);
    const response=await h.sendQueued(answer);
    expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>({...line,quantity:[2,1,1,1][i]})));
    expect(h.conv.sessionData.pendingCartQuantity).toBeFalsy();
    const corrected=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(answer);
    expect(h.conv.sessionData.cart).toEqual(corrected);
    expect(h.conv.state).toBe(state);
    if (checkout) expect(response).toMatch(/confirmar/i);
    else {await h.sendQueued('no más');await h.sendQueued('contraentrega');}
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items=h.service.ordersService.create.mock.calls[0][0].items;
    expect(items).toHaveLength(5);
    expect(items.filter(i=>i.note==='sin ensalada')).toHaveLength(2);
    expect(items.filter(i=>i.note==='sin arroz')).toHaveLength(1);
    expect(items.filter(i=>i.productId===99601).every(i=>i.attributes.some(a=>a.attributeValue==='Pepsi'))).toBe(true);
  });
for (const other of [false,true]) for (const agent of [false,true])
  for (const scenario of ['sum','duplicate','unknown','number','question','cancel-edit','cancel-order','stale','expiry','total'])
  it(`distribution guard ${other}/${agent}/${scenario}`,async()=>{
    const {h}=setup(other,agent);
    await h.sendQueued('no más');await h.sendQueued('contraentrega');
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(other?'solo eran 3 fritos y uno asado':'solo eran 3 fritos y uno rboaster');
    expect(h.conv.sessionData.pendingCartQuantity?.distribution).toBeTruthy();
    if (scenario==='stale') {
      h.conv.sessionData.cart[0].quantity=5;
      const changed=structuredClone(h.conv.sessionData.cart);
      const response=await h.sendQueued('dos con ajiaco y uno con menudencias');
      expect(response).toMatch(/cambió|venció/i);
      expect(h.conv.sessionData.cart).toEqual(changed);
      expect(h.conv.sessionData.pendingCartQuantity).toBeFalsy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
    }
    if (scenario==='expiry') h.conv.sessionData.pendingCartQuantity!.distribution!.createdAt=Date.now()-11*60*1000;
    const text={sum:'dos con ajiaco y dos con menudencias',duplicate:'dos con ajiaco y uno con ajiaco',unknown:'dos con ajiaco y uno con mondongo',number:'1',question:'¿dos con ajiaco y uno con menudencias?', 'cancel-edit':'cancela ese cambio','cancel-order':'cancelar pedido',expiry:'dos con ajiaco y uno con menudencias',total:'cuánto es todo?'}[scenario];
    const response=await h.sendQueued(text!);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if (scenario==='cancel-order') {expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingCartQuantity).toBeFalsy();return;}
    expect(h.conv.sessionData.cart).toEqual(before);
    if (['cancel-edit','expiry'].includes(scenario)) {expect(h.conv.sessionData.pendingCartQuantity).toBeFalsy();return;}
    expect(h.conv.sessionData.pendingCartQuantity?.distribution).toBeTruthy();
    if (scenario==='sum') expect(response).toMatch(/no suman/i);
    if (scenario==='total') expect(response).toMatch(/187[.,]000/);
    await h.sendQueued('dos con ajiaco y uno con menudencias');
    expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>({...line,quantity:[2,1,1,1][i]})));
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(5);
  });
for (const other of [false,true]) for (const agent of [false,true])
  it(`two ambiguous preparations ${other}/${agent}`,async()=>{
    const {h}=setup(other,agent);
    h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[2]),note:'poca sal'});
    await h.sendQueued('no más');await h.sendQueued('contraentrega');
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(other?'solo eran 3 fritos y tres asados':'solo eran 3 fritos y tres broaster');
    expect(h.conv.sessionData.pendingCartQuantity?.options).toHaveLength(4);
    expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued('dos sin ensalada y uno sin arroz y dos bien cocido y uno poca sal');
    expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>({...line,quantity:[2,1,2,1,1][i]})));
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(7);
  });
for (const other of [false,true]) for (const agent of [false,true])
  for (const stale of [false,true])
  it(`completed distribution replay ${other}/${agent}/${stale}`,async()=>{
    const {h}=setup(other,agent);
    await h.sendQueued(other?'solo eran 3 fritos y uno asado':'solo eran 3 fritos y uno rboaster');
    const answer='dos sin ensalada y uno sin arroz';
    await h.sendQueued(answer);
    expect(h.conv.sessionData.lastPreparationCountReply).toBeTruthy();
    if (stale) h.conv.sessionData.cart[3].quantity=2;
    else h.conv.sessionData.lastPreparationCountReply!.createdAt=Date.now()-11*60*1000;
    const before=structuredClone(h.conv.sessionData.cart);
    const response=await h.sendQueued(answer);
    expect(response).toMatch(/cambió|pasó el tiempo/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.lastPreparationCountReply).toBeFalsy();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
