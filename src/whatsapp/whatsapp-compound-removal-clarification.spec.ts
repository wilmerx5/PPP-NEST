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

function plan(m:typeof menus[number],agent:boolean,state:string,amount:number,both:boolean){
 const {h,menu}=setup(m,agent,state,amount+2);
 h.conv.sessionData.cart[1].quantity=3;
 h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[0]),note:'Salsa aparte'});
 if(both)h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[1]),note:'Sin sal'});
 return {h,menu,request:`quita ${amount} de los de ${m.choice} y uno de los de Cubos`};
}
for(const m of menus)for(const agent of [false,true])for(const state of ['building_cart','awaiting_final_confirm']){
 for(const amount of [2,3])for(const selection of ['2','el de salsa aparte'])for(const both of [false,true])
 it(`compound clarification ${m.family} ${agent} ${state} ${amount} ${selection} ${both}`,async()=>{
  const {h,request}=plan(m,agent,state,amount,both);const before=structuredClone(h.conv.sessionData.cart);
  const initial=await h.sendQueued(request);expect(h.conv.sessionData.cart).toEqual(before);
  expect(initial).toContain(`${amount} unidades`);expect(h.conv.sessionData.pendingCartRemoval?.batchGroups).toBeDefined();
  let reply=await h.sendQueued(selection);
  if(both){expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toContain('1 unidad');reply=await h.sendQueued('2');}
  expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>({...line,quantity:line.quantity-(i===2?amount:i===(both?3:1)?1:0)})));
  expect(reply).toMatch(/quité.*unidades/);expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const scenario of ['cancel','stale','invalid choice','question','total','payment','pending','unknown last','invalid last','insufficient choice'])
 it(`compound clarification guard ${m.family} ${agent} ${state} ${scenario}`,async()=>{
  const {h,menu,request}=plan(m,agent,state,2,false);
  if(scenario==='insufficient choice')h.conv.sessionData.cart[2].quantity=1;
  const initial=request.replace('Cubos',scenario==='unknown last'?'inexistente':'Cubos').replace('y uno',scenario==='invalid last'?'y 100':'y uno');
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(initial);
  expect(h.conv.sessionData.cart).toEqual(before);
  if(['unknown last','invalid last'].includes(scenario)){expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();return;}
  expect(h.conv.sessionData.pendingCartRemoval?.batchGroups).toBeDefined();
  if(scenario==='stale')h.conv.sessionData.cart[0].quantity++;
  if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
  if(scenario==='pending')h.conv.sessionData.pendingMatch={query:'otro',quantity:1,candidates:[menu[1]],intent:'order'};
  const current=structuredClone(h.conv.sessionData.cart);
  const answer=({'cancel':'no quites nada','stale':'2','invalid choice':'99','question':'¿el de salsa aparte?','total':'cuanto es el total'} as Record<string,string>)[scenario]||'2';
  const reply=await h.sendQueued(answer);expect(h.conv.sessionData.cart).toEqual(current);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(reply).toMatch(scenario==='total'?/total/i:/igual|cambi/i);
  if(['cancel','stale'].includes(scenario))expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();else expect(h.conv.sessionData.pendingCartRemoval?.batchGroups).toBeDefined();
 });
 for(const interruption of ['total','invalid','insufficient','cancel second'])
 it(`compound clarification recovery ${m.family} ${agent} ${state} ${interruption}`,async()=>{
  const {h,request}=plan(m,agent,state,2,true);if(interruption==='insufficient')h.conv.sessionData.cart[2].quantity=1;
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(request);
  if(interruption==='cancel second'){
   await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('no quites nada');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
  }else{
   await h.sendQueued(interruption==='total'?'cuanto es el total':interruption==='invalid'?'99':'2');expect(h.conv.sessionData.cart).toEqual(before);
   await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('2');
   expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>({...line,quantity:line.quantity-(i===0?2:i===3?1:0)})));expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
  }
  expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`compound overlap recovery ${m.family} ${agent} ${state}`,async()=>{
  const {h}=plan(m,agent,state,2,false);const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`quita dos de los de ${m.choice} y uno de los de ${m.choice}`);
  await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual(before);
  const reply=await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toContain('igual');
  expect(h.conv.sessionData.pendingCartRemoval?.batchQuantities).toEqual([2,1]);
  await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>({...line,quantity:line.quantity-(i===0?2:i===2?1:0)})));
  expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });

}
