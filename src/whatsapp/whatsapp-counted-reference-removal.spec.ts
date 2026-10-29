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
 for(const [token,amount] of [['dos',2],['3',3]] as const)for(const left of [0,2])for(const selection of ['direct','2','el de salsa aparte'])
 it(`counted removal ${m.family} ${agent} ${state} ${token} left=${left} ${selection}`,async()=>{
  const {h}=setup(m,agent,state,amount+left);
  const index=selection==='direct'?0:1;
  if(index){h.conv.sessionData.cart[1].attributes=structuredClone(h.conv.sessionData.cart[0].attributes);h.conv.sessionData.cart[1].quantity=amount+left;}
  const before=structuredClone(h.conv.sessionData.cart);let reply=await h.sendQueued(`quita ${token} de los de ${m.choice}`);
  if(index){expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartRemoval?.quantity).toBe(amount);reply=await h.sendQueued(selection);}
  expect(h.conv.sessionData.cart).toEqual(before.flatMap((line,i)=>i!==index?[line]:left?[{...line,quantity:left}]:[]));
  expect(reply).toContain(`${amount} unidades`);expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const scenario of ['zero','negative','decimal','huge','exceeds','question','payment','pending','unknown','mixed','stale','cancel'])
 it(`count guard ${m.family} ${agent} ${state} ${scenario}`,async()=>{
  const {h,menu}=setup(m,agent,state,4);let text=`quita dos de los de ${m.choice}`;
  const invalid={zero:'0',negative:'-1',decimal:'1.5',huge:'100',exceeds:'cinco'};
  if(scenario in invalid)text=`quita ${invalid[scenario]} de los de ${m.choice}`;
  if(scenario==='question')text='¿'+text+'?';
  if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
  if(scenario==='pending')h.conv.sessionData.pendingMatch={query:'otro',quantity:1,candidates:[menu[1]],intent:'order'};
  if(scenario==='unknown')text='quita dos de los de opcion inexistente';
  if(scenario==='mixed')text+=' y agrega otro';
  if(['stale','cancel'].includes(scenario)){
   h.conv.sessionData.cart[1].attributes=structuredClone(h.conv.sessionData.cart[0].attributes);await h.sendQueued(text);
   if(scenario==='stale'){h.conv.sessionData.cart[0].quantity=5;text='1';}else text='no quites nada';
  }
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/igual|cambi|pendiente/i);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(['stale','cancel'].includes(scenario))expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
 });
 for(const amount of [2,3])for(const mode of ['total','question','insufficient selection'])
 it(`count recovery ${m.family} ${agent} ${state} ${amount} ${mode}`,async()=>{
  const {h}=setup(m,agent,state,amount+2);h.conv.sessionData.cart[1].attributes=structuredClone(h.conv.sessionData.cart[0].attributes);
  if(mode!=='insufficient selection')h.conv.sessionData.cart[1].quantity=amount+2;
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`retira ${amount} de los de ${m.choice}`);
  const reply=await h.sendQueued(mode==='total'?'cuanto es el total':mode==='question'?'¿el de salsa aparte?':'2');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartRemoval?.quantity).toBe(amount);
  expect(reply).toMatch(mode==='total'?/total/i:/igual/i);
  await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual([{...before[0],quantity:2},before[1]]);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
