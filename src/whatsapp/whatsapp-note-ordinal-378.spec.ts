import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Churrasco','Bowl Campesino'])for(const agent of [false,true])for(const final of [false,true])for(const ordinal of ['primero','primer','pimer']) {
 it(`pending note ordinal ${name}/${agent}/${final}/${ordinal}`,async()=>{
  const menu=[{id:98801,code:1,name,price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Preparación',options:['A','B']}]}];
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:378,dailyOrderNumber:378});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.conv.sessionData.cart=['A','B'].map(attributeValue=>({productId:98801,code:1,name,quantity:1,unitPrice:25000,attributes:[{attributeName:'Preparación',attributeValue}],note:'Salsa aparte'}));
  if(final){h.conv.state='awaiting_final_confirm';h.conv.sessionData.paymentMethod='contraentrega';}
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`El ${name} sin arroz`);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
  const answer=ordinal==='primero'?'al primero':`al ${ordinal} ${name}`;
  await h.sendQueued(answer);
  const cart=h.conv.sessionData.cart;
  expect(cart).toHaveLength(2);
  expect(cart[0]).toMatchObject({...before[0],note:expect.stringMatching(/sin arroz/i)});
  expect(cart[0].note).toMatch(/salsa aparte/i);expect(cart[1]).toEqual(before[1]);
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(2);expect(items.filter(i=>/sin arroz/i.test(i.note||''))).toHaveLength(1);
 });
}

for(const agent of [false,true])for(const scenario of ['unknown','question','mixed','stale','expired','cancel','conflict','repeat']) {
 it(`ordinal note guard ${agent}/${scenario}`,async()=>{
  const menu=[{id:98801,code:1,name:'Churrasco',price:25000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.conv.sessionData.cart=[{productId:98801,code:1,name:'Churrasco',quantity:1,unitPrice:25000,note:scenario==='conflict'?'con arroz':'Salsa aparte'},{productId:98801,code:1,name:'Churrasco',quantity:1,unitPrice:25000,note:'Sin sal'}];
  await h.sendQueued('El churrasco sin arroz');expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
  if(scenario==='stale')h.conv.sessionData.cart[0].quantity++;
  if(scenario==='expired')h.conv.sessionData.pendingSubsetKitchenNote!.preparationScope!.createdAt-=11*60*1000;
  if(scenario==='repeat')await h.sendQueued('al primero');
  const before=structuredClone(h.conv.sessionData.cart);
  const input=scenario==='unknown'?'al pimer arroz':scenario==='question'?'¿al pimer churrasco?':scenario==='mixed'?'al primero y agrega otro':scenario==='cancel'?'no apliques esa nota':'al primero';
  await h.sendQueued(input);expect(h.conv.sessionData.cart).toEqual(before);
  if(['stale','expired','cancel','repeat'].includes(scenario))expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
  else expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
 });
}
