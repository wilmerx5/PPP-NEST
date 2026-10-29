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
 for(const quantity of [2,3,4])for(const index of [0,1])for(const verb of ['cambia','cambiame','cámbiame'])
 it(`one preparation ${m.family} agent=${agent} ${state} q=${quantity} index=${index} ${verb}`,async()=>{
  const {h,line}=setup(m,agent,state,quantity,index),before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`${verb} uno de los de ${m.choice} a ${m.protein} broaster`);
  const target={...line,quantity:1,productId:89502,code:89502,name:m.family+' Broaster',unitPrice:25000};
  expect(h.conv.sessionData.cart).toEqual(before.flatMap((item,i)=>i===index?[{...item,quantity:quantity-1},target]:[item]));
  expect(h.conv.state).toBe(state);expect(reply).toMatch(/cambi[eé].*1|cambi[eé].*una unidad/i);
  expect(reply).toMatch(/bajita de azúcar/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const scenario of ['ambiguous','unknown','unavailable','incompatible','duplicate target','payment','question','extra request','pending choice','line limit','amount limit','missing source'])
 it(`partial guard ${m.family} agent=${agent} ${state} ${scenario}`,async()=>{
  const {h,menu}=setup(m,agent,state,3);let phrase=`cambia uno de los de ${m.choice} a ${m.protein} broaster`;
  if(scenario==='ambiguous')h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[0]),note:'Sin tomate'});
  if(scenario==='unknown')phrase='cambia uno de los de opcion inexistente a '+m.protein+' broaster';
  if(scenario==='unavailable')menu[1].availableNow=false;
  if(scenario==='incompatible')menu[1].attributes=[{attributeName:m.key,options:['Cubos']},menu[1].attributes[1]];
  if(scenario==='duplicate target')menu.push({...menu[1],id:89503,code:89503});
  if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
  if(scenario==='question')phrase='¿'+phrase+'?';
  if(scenario==='extra request')phrase+=' y agrega otro';
  if(scenario==='pending choice')h.conv.sessionData.pendingMatch={query:'otro',quantity:1,candidates:[menu[1]],intent:'order'};
  if(scenario==='line limit')Object.assign(h.cfg,{maxCartLines:2});
  if(scenario==='amount limit')Object.assign(h.cfg,{maxOrderAmount:96500});
  if(scenario==='missing source')menu.splice(0,1);
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(phrase);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
  expect(h.replies.at(-1)).toMatch(/igual|cambio|pendiente/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
