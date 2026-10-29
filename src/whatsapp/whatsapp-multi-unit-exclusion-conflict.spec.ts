import {harness} from './whatsapp-accuracy.test-support';
const menus=[['Bowl de garbanzos','Curry de lentejas'],['Pizza de hongos','Ravioles de ricota']];
const notes=[['sin cebolla','cebolla'],['sin cebolla ni tomate','tomate'],['sin sal y sin pimienta','pimienta'],['sin salsa de tomate ni mayonesa','mayonesa']];
async function setup(names:string[],agent:boolean,state:string,quantity:number,conflictIndex:number,ingredient:string){
 const h=harness(names.map((name,i)=>({id:89901+i,code:89901+i,name,price:18000+i*1000,availableNow:true,attributes:[]})),agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 await h.sendQueued(`quiero ${quantity} ${names[0]}`);await h.sendQueued(`quiero un ${names[1]}`);
 expect(h.conv.sessionData.cart.map(line=>line.quantity)).toEqual([quantity,1]);
 // Previously saved kitchen notes, independent of how the prior turn produced them.
 h.conv.sessionData.cart.forEach((line,i)=>line.note=i===conflictIndex?`con ${ingredient}`:'bien empacado');
 h.conv.state=state;return h;
}
for(const names of menus)for(const agent of [false,true])for(const state of ['building_cart','awaiting_final_confirm'])for(const [note,ingredient] of notes){
 for(const quantity of [2,3,4])for(const conflict of [false,true])
 it(`scoped partial ${names[0]} agent=${agent} ${state} quantity=${quantity} ${note} conflict=${conflict}`,async()=>{
  const h=await setup(names,agent,state,quantity,conflict?0:-1,ingredient),before=structuredClone(h.conv.sessionData.cart);
  const phrase=(text:string)=>`uno de los ${quantity} ${names[0]} ${text} y los otros ${quantity-1} normales`;
  const expected=(text:string)=>[{...before[0],quantity:quantity-1},{...before[0],quantity:1,note:`${before[0].note}; ${text}`},before[1]];
  const reply=await h.sendQueued(phrase(note));
  expect(h.conv.sessionData.cart).toEqual(conflict?before:expected(note));
  expect(reply).toMatch(conflict?/incompatible/i:/sin /i);
  if(conflict){
   expect(reply).toContain(before[0].note);expect(reply).toMatch(/no cambi|sigue igual/i);
   await h.sendQueued(phrase('sin picante'));expect(h.conv.sessionData.cart).toEqual(expected('sin picante'));
  }
  expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const quantity of [1,2])for(const conflict of [false,true])
 it(`whole cart atomic ${names[0]} agent=${agent} ${state} quantity=${quantity} ${note} conflict=${conflict}`,async()=>{
  const h=await setup(names,agent,state,quantity,conflict?1:-1,ingredient),before=structuredClone(h.conv.sessionData.cart);
  const expected=(text:string)=>before.map(line=>({...line,note:`${line.note}; ${text}`}));
  const reply=await h.sendQueued(`${quantity+1} ${note}`);
  expect(h.conv.sessionData.cart).toEqual(conflict?before:expected(note));
  expect(reply).toMatch(conflict?/incompatible/i:/sin /i);
  if(conflict){
   expect(reply).toContain(names[1]);expect(reply).toContain(before[1].note);expect(reply).toMatch(/no cambi|sigue igual/i);
   await h.sendQueued(`${quantity+1} sin picante`);expect(h.conv.sessionData.cart).toEqual(expected('sin picante'));
  }
  expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
