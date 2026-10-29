import { harness } from './whatsapp-accuracy.test-support';
const menus = [
 {family:'Ejecutivo Con Pollo',protein:'Pollo',key:'Presa',choice:'Pechuga'},
 {family:'Bandeja Con Tofu',protein:'Tofu',key:'Corte',choice:'Filete'},
 {family:'Plato Con Pescado',protein:'Pescado',key:'Corte',choice:'Lomo'},
];
function setup(m:typeof menus[number],agent:boolean,state:string,quantity:number,index=0){
 const attrs=[{attributeName:m.key,options:[m.choice,'Cubos']},{attributeName:'Bebida',options:['Limonada','Cola']}];
 const menu=[{id:89501,code:89501,name:m.family+' Frito',price:24000,hasAttributes:true,availableNow:true,attributes:attrs},{id:89502,code:89502,name:m.family+' Broaster',price:25000,hasAttributes:true,availableNow:true,attributes:attrs}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn();h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const line={productId:89501,code:89501,name:menu[0].name,quantity,unitPrice:24000,note:'Sin sal; bebida bajita de azúcar',attributes:[{attributeName:m.key,attributeValue:m.choice},{attributeName:'Bebida',attributeValue:'Limonada'}]};
 const other={...structuredClone(line),quantity:1,note:'Salsa aparte',attributes:[{attributeName:m.key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}]};
 h.conv.sessionData.cart=index?[other,line]:[line,other];h.conv.state=state;
 return {h,menu,line};
}
for(const m of menus)for(const agent of [false,true])for(const state of ['building_cart','awaiting_final_confirm']){
 for(const quantity of [1,2,4])for(const index of [0,1])for(const verb of ['quita','quítame','retira'])
 it(`single removal ${m.family} ${agent} ${state} q=${quantity} index=${index} ${verb}`,async()=>{
  const {h}=setup(m,agent,state,quantity,index),before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`${verb} uno de los de ${m.choice}`);
  expect(h.conv.sessionData.cart).toEqual(before.flatMap((line,i)=>i!==index?[line]:quantity>1?[{...line,quantity:quantity-1}]:[]));
  expect(reply).toMatch(/una unidad/i);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const quantity of [1,2,4])for(const selection of ['2','el de salsa aparte'])
 it(`clarified unit ${m.family} ${agent} ${state} q=${quantity} ${selection}`,async()=>{
  const {h}=setup(m,agent,state,quantity);h.conv.sessionData.cart[1].attributes=structuredClone(h.conv.sessionData.cart[0].attributes);h.conv.sessionData.cart[1].quantity=quantity;
  const before=structuredClone(h.conv.sessionData.cart);
  const prompt=await h.sendQueued(`quita uno de los de ${m.choice}`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(prompt).toMatch(/una unidad/i);expect(prompt).toMatch(/1\.|2\./);
  const reply=await h.sendQueued(selection);
  expect(h.conv.sessionData.cart).toEqual(quantity>1?[before[0],{...before[1],quantity:quantity-1}]:[before[0]]);
  expect(reply).toMatch(/una unidad/i);expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const scenario of ['unknown','question','extra request','payment','pending choice','stale','cancel','invalid selection'])
 it(`unit removal guard ${m.family} ${agent} ${state} ${scenario}`,async()=>{
  const {h,menu}=setup(m,agent,state,3);let phrase=`quita uno de los de ${m.choice}`;
  if(scenario==='unknown')phrase='quita uno de los de opcion inexistente';
  if(scenario==='question')phrase='¿'+phrase+'?';
  if(scenario==='extra request')phrase+=' y agrega otro';
  if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
  if(scenario==='pending choice')h.conv.sessionData.pendingMatch={query:'otro',quantity:1,candidates:[menu[1]],intent:'order'};
  if(['stale','cancel','invalid selection'].includes(scenario)){
   h.conv.sessionData.cart[1].attributes=structuredClone(h.conv.sessionData.cart[0].attributes);
   await h.sendQueued(phrase);
   if(scenario==='stale'){h.conv.sessionData.cart[0].quantity=4;phrase='1';}
   if(scenario==='cancel')phrase='no quites nada';
   if(scenario==='invalid selection')phrase='9';
  }
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(phrase);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);expect(reply).toMatch(/igual|cambi|número|pendiente/i);
  if(['stale','cancel'].includes(scenario))expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const m of menus)for(const agent of [false,true])for(const state of ['building_cart','awaiting_final_confirm'])for(const scenario of ['total','question','last unit'])
it(`interruption or empty ${m.family} ${agent} ${state} ${scenario}`,async()=>{
 const {h}=setup(m,agent,state,1);
 if(scenario==='last unit')h.conv.sessionData.cart.splice(1,1);
 else h.conv.sessionData.cart[1].attributes=structuredClone(h.conv.sessionData.cart[0].attributes);
 const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued(`quita uno de los de ${m.choice}`);
 if(scenario==='last unit'){
  expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.state).toBe('building_cart');expect(h.replies.at(-1)).toMatch(/gustaría pedir/i);
 }else{
  const reply=await h.sendQueued(scenario==='total'?'cuanto es el total':'¿el de salsa aparte?');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartRemoval?.quantity).toBe(1);
  expect(reply).toMatch(scenario==='total'?/total/i:/igual/i);
  await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual([before[0]]);expect(h.conv.state).toBe(state);
 }
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
