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
 for(const verb of ['quita','retira','saca'])for(const [a,b] of [['dos','uno'],['3','2'],['uno','dos']])for(const left of [0,2])
 it(`compound ${m.family} ${agent} ${state} ${verb} ${a}/${b} left=${left}`,async()=>{
  const number=(x:string)=>({uno:1,dos:2}[x]??Number(x));const first=number(a),second=number(b);
  const {h}=setup(m,agent,state,first+left);h.conv.sessionData.cart[1].quantity=second+left;
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`${verb} ${a} de los de ${m.choice} y ${b} de los de Cubos`);
  expect(h.conv.sessionData.cart).toEqual(left?before.map(line=>({...line,quantity:left})):[]);
  expect(reply).toMatch(/quité.*unidades/);expect(h.conv.state).toBe(left?state:'building_cart');
  expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const scenario of ['exceeds first','exceeds last','zero','negative','decimal','huge','unknown','ambiguous','overlap','question','payment','pending','mixed','condition'])
 it(`compound guard ${m.family} ${agent} ${state} ${scenario}`,async()=>{
  const {h,menu}=setup(m,agent,state,4);h.conv.sessionData.cart[1].quantity=3;
  let first='dos',second='uno',reference='Cubos',suffix='';
  if(scenario==='exceeds first')first='cinco';if(scenario==='exceeds last')second='cuatro';
  if(scenario==='zero')second='0';if(scenario==='negative')second='-1';if(scenario==='decimal')second='1.5';if(scenario==='huge')second='100';
  if(scenario==='unknown')reference='opcion inexistente';if(scenario==='overlap')reference=m.choice;
  if(scenario==='ambiguous')h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[1]),note:'Sin sal'});
  if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
  if(scenario==='pending')h.conv.sessionData.pendingMatch={query:'otro',quantity:1,candidates:[menu[1]],intent:'order'};
  if(scenario==='mixed')suffix=' y agrega otro';if(scenario==='condition')suffix=' si no hay sopa';
  let text=`quita ${first} de los de ${m.choice} y ${second} de los de ${reference}${suffix}`;if(scenario==='question')text='¿'+text+'?';
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/igual/);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`compound recovery ${m.family} ${agent} ${state}`,async()=>{
  const {h}=setup(m,agent,state,4);h.conv.sessionData.cart[1].quantity=3;
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`quita dos de los de ${m.choice} y cinco de los de Cubos`);expect(h.conv.sessionData.cart).toEqual(before);
  const reply=await h.sendQueued(`quita dos de los de ${m.choice} y uno de los de Cubos`);
  expect(h.conv.sessionData.cart).toEqual(before.map(line=>({...line,quantity:2})));expect(reply).toMatch(/quité.*unidades/);
  expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
