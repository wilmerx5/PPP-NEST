import {harness} from './whatsapp-accuracy.test-support';
function menu(other:boolean) {
 return [
 {id:38401,code:1,name:other?'Risotto':'Arroz con pollo',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:38402,code:2,name:other?'Limonada natural':'Gaseosa 400ml',categoryName:'Bebidas',price:5000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:38403,code:3,name:other?'Combo De Pizza Frita':'Combo De Pollo Frito',price:30000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Pepsi','Colombiana','Ginger']}]},
 {id:38404,code:4,name:other?'Combo De Pizza Asada':'Combo De Pollo Broaster',price:32000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Pepsi','Colombiana','Ginger']}]},
 {id:38405,code:5,name:other?'Sopa De Tomate':'Sopa De Mondongo',price:10000,availableNow:true,hasAttributes:false,attributes:[]},
 ];
}
for(const other of [false,true])for(const agent of [false,true]) {
 it(`beverage note targets only drink ${other}/${agent}`,async()=>{
  const m=menu(other),h=harness(m,agent);
  await h.sendQueued(`Un ${m[0].name}`);await h.sendQueued(`Una ${m[1].name}`);
  const reply=await h.sendQueued('la bebida bien fría');
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart.find(p=>p.productId===38402)?.note).toMatch(/fr[ií]a/i);
  expect(h.conv.sessionData.cart.find(p=>p.productId===38401)?.note||'').not.toMatch(/fr[ií]a/i);
  expect(reply).not.toMatch(/no pude|no entend/i);
 });
 it(`withdrawn offer must not add unavailable soup ${other}/${agent}`,async()=>{
  const m=menu(other),h=harness(m,agent);h.cfg.ignoreBusinessHours=false;
  await h.sendQueued(`Cuánto cuesta una ${m[4].name}`);
  expect(h.conv.sessionData.pendingAddOffer).toBeTruthy();
  m[4].availableNow=false;
  const reply=await h.sendQueued('sí');
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(reply).toMatch(/no.*disponible|agotad/i);
 });
 it(`courtesy alone never changes an existing order ${other}/${agent}`,async()=>{
  const m=menu(other),h=harness(m,agent);await h.sendQueued(`Un ${m[0].name}`);
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('por Fis');expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.customerName).not.toMatch(/fis/i);
 });
 it(`selection preserves requested included Pepsi ${other}/${agent}`,async()=>{
  const m=menu(other),h=harness(m,agent);
  await h.sendQueued(other?'Un combo de pizza con pepsi':'Un combo de pollo con pepsi');
  await h.sendQueued(other?'Asada':'Broaster');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:38404,quantity:1,attributes:expect.arrayContaining([expect.objectContaining({attributeValue:'Pepsi'})])})]);
 });
}

for(const other of [false,true])for(const agent of [false,true]) {
 for(const included of [false,true])for(const state of ['building_cart','awaiting_final_confirm']) {
  it(`temperature note survives checkout ${other}/${agent}/${included}/${state}`,async()=>{
   const m=menu(other),h=harness(m,agent);h.service.ordersService.create=jest.fn().mockResolvedValue({id:384,dailyOrderNumber:384});
   await h.sendQueued(`Un ${m[0].name}`);
   await h.sendQueued(included?`Un ${m[3].name} con Pepsi`:`Una ${m[1].name}`);
   const target=included?38404:38402; 
   h.conv.state=state;h.conv.sessionData.paymentMethod='cash';
   const before=structuredClone(h.conv.sessionData.cart);
   await h.sendQueued('la bebida bien fría');await h.sendQueued('la bebida bien fría');
   expect(h.conv.state).toBe(state);
   expect(h.conv.sessionData.cart.map(p=>({...p,note:undefined}))).toEqual(before.map(p=>({...p,note:undefined})));
   expect(h.conv.sessionData.cart.find(p=>p.productId===target)?.note?.match(/fr[ií]a/gi)).toHaveLength(1);
   expect(h.conv.sessionData.cart.find(p=>p.productId===38401)?.note).toBeFalsy();
   await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const items=h.service.ordersService.create.mock.calls[0][0].items;
   expect(items).toHaveLength(2);
   expect(items.find(p=>p.productId===target)?.note).toMatch(/bebida.*fr[ií]a/i);
   if(included)expect(items.find(p=>p.productId===target)?.attributes).toEqual(expect.arrayContaining([expect.objectContaining({attributeValue:'Pepsi'})]));
  });
 }
 it(`ambiguous beverage note resolves without duplicating ${other}/${agent}`,async()=>{
  const m=menu(other),h=harness(m,agent);
  await h.sendQueued(`Un ${m[3].name} con Pepsi`);await h.sendQueued(`Una ${m[1].name}`);
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('la bebida bien fría');
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/cu[aá]l|indica|elige/i);
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
  await h.sendQueued(m[1].name);
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart.find(p=>p.productId===38402)?.note).toMatch(/fr[ií]a/i);
  expect(h.conv.sessionData.cart.find(p=>p.productId===38404)?.note).toBeFalsy();
 });
 for(const choice of ['2',other?'Asada':'Broaster'])for(const qty of [1,2]) {
  it(`included option retained to DTO ${other}/${agent}/${choice}/${qty}`,async()=>{
   const m=menu(other),h=harness(m,agent);h.service.ordersService.create=jest.fn().mockResolvedValue({id:384,dailyOrderNumber:384});
   await h.sendQueued(`${qty===1?'Un':'Dos'} combo${qty===1?'':'s'} de ${other?'pizza':'pollo'} con pepsi`);
   expect(h.conv.sessionData.cart).toEqual([]);
   expect(h.conv.sessionData.pendingMatch||h.conv.sessionData.pendingMultiOrder).toBeTruthy();
   await h.sendQueued(choice);
   expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:38404,quantity:qty,attributes:expect.arrayContaining([expect.objectContaining({attributeValue:'Pepsi'})])})]);
   await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const items=h.service.ordersService.create.mock.calls[0][0].items;
   expect(items).toHaveLength(qty);
   expect(items.every(p=>p.productId===38404&&p.attributes.some(a=>a.attributeValue==='Pepsi'))).toBe(true);
  });
 }
 for(const text of ['¿la bebida bien fría?','no quiero la bebida fría','¿cuánto cuesta un combo de pollo con pepsi?']) {
  it(`question or negation never edits notes ${other}/${agent}/${text}`,async()=>{
   const m=menu(other),h=harness(m,agent);await h.sendQueued(`Una ${m[1].name}`);
   const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);
   expect(h.conv.sessionData.cart).toEqual(before);
  });
 }
}
