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

function mixed(m:typeof menus[number],agent:boolean,state:string,q:number){
 const {h,menu}=setup(m,agent,state,q);
 const target={id:89503,code:89503,name:({'Pollo':'Agua Mineral','Tofu':'Papas Rusticas','Pescado':'Te Frio'} as Record<string,string>)[m.protein],price:7000,hasAttributes:false,availableNow:true,attributes:[]};
 menu.push(target);return {h,menu,target};
}
for(const m of menus)for(const agent of [false,true])for(const state of ['building_cart','awaiting_final_confirm']){
 for(const verb of ['agrega','ponme'])for(const [remove,add] of [[1,2],[2,3]])for(const left of [0,2])for(const merge of [false,true])
 it(`mixed removal addition ${m.family} ${agent} ${state} ${verb} ${remove}/${add} ${left} ${merge}`,async()=>{
  const {h,target}=mixed(m,agent,state,remove+left);
  const added={productId:target.id,code:target.code,name:target.name,quantity:1,unitPrice:target.price,attributes:[]};
  if(merge)h.conv.sessionData.cart.push(added);else if(left===0)Object.assign(h.cfg,{maxCartLines:2});
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`quita ${remove} de los de ${m.choice} y ${verb} ${add} ${target.name}`);
  const expected=before.flatMap((line,i)=>i===0?(left?[{...line,quantity:left}]:[]):[{...line,quantity:line.quantity+(line.productId===target.id?add:0)}]);
  if(!merge)expected.push({...added,quantity:add});
  expect(h.conv.sessionData.cart).toEqual(expected);expect(reply).toMatch(/quité.*agregué/);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const scenario of ['unknown source','ambiguous source','insufficient','zero removal','negative removal','unknown target','ambiguous target','unavailable','attributes','zero addition','decimal addition','negative addition','limit','question','payment','pending','condition','third action'])
 it(`mixed atomic guard ${m.family} ${agent} ${state} ${scenario}`,async()=>{
  const {h,menu,target}=mixed(m,agent,state,4);let amount='dos',count='2',reference=m.choice,name=target.name;
  if(scenario==='unknown source')reference='inexistente';
  if(scenario==='condition')reference+=' si hay sopa';if(scenario==='third action')name+=' y cambia el otro';
  if(scenario==='ambiguous source')h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[0]),note:'Otra nota'});
  if(scenario==='insufficient')amount='cinco';if(scenario==='zero removal')amount='0';if(scenario==='negative removal')amount='-1';
  if(scenario==='unknown target')name='producto inexistente';if(scenario==='ambiguous target')menu.push({...target,id:89504,code:89504});
  if(scenario==='unavailable')target.availableNow=false;
  if(scenario==='attributes'){target.hasAttributes=true;target.attributes=[{attributeName:'Sabor',options:['Mango','Fresa']}] as any;}
  if(scenario==='zero addition')count='0';if(scenario==='decimal addition')count='1.5';if(scenario==='negative addition')count='-1';
  if(scenario==='limit')Object.assign(h.cfg,{maxUnitsPerItem:1});if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
  if(scenario==='pending')h.conv.sessionData.pendingMatch={query:'otro',quantity:1,candidates:[menu[1]],intent:'order'};
  let text=`quita ${amount} de los de ${reference} y agrega ${count} ${name}`;if(scenario==='question')text='¿'+text+'?';
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/igual/);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`mixed correction recovery ${m.family} ${agent} ${state}`,async()=>{
  const {h,target}=mixed(m,agent,state,3);const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`quita uno de los de ${m.choice} y agrega dos producto inexistente`);expect(h.conv.sessionData.cart).toEqual(before);
  const reply=await h.sendQueued(`quita uno de los de ${m.choice} y agrega dos ${target.name}`);
  expect(h.conv.sessionData.cart).toEqual([{...before[0],quantity:2},before[1],{productId:target.id,code:target.code,name:target.name,quantity:2,unitPrice:target.price,attributes:[]}]);
  expect(reply).toMatch(/quité.*agregué/);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
