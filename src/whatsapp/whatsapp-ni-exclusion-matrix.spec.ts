import {harness} from './whatsapp-accuracy.test-support';
import {normalizeCorrection} from './whatsapp-quantity-correction';
const notes=['sin cebolla ni tomate','sin sal ni pimienta','sin salsa de tomate ni mayonesa','sin cebolla ni tomate ni lechuga'];
const menus=[['Bowl de garbanzos','Curry de lentejas','Pasta del huerto'],['Pizza de hongos','Ravioles de ricota','Risotto vegetal']];
async function setup(names:string[],agent:boolean,state='building_cart',quantity=1,onlyOne=false){
 const h=harness(names.map((name,i)=>({id:89701+i,code:89701+i,name,price:18000+i*1000,availableNow:true,attributes:[]})),agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 for(const name of (onlyOne?names.slice(0,1):names))await h.sendQueued(`quiero un ${name}`);
 h.conv.sessionData.cart[0].quantity=quantity;
 if(!onlyOne)h.conv.sessionData.cart.forEach(line=>line.note='bien empacado');
 h.conv.state=state;return h;
}
for(const names of menus)for(const agent of [false,true]){
 for(const state of ['building_cart','awaiting_final_confirm'])for(const [choice,index] of [['1',0],['2',1],[names[2],2],['perdón, el tercero',2]] as const)
 it.each(notes)(`ni selection ${names[0]} agent=${agent} ${state} ${choice}: %s`,async note=>{
  const h=await setup(names,agent,state),before=structuredClone(h.conv.sessionData.cart);
  const question=await h.sendQueued(`uno ${note}`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingSubsetKitchenNote?.note).toBe(note);
  expect(question).toMatch(/cu[aá]l|indica/i);expect(question).toContain(names[2]);
  const reply=await h.sendQueued(choice);
  expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>i===index?{...line,note:`bien empacado; ${note}`}:line));
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();expect(reply).toContain(note);
  expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const quantity of [2,3,4])it.each(notes)(`ni split ${names[0]} agent=${agent} quantity=${quantity}: %s`,async note=>{
  const h=await setup(names,agent,'building_cart',quantity,true),before=structuredClone(h.conv.sessionData.cart[0]);
  const reply=await h.sendQueued(`una ${note}`);
  expect(h.conv.sessionData.cart).toEqual([{...before,quantity:quantity-1},{...before,quantity:1,note}]);
  expect(reply).toContain(note);expect(h.conv.state).toBe('building_cart');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const state of ['building_cart','awaiting_final_confirm'])for(const choice of ['1','2'])
 it.each(notes)(`ni conflict ${names[0]} agent=${agent} ${state} ${choice}: %s`,async note=>{
  const h=await setup(names,agent,state);const index=Number(choice)-1;
  h.conv.sessionData.cart[index].note=`con ${note.split(' ni ')[1]}`;
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`uno ${note}`);const reply=await h.sendQueued(choice);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
  expect(reply).toMatch(/incompatible/i);expect(reply).toContain(before[index].note);expect(reply).toMatch(/no apliques esa nota/i);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const interruption of ['cuánto es el total','no entendí bien','¿el tercero?','el quinto'])
 it.each(notes)(`ni interruption ${names[0]} agent=${agent} ${interruption}: %s`,async note=>{
  const h=await setup(names,agent),before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`uno ${note}`);await h.sendQueued(interruption);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingSubsetKitchenNote?.note).toBe(note);
  const reply=await h.sendQueued(names[2]);
  expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>i===2?{...line,note:`bien empacado; ${note}`}:line));
  expect(normalizeCorrection(reply || '')).toContain(note);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const names of menus)for(const agent of [false,true])for(const cancel of [false,true])
it(`ni conflict recovery ${names[0]} agent=${agent} cancel=${cancel}`,async()=>{
 const h=await setup(names,agent);h.conv.sessionData.cart[0].note='con cebolla';
 const before=structuredClone(h.conv.sessionData.cart),note='sin cebolla ni tomate';
 await h.sendQueued(`uno ${note}`);await h.sendQueued('1');
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
 const reply=await h.sendQueued(cancel?'no apliques esa nota':names[2]);
 expect(h.conv.sessionData.cart).toEqual(cancel?before:before.map((line,i)=>i===2?{...line,note:`bien empacado; ${note}`}:line));
 expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();expect(reply).toMatch(cancel?/retir[eé]/i:/anotad/i);
 expect(h.conv.state).toBe('building_cart');expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
