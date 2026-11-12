import {harness} from './whatsapp-accuracy.test-support';
import type {WhatsappProductCandidate} from './types/whatsapp-session.types';
const families=[{owner:'pollo',from:'Pollo Frito',to:'Pollo Broaster',style:'broaster'},
 {owner:'mojarra',from:'Mojarra Frita',to:'Mojarra Asada',style:'asada'}];
function setup(f=families[0],agent=false,state='building_cart',ambiguous=false){
 const attrs=[{attributeName:'Presa',options:['Pechuga','Pierna']},{attributeName:'Arepas',options:['Blancas','Fritas']}];
 const products:WhatsappProductCandidate[]=[
  {id:9901,code:11,name:f.from,price:10000,availableNow:true,hasAttributes:true,attributes:attrs},
  {id:9902,code:12,name:f.to,price:12000,availableNow:true,hasAttributes:true,attributes:attrs},
  {id:9903,code:13,name:'Agua Mineral',price:3000,availableNow:true,attributes:[]},
  {id:9904,code:14,name:'Papa Rustica',price:5000,availableNow:true,attributes:[]},
  {id:9905,code:15,name:'Jugo Natural',price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
  {id:9906,code:16,name:'Helado Artesanal',price:8000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Vainilla','Chocolate']}]},
  {id:9907,code:17,name:'Arroz Con Pollo y una Gaseosa',price:18000,availableNow:true,attributes:[]},
  {id:9908,code:18,name:'Porcion De Yuca',price:4000,availableNow:true,attributes:[]},
 ];
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:517,dailyOrderNumber:517});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 h.conv.sessionData.cart=[{productId:9901,code:11,name:f.from,quantity:2,unitPrice:10000,note:'Sin sal',attributes:[{attributeName:'Presa',attributeValue:'Pechuga'},{attributeName:'Arepas',attributeValue:'Fritas'}]},
  ambiguous?{productId:9901,code:11,name:f.from,quantity:1,unitPrice:10000,note:'Salsa aparte',attributes:[{attributeName:'Presa',attributeValue:'Pierna'},{attributeName:'Arepas',attributeValue:'Blancas'}]}:
  {productId:9904,code:14,name:'Papa Rustica',quantity:1,unitPrice:5000,note:'Bien caliente',attributes:[]}];
 h.conv.sessionData.productFocus={productId:9901,name:f.from};h.conv.state=state;
 return {h,products};
}
for(const f of families)for(const agent of [false,true])for(const state of ['building_cart','awaiting_final_confirm']){
 test(`multiple new purchases ${f.owner} ${agent} ${state}`,async()=>{
  const {h}=setup(f,agent,state);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`cambia el ${f.owner} a ${f.style} y agrega dos Agua Mineral y una Papa Rustica`);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:9902,quantity:2,note:'Sin sal',attributes:before[0].attributes});
  expect(h.conv.sessionData.cart).toContainEqual(before[1]);
  expect(h.conv.sessionData.cart.find(line=>line.productId===9903)).toMatchObject({quantity:2});
  expect(h.conv.sessionData.cart.filter(line=>line.productId===9904).reduce((sum,line)=>sum+line.quantity,0)).toBe(2);
  expect(reply).toMatch(/cambi[eé].*agregu[eé]/i);expect(h.conv.state).toBe(state);
 });
}
for(const f of families)for(const agent of [false,true])for(const pick of [1,2]){
 test(`source selection retains complete request ${f.owner} ${agent} ${pick}`,async()=>{
  const {h}=setup(f,agent,'building_cart',true);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`cambia el ${f.owner} a ${f.style} y agrega dos Agua Mineral y una Papa Rustica`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/cu[aá]l/i);expect(reply).not.toMatch(/Algo más/i);
  const chosen=await h.sendQueued(String(pick));
  expect(h.conv.sessionData.cart[pick-1]).toMatchObject({...before[pick-1],productId:9902,code:12,name:f.to,unitPrice:12000});
  expect(h.conv.sessionData.cart[2-pick]).toEqual(before[2-pick]);
  expect(h.conv.sessionData.cart.find(line=>line.productId===9903)).toMatchObject({quantity:2});
  expect(h.conv.sessionData.cart.find(line=>line.productId===9904)).toMatchObject({quantity:1});
  expect(chosen).toMatch(/cambi[eé].*agregu[eé]/i);
 });
}
for(const f of families)for(const agent of [false,true])for(const state of ['building_cart','awaiting_final_confirm'])for(const pick of [1,2])for(const form of ['number','attribute']){
 test(`complete mixed list journey ${f.owner} ${agent} ${state} ${pick} ${form}`,async()=>{
  const {h}=setup(f,agent,state,true);const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`ponme dos Agua Mineral sin hielo y una Porcion De Yuca y cambia el ${f.owner} por ${f.style}`);
  expect(h.conv.sessionData.cart).toEqual(before);
  const reply=await h.sendQueued(form==='number'?`la ${pick}`:`el de ${pick===1?'pechuga':'pierna'}`);
  expect(reply).toMatch(/cambi[eé].*agregu[eé]/i);expect(h.conv.state).toBe(state);
  expect(h.conv.sessionData.cart[pick-1]).toMatchObject({...before[pick-1],productId:9902,code:12,name:f.to,unitPrice:12000});
  expect(h.conv.sessionData.cart[2-pick]).toEqual(before[2-pick]);
  expect(h.conv.sessionData.cart.find(line=>line.productId===9903)).toMatchObject({quantity:2,note:'sin hielo'});
  expect(h.conv.sessionData.cart.find(line=>line.productId===9908)).toMatchObject({quantity:1});
  const expected=structuredClone(h.conv.sessionData.cart);await h.sendQueued('por favor');expect(h.conv.sessionData.cart).toEqual(expected);
  await h.sendQueued('nada más');await h.sendQueued('efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(6);expect(items.filter((item:{productId:number})=>item.productId===9902)).toHaveLength(before[pick-1].quantity);
  expect(items.filter((item:{productId:number})=>item.productId===9903)).toHaveLength(2);
 });
}
for(const agent of [false,true])for(const scenario of ['cancel','decline','whole cancel','expired','cart changed','confirm','courtesy','invalid','question','ambiguous name','old list','payment link']){
 test(`source choice safety ${agent} ${scenario}`,async()=>{
  const {h}=setup(families[0],agent,'awaiting_final_confirm',true);
  await h.sendQueued('cambia el pollo a broaster y agrega dos Agua Mineral y una Papa Rustica');
  expect(h.conv.sessionData.pendingCartReplacement?.mixedSourceRequest).toBeDefined();
  if(scenario==='expired')h.conv.sessionData.pendingCartReplacement!.mixedSourceRequest!.createdAt-=11*60*1000;
  if(scenario==='cart changed')h.conv.sessionData.cart[0].quantity=3;
  if(scenario==='payment link')h.conv.sessionData.mpPreferenceId='synthetic-only';
  if(scenario==='old list')h.conv.sessionData.pendingCategoryBrowse={categoryName:'otra lista',productIds:[9903]} as any;
  const before=structuredClone(h.conv.sessionData.cart);
  const text=scenario==='cancel'?'cancela ese cambio':scenario==='decline'?'no gracias':scenario==='whole cancel'?'Por favor cancelar pedido':scenario==='confirm'?'confirmar':scenario==='courtesy'?'por favor':scenario==='invalid'?'99':scenario==='question'?'¿1?':scenario==='ambiguous name'?'pollo':'1';
  const reply=await h.sendQueued(text);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(scenario==='whole cancel')expect(h.conv.sessionData.cart).toEqual([]);
  else if(scenario==='old list'){
   expect(h.conv.sessionData.cart[0]).toMatchObject({productId:9902,quantity:2});expect(h.conv.sessionData.cart.find(line=>line.productId===9903)).toMatchObject({quantity:2});
  }else{
   expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/igual/);
   if(['confirm','courtesy','invalid','question','ambiguous name'].includes(scenario))expect(h.conv.sessionData.pendingCartReplacement?.mixedSourceRequest).toBeDefined();
   if(['cancel','decline','expired','cart changed'].includes(scenario))expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();
  }
 });
}
for(const agent of [false,true])for(const ambiguous of [false,true])test(`queued options keep every purchase ${agent} ${ambiguous}`,async()=>{
 const {h}=setup(families[0],agent,'awaiting_final_confirm',ambiguous);const before=structuredClone(h.conv.sessionData.cart);
 let reply=await h.sendQueued('cambia el pollo a broaster y agrega dos Jugo Natural sin azucar y un Helado Artesanal y dos Agua Mineral sin hielo');
 if(ambiguous){expect(reply).toMatch(/cu[aá]l/i);reply=await h.sendQueued('2');}
 expect(reply).toMatch(/Jugo Natural/);expect(reply).not.toMatch(/Algo más/i);expect(h.conv.sessionData.cart).toEqual(before);
 reply=await h.sendQueued('Lulo');expect(reply).toMatch(/Helado Artesanal/);expect(h.conv.sessionData.cart).toEqual(before);
 const waiting=structuredClone(h.conv.sessionData.pendingCartReplacement);
 await h.sendQueued('confirmar');expect(h.conv.sessionData.pendingCartReplacement).toEqual(waiting);expect(h.conv.sessionData.cart).toEqual(before);
 reply=await h.sendQueued('2');expect(reply).toMatch(/cambi[eé].*agregu[eé]/i);
 expect(h.conv.sessionData.cart[ambiguous?1:0]).toMatchObject({productId:9902,quantity:ambiguous?1:2,note:ambiguous?'Salsa aparte':'Sin sal'});
 expect(h.conv.sessionData.cart.find(line=>line.productId===9905)).toMatchObject({quantity:2,note:'sin azucar',attributes:[{attributeName:'Sabor',attributeValue:'Lulo'}]});
 expect(h.conv.sessionData.cart.find(line=>line.productId===9906)).toMatchObject({quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Chocolate'}]});
 expect(h.conv.sessionData.cart.find(line=>line.productId===9903)).toMatchObject({quantity:2,note:'sin hielo'});
 await h.sendQueued('nada más');await h.sendQueued('efectivo');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(8);
});
for(const agent of [false,true])for(const scenario of ['later price','later availability','later attributes','cart changed','expired','cancel'])test(`multi-option pending invalidation ${agent} ${scenario}`,async()=>{
 const {h,products}=setup(families[0],agent);await h.sendQueued('cambia el pollo a broaster y agrega dos Jugo Natural y un Helado Artesanal');
 expect(h.conv.sessionData.pendingCartReplacement?.mixedPurchase?.purchases).toHaveLength(2);
 if(scenario==='later price')products.find(p=>p.id===9906)!.price+=1000;
 if(scenario==='later availability')products.find(p=>p.id===9906)!.availableNow=false;
 if(scenario==='later attributes')products.find(p=>p.id===9906)!.attributes![0].options=['Limon'];
 if(scenario==='cart changed')h.conv.sessionData.cart[0].quantity=3;
 if(scenario==='expired')h.conv.sessionData.pendingCartReplacement!.mixedPurchase!.createdAt-=11*60*1000;
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(scenario==='cancel'?'cancela ese cambio':'Mango');
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])for(const text of [
 'cambia el pollo a broaster y agrega dos Arroz Con Pollo y una Gaseosa',
 'cambia el pollo a broaster y agrega dos Arroz Con Pollo y una Gaseosa y una Porcion De Yuca',
 'cambia el pollo a broaster y agrega dos Agua Mineral sin hielo y sin azucar y una Porcion De Yuca',
 'cambia el pollo a broaster y agrega dos Agua Mineral y otra Agua Mineral',
])test(`catalog conjunctions and separate notes ${agent} ${text}`,async()=>{
 const {h}=setup(families[0],agent);await h.sendQueued(text);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:9902,quantity:2,note:'Sin sal'});
 if(text.includes('Arroz'))expect(h.conv.sessionData.cart.find(line=>line.productId===9907)).toMatchObject({quantity:2});
 else expect(h.conv.sessionData.cart.find(line=>line.productId===9903)).toMatchObject({quantity:text.includes('otra')?3:2,...(text.includes('sin hielo')?{note:'sin hielo y sin azucar'}:{})});
 if(text.includes('Yuca'))expect(h.conv.sessionData.cart.find(line=>line.productId===9908)).toMatchObject({quantity:1});
});
for(const agent of [false,true])for(const scenario of ['unknown last','unavailable last','ambiguous last','line limit','amount limit','silent clamp','third action','negative quantity','question'])test(`multiple purchase atomic guard ${agent} ${scenario}`,async()=>{
 const {h,products}=setup(families[0],agent);let buys='dos Agua Mineral y una Porcion De Yuca';
 if(scenario==='unknown last')buys='dos Agua Mineral y una Cosa Inexistente';
 if(scenario==='unavailable last')products.find(p=>p.id===9908)!.availableNow=false;
 if(scenario==='ambiguous last')products.push({...products.find(p=>p.id===9908)!,id:9918,code:28});
 if(scenario==='line limit')Object.assign(h.cfg,{maxCartLines:3});
 if(scenario==='amount limit')Object.assign(h.cfg,{maxOrderAmount:36000});
 if(scenario==='silent clamp'){buys='20 Agua Mineral y 15 Agua Mineral';Object.assign(h.cfg,{maxUnitsPerItem:100,maxCartUnits:200,maxOrderAmount:999999});}
 if(scenario==='third action')buys+=' y quita la papa';
 if(scenario==='negative quantity')buys='dos Agua Mineral y -1 Porcion De Yuca';
 let text=`cambia el pollo a broaster y agrega ${buys}`;if(scenario==='question')text='¿'+text+'?';
 const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/igual/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])test(`legacy single-purchase pending session still resumes ${agent}`,async()=>{
 const {h}=setup(families[0],agent);await h.sendQueued('cambia el pollo a broaster y agrega dos Jugo Natural');
 const plan=h.conv.sessionData.pendingCartReplacement!.mixedPurchase!;delete plan.purchases;delete plan.purchaseIndex;
 await h.sendQueued('Mango');expect(h.conv.sessionData.cart[0]).toMatchObject({productId:9902,quantity:2});
 expect(h.conv.sessionData.cart.find(line=>line.productId===9905)).toMatchObject({quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]});
});
for(const agent of [false,true])for(const ambiguous of [false,true])for(const quantity of ['-1','1.5'])test(`raw counted quantities remain validated ${agent} ${ambiguous} ${quantity}`,async()=>{
 const {h}=setup(families[0],agent,'building_cart',ambiguous);const before=structuredClone(h.conv.sessionData.cart);
 const reply=await h.sendQueued(`ponme dos Agua Mineral y ${quantity} Porcion De Yuca y cambia el pollo a broaster`);
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();expect(reply).toMatch(/cantidades.*enteras/i);
});
for(const agent of [false,true])for(const pending of [false,true])test(`same SKU purchases retain distinct flavors and notes ${agent} ${pending}`,async()=>{
 const {h}=setup(families[0],agent);const first=pending?'sin azucar':'Mango';
 await h.sendQueued(`cambia el pollo a broaster y agrega dos Jugo Natural ${first} y un Jugo Natural Lulo`);
 if(pending){expect(h.conv.sessionData.cart.some(line=>line.productId===9902)).toBe(false);await h.sendQueued('Mango');}
 const juices=h.conv.sessionData.cart.filter(line=>line.productId===9905);expect(juices).toHaveLength(2);
 expect(juices).toContainEqual(expect.objectContaining({quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}],...(pending?{note:'sin azucar'}:{})}));
 expect(juices).toContainEqual(expect.objectContaining({quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Lulo'}]}));
});
for(const agent of [false,true])for(const size of ['1.5L','2.5L'])test(`bottle sizes are not rejected as fractional purchase counts ${agent} ${size}`,async()=>{
 const {h,products}=setup(families[0],agent);products.find(p=>p.id===9903)!.name=`Agua ${size}`;
 await h.sendQueued(`cambia el pollo a broaster y agrega dos Agua ${size} y una Porcion De Yuca`);
 expect(h.conv.sessionData.cart.find(line=>line.productId===9902)).toMatchObject({quantity:2});
 expect(h.conv.sessionData.cart.find(line=>line.productId===9903)).toMatchObject({quantity:2});expect(h.conv.sessionData.cart.find(line=>line.productId===9908)).toMatchObject({quantity:1});
});
for(const agent of [false,true])for(const scenario of ['unavailable compound','ambiguous compound'])test(`a compound catalog identity cannot become separate purchases ${agent} ${scenario}`,async()=>{
 const {h,products}=setup(families[0],agent);
 products.push({id:9909,code:19,name:'Arroz Con Pollo',price:14000,availableNow:true,attributes:[]},{id:9910,code:20,name:'Gaseosa',price:4000,availableNow:true,attributes:[]});
 if(scenario==='unavailable compound')products.find(p=>p.id===9907)!.availableNow=false;
 else products.push({...products.find(p=>p.id===9907)!,id:9917,code:27});
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('cambia el pollo a broaster y agrega dos Arroz Con Pollo y una Gaseosa y una Porcion De Yuca');
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
