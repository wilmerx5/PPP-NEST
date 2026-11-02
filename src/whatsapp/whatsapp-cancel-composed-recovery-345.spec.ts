import {harness,products} from './whatsapp-accuracy.test-support';
function setup(other:boolean,agent:boolean){
 const menu=other?[
  {id:97201,code:1,name:'Pasta',price:18000},{id:97202,code:2,name:'Setas Del Bosque',price:9000},
  {id:97203,code:3,name:'Pasta Con Setas Del Bosque',price:23000},
 ].map(p=>({...p,availableNow:true,hasAttributes:false,attributes:[]})):structuredClone(products);
 const ids=other?[97201,97202,97203]:[26,60,84];
 const h=harness(menu,agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:345,dailyOrderNumber:345});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.conv.sessionData.cart=ids.slice(0,2).map((id,i)=>{const p=menu.find(p=>p.id===id)!;return {productId:id,name:p.name,code:p.code,unitPrice:p.price,quantity:1,attributes:[],...(i?{note:'sin gaseosa'}:{})};});
 h.conv.sessionData.productFocus={productId:ids[1],name:menu.find(p=>p.id===ids[1])!.name};
 h.conv.state='awaiting_final_confirm';
 h.conv.sessionData.paymentMethod='transfer';
 return {h,menu,ids};
}
for(const other of [false,true])for(const agent of [false,true]){
 for(const command of ['Cancelar.','¡Cancelar!','Por favor cancelar pedido.','Cancela el pedido.']){
  it('cancel unsent '+other+agent+command,async()=>{
   const {h}=setup(other,agent);const reply=await h.sendQueued(command);
   expect(h.conv.sessionData.cart).toEqual([]);
   expect(h.conv.state).toBe('building_cart');
   expect(reply).toMatch(/cancelado|descart/i);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
 it('recover composed dish '+other+agent,async()=>{
  const {h,ids,menu}=setup(other,agent);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('En combo.');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply).toContain(menu.find(p=>p.id===ids[2])!.name);
  expect(reply).toMatch(/sin gaseosa/i);
  await h.sendQueued('sí');
  expect(h.conv.sessionData.cart.map(l=>[l.productId,l.quantity])).toEqual([[ids[2],1]]);
  expect(h.conv.sessionData.cart[0].note).toMatch(/sin gaseosa/i);
  const receipt=await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:ids[2],note:expect.stringMatching(/sin gaseosa/i)})]);
  expect(receipt).toContain(other?'23.000':'48.000');
 });
}
for(const other of [false,true])for(const scenario of ['decline','stale','stock','price','expiry','confirm','cancel']){
 it('recovery guard '+other+scenario,async()=>{
  const {h,menu,ids}=setup(other,true);
  await h.sendQueued('En combo.');
  const before=structuredClone(h.conv.sessionData.cart);
  if(scenario==='stale')h.conv.sessionData.cart[0].quantity=2;
  if(scenario==='stock')menu.find(p=>p.id===ids[2])!.availableNow=false;
  if(scenario==='price')menu.find(p=>p.id===ids[2])!.price+=1000;
  if(scenario==='expiry')h.conv.sessionData.pendingComposedDishRecovery!.createdAt=Date.now()-10*60_000;
  const expected=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(scenario==='decline'?'no':scenario==='confirm'?'confirmar':scenario==='cancel'?'Cancelar.':'sí');
  if(scenario==='cancel')expect(h.conv.sessionData.cart).toEqual([]);
  else expect(h.conv.sessionData.cart).toEqual(expected);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(reply).toBeTruthy();
  if(scenario!=='confirm')expect(h.conv.sessionData.pendingComposedDishRecovery).toBeUndefined();
  if(scenario==='decline')expect(h.conv.sessionData.cart).toEqual(before);
 });
}
for(const command of ['No quiero cancelar el pedido.','¿Puedo cancelar el pedido?','Si no hay sopa quiero cancelar el pedido.']){
 it('cancel qualification '+command,async()=>{
  const {h}=setup(false,true);const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(command);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
it('cancel unsent cart does not cancel an existing registered order',async()=>{
 const {h}=setup(false,true);
 h.service.ordersService.findTodayOrdersByPhone.mockResolvedValue([{id:99,dailyOrderNumber:99,orderStatus:'cooking'}]);
 const reply=await h.sendQueued('Cancelar.');
 expect(h.conv.sessionData.cart).toEqual([]);
 expect(reply).toMatch(/sigue.*preparación/);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
