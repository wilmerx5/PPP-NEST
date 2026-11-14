import {harness} from './whatsapp-accuracy.test-support';
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true]){
 it('partial kitchen instruction '+other+agent+checkout,async()=>{
  const name=other?'Bowl Vegetal':'Churrasco';
  const menu=[{id:97301,code:1,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]},{id:97302,code:2,name:'Sopa Del Dia',price:8000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:346,dailyOrderNumber:346});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.conv.sessionData.cart=menu.map((p,i)=>({productId:p.id,code:p.code,name:p.name,quantity:i?1:3,unitPrice:p.price,attributes:[],...(i?{note:'Sin cilantro'}:{})}));
  h.conv.state=checkout?'awaiting_final_confirm':'building_cart';if(checkout)h.conv.sessionData.paymentMethod='contraentrega';
  const reply=await h.sendQueued(other?'De los tres bowl vegetal, dos sin arroz más ensalada':'De los tres churrascos, dos sin arroz más ensalada');
  const dish=h.conv.sessionData.cart.filter(l=>l.productId===97301);
  expect(dish.reduce((n,l)=>n+l.quantity,0)).toBe(3);
  expect(dish.filter(l=>/sin arroz/i.test(l.note||'')).reduce((n,l)=>n+l.quantity,0)).toBe(2);
  expect(dish.filter(l=>/ensalada/i.test(l.note||'')).reduce((n,l)=>n+l.quantity,0)).toBe(2);
  expect(h.conv.sessionData.cart.find(l=>l.productId===97302)?.note).toBe('Sin cilantro');
  expect(reply).toMatch(/sin arroz/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(!checkout){await h.sendQueued('no mas');await h.sendQueued('contraentrega');}
  const receipt=await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);expect(items.filter(i=>i.productId===97301&&/sin arroz/i.test(i.note||''))).toHaveLength(2);
  expect(receipt).toContain('68.000');
 });
 it('preparation preserves all options '+other+agent+checkout,async()=>{
  const family=other?'Bandeja Con Tofu':'Ejecutivo Con Pollo',key=other?'Corte':'Presa',choice=other?'Filete':'Pechuga',otherChoice=other?'Cubos':'Pierna Pernil';
  const attributes=[{attributeName:key,options:[choice,otherChoice]},{attributeName:'Sopa',options:['Ajiaco','Menudencias']},{attributeName:'Bebida',options:['Limonada','Cola']}];
  const menu=['Frito','Broaster'].map((style,i)=>({id:97401+i,code:i+1,name:family+' '+style,price:24000+i*1000,availableNow:true,hasAttributes:true,attributes}));
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:346,dailyOrderNumber:346});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.conv.sessionData.cart=[choice,otherChoice].map((value,i)=>({productId:97401,code:1,name:menu[0].name,quantity:1,unitPrice:24000,attributes:[{attributeName:key,attributeValue:value},{attributeName:'Sopa',attributeValue:'Ajiaco'},{attributeName:'Bebida',attributeValue:'Limonada'}],note:i?'Salsa aparte':'Sin ensalada; limonada bajita de azúcar'}));
  h.conv.state=checkout?'awaiting_final_confirm':'building_cart';if(checkout)h.conv.sessionData.paymentMethod='contraentrega';
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('Cámbiame el de '+choice+' a '+(other?'tofu':'pollo')+' broaster');
  expect(h.conv.sessionData.cart).toHaveLength(2);
  const changed=h.conv.sessionData.cart.find(l=>l.productId===97402);
  expect(changed).toMatchObject({quantity:1,attributes:before[0].attributes,note:before[0].note});
  expect(h.conv.sessionData.cart.find(l=>l.productId===97401)).toEqual(before[1]);
  expect(reply).toMatch(/broaster/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(!checkout){await h.sendQueued('no mas');await h.sendQueued('contraentrega');}
  const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(2);expect(items.find(i=>i.productId===97402)).toMatchObject({attributes:before[0].attributes,note:before[0].note});
  expect(receipt).toContain('49.000');expect(receipt).toMatch(/bajita de azúcar/i);
 });
}

for(const agent of [false,true]){
 const setup=()=>{
  const menu=[{id:97301,code:1,name:'Churrasco',price:20000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'Aclaremos el pedido',actions:{}});
  h.conv.sessionData.cart=[{productId:97301,code:1,name:'Churrasco',quantity:3,unitPrice:20000,attributes:[]}];
  h.conv.state='awaiting_final_confirm';h.conv.sessionData.paymentMethod='contraentrega';
  return h;
 };
 it('numeric subset and repeat preserve quantity '+agent,async()=>{
  const h=setup();await h.sendQueued('De los 3 churrascos, 2 sin arroz');
  expect(h.conv.sessionData.cart.map(l=>[l.quantity,l.note||''])).toEqual([[1,''],[2,'sin arroz']]);
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('De los 3 churrascos, 2 sin arroz');
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/ya.*aplicada/i);
  expect(h.conv.state).toBe('awaiting_final_confirm');
 });
 it('preserves preexisting notes on both subsets '+agent,async()=>{
  const h=setup();h.conv.sessionData.cart[0].note='Salsa aparte';
  await h.sendQueued('De los tres churrascos, dos sin arroz');
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart.every(l=>/salsa aparte/i.test(l.note||''))).toBe(true);
  expect(h.conv.sessionData.cart.find(l=>l.quantity===2)?.note).toMatch(/sin arroz/i);
 });
 for(const phrase of [
  'De los 3 churrascos, 4 sin arroz','De los 3 churrascos, 0 sin arroz',
  'De los 3 churrascos, -1 sin arroz','De los 3 churrascos, 1.5 sin arroz',
  'De los 4 churrascos, 2 sin arroz','De los 3 bowls, 2 sin arroz',
  '¿De los tres churrascos, dos sin arroz?',
  'De los tres churrascos, dos sin arroz si no cuesta más',
  'De los tres churrascos, dos sin arroz y agrega una sopa',
 ])it('unsafe subset leaves cart intact '+agent+' '+phrase,async()=>{
  const h=setup(),before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(phrase);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.state).toBe('awaiting_final_confirm');expect(reply).toMatch(/igual/i);
 });
 it('ambiguous versions remain untouched '+agent,async()=>{
  const h=setup();h.conv.sessionData.cart[0].quantity=1;
  h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],quantity:2,note:'Sin sal'});
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('De los tres churrascos, dos sin arroz');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply).toMatch(/repartimos/i);
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toMatchObject({quantity:2,byUnits:true});
  expect(h.conv.sessionData.pendingSubsetKitchenNote?.countedScope?.cartSignature).toBe(JSON.stringify(before));
 });
}
