import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Limonada','Jugo','Gaseosa']) for(const agent of [false,true])
for(const existing of [false,true]) for(const quantity of [1,2,3]) {
 test(`${name}/${agent}/${existing}/${quantity}: quantified unique drink is purchased`,async()=>{
  const h=setup(name,agent);
  if(existing) await h.sendQueued('una Sopa Vegetal');
  await h.sendQueued(`${quantity===1?'una':quantity===2?'dos':'tres'} ${name}`);
  expect(h.cartRows().find(row=>row.id===95201)?.qty).toBe(quantity);
  expect(h.conv.sessionData.pendingMatch).toBeUndefined();
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.replies.at(-1)).toContain((quantity*5000+(existing?10000:0)).toLocaleString('es-CO'));
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(quantity+(existing?1:0));
 });
}
for(const name of ['Limonada','Jugo','Gaseosa']) for(const agent of [false,true])
for(const mode of ['inquiry','ambiguous','unavailable']) {
 test(`${name}/${agent}/${mode}: inquiry or unresolved catalog keeps existing cart`,async()=>{
  const h=setup(name,agent,mode);
  await h.sendQueued('una Sopa Vegetal');
  const cart=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(mode==='inquiry'?`que ${name} tienes`:`una ${name}`);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(mode==='ambiguous')expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
 });
}
for(const name of ['Limonada','Jugo','Gaseosa']) for(const agent of [false,true])
for(const quantity of [1,2]) for(const pick of [1,2]) {
 test(`${name}/${agent}/${quantity}/${pick}: ambiguous drink choice preserves requested quantity through closure`,async()=>{
  const h=setup(name,agent,'ambiguous');
  await h.sendQueued(`${quantity===1?'una':'dos'} ${name}`);
  expect(h.cartRows()).toHaveLength(0);
  expect(h.conv.sessionData.pendingMatch?.quantity).toBe(quantity);
  await h.sendQueued(String(pick));
  const id=pick===1?95201:95203,price=pick===1?5000:7000;
  expect(h.cartRows()).toEqual([expect.objectContaining({id,qty:quantity})]);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.replies.at(-1)).toContain((quantity*price).toLocaleString('es-CO'));
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(quantity);
 });
}
for(const name of ['Limonada','Jugo','Gaseosa']) for(const agent of [false,true]) {
 test(`${name}/${agent}: zero does not silently add one drink`,async()=>{
  const h=setup(name,agent);await h.sendQueued('una Sopa Vegetal');
  const cart=structuredClone(h.conv.sessionData.cart);
  expect(await h.sendQueued(`0 ${name}`)).toMatch(/mayor que cero/);
  expect(h.conv.sessionData.cart).toEqual(cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
for(const agent of [false,true]) for(const quantity of [1,2,3]) {
 test(`Jugo/${agent}/${quantity}: required flavor keeps quantified request`,async()=>{
  const h=setup('Jugo',agent,'flavor');
  await h.sendQueued(`${quantity===1?'un':quantity===2?'dos':'tres'} Jugo`);
  expect(h.cartRows()).toHaveLength(0);
  expect(h.conv.sessionData.pendingAttribute?.quantity||1).toBe(quantity);
  await h.sendQueued('Lulo');
  expect(h.cartRows()).toEqual([expect.objectContaining({id:95201,qty:quantity,attrs:['Sabor:Lulo']})]);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(quantity);
 });
}
function setup(name:string,agent:boolean,mode='normal'){
 const h=harness([
  {id:95201,code:1,name:mode==='ambiguous'?`${name} Natural`:name,price:5000,availableNow:mode!=='unavailable',categoryName:'Bebidas',hasAttributes:mode==='flavor',attributes:mode==='flavor'?[{attributeName:'Sabor',options:['Mango','Lulo']}]:[]},
  ...(mode==='ambiguous'?[{id:95203,code:3,name:`${name} Especial`,price:7000,availableNow:true,categoryName:'Bebidas',attributes:[]}]:[]),
  {id:95202,code:2,name:'Sopa Vegetal',price:10000,availableNow:true,categoryName:'Sopas',attributes:[]},
 ],agent);
 h.cfg.ignoreBusinessHours=false;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:512,dailyOrderNumber:512});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 return h;
}
