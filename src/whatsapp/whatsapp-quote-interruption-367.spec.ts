import { harness } from './whatsapp-accuracy.test-support';
import { writeFileSync } from 'fs';
async function setup(other:boolean,agent:boolean){
 const names=other?['Batido Natural','Smoothie Especial','Malteada Especial']:['Jugo En Agua','Jugo En Leche','Malteada Natural'];
 const menu=names.map((name,i)=>({id:98701+i,code:891+i,name,price:10000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]}));
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:367,dailyOrderNumber:367});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 await h.sendQueued(`Cuánto cuestan 2 ${names[0]} y 3 ${names[1]} y 1 ${names[2]}?`);
 expect(h.conv.sessionData.pendingAddOffer?.productIds).toEqual(menu.map(p=>p.id));await h.sendQueued('sí');
 expect(h.conv.sessionData.pendingAttribute?.productId).toBe(menu[0].id);return {h,menu};
}
for(const other of [false,true])for(const agent of [false,true]){
 for(const removed of [false,true])it(`queued unavailable ${other} ${agent} ${removed}`,async()=>{
  const {h,menu}=await setup(other,agent);const current=structuredClone(menu);current[1].availableNow=false;h.service.catalogService.getMenuProducts.mockResolvedValue(removed?current.filter(p=>p.id!==menu[1].id):current);
  const reply=await h.sendQueued('Mango');expect(reply).toContain(menu[1].name);expect(reply).toMatch(/no est[aá] disponible|ya no est[aá] en la carta/i);expect(reply).toContain(menu[2].name);
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(menu[2].id);expect(h.conv.sessionData.cart).toHaveLength(1);
  await h.sendQueued('Lulo');expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual([menu[0].id,menu[2].id]);
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(3);
 });
 for(const phrase of ['cancelar pedido','cancela el pedido'])it(`cancel quoted options ${other} ${agent} ${phrase}`,async()=>{
  const {h}=await setup(other,agent);await h.sendQueued('Mango');await h.sendQueued(phrase);expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('Lulo');expect(h.conv.sessionData.cart).toEqual([]);
 });
}
for(const other of [false,true])for(const agent of [false,true])for(const removed of [false,true]) {
 it(`active unavailable resumes next ${other} ${agent} ${removed}`,async()=>{
  const {h,menu}=await setup(other,agent);const current=structuredClone(menu);current[0].availableNow=false;h.service.catalogService.getMenuProducts.mockResolvedValue(removed?current.filter(p=>p.id!==menu[0].id):current);
  try {
   const reply=await h.sendQueued('Mango');expect(h.conv.sessionData.cart).toEqual([]);expect(reply).toContain(menu[0].name);expect(reply).toMatch(/no est[aá] disponible|ya no est[aá] en la carta/i);
   expect(h.conv.sessionData.pendingAttribute?.productId).toBe(menu[1].id);expect(reply).toContain(menu[1].name);
   await h.sendQueued('Lulo');expect(h.conv.sessionData.pendingAttribute?.productId).toBe(menu[2].id);await h.sendQueued('Mango');
   expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual([menu[1].id,menu[2].id]);
   await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(4);
  }finally{writeFileSync(`/tmp/ppp-367-active-${other}-${agent}-${removed}.json`,JSON.stringify({session:h.conv.sessionData,state:h.conv.state,replies:h.replies},null,2));}
 });
}
for(const other of [false,true])for(const agent of [false,true])for(const scenario of ['second','all','remaining'])for(const removed of [false,true]){
 it(`unavailable queue recovery ${other} ${agent} ${scenario} ${removed}`,async()=>{
  const {h,menu}=await setup(other,agent);const stage=scenario==='all'?0:1;
  if(stage)await h.sendQueued('Mango');
  const before=structuredClone(h.conv.sessionData.cart);
  const missing=scenario==='second'?[1]:scenario==='all'?[0,1,2]:[1,2];
  const current=structuredClone(menu);for(const i of missing)current[i].availableNow=false;
  // Keep one unrelated catalog entry so an empty response is not confused with a failed catalog load.
  const sentinel={id:98799,code:999,name:'Pan Integral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
  h.service.catalogService.getMenuProducts.mockResolvedValue([...current.filter((_,i)=>!removed||!missing.includes(i)),sentinel]);
  const reply=await h.sendQueued('Lulo');
  expect(h.conv.sessionData.cart).toEqual(before);for(const i of missing)expect(reply).toContain(menu[i].name);
  expect(reply).toMatch(/no est[aá] disponible|ya no est[aá] en la carta/i);
  if(scenario==='second'){
   expect(h.conv.sessionData.pendingAttribute?.productId).toBe(menu[2].id);expect(reply).toContain(menu[2].name);await h.sendQueued('Lulo');
   expect(h.conv.sessionData.cart).toContainEqual(expect.objectContaining({productId:menu[0].id,quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]}));
   expect(h.conv.sessionData.cart).toContainEqual(expect.objectContaining({productId:menu[2].id,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Lulo'}]}));
  }
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(scenario!=='all'){
   await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const items=h.service.ordersService.create.mock.calls[0][0].items;
   expect(items).toHaveLength(scenario==='second'?3:2);for(const item of items)expect(missing.map(i=>menu[i].id)).not.toContain(item.productId);
  } else {
   await h.sendQueued('Quiero Pan Integral');expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual([98799]);
  }
 });
}
