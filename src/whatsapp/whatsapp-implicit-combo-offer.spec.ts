import { harness } from './whatsapp-accuracy.test-support';
const p=(id:number,name:string,description:string,attributes:any[]=[])=>({id,code:id,name,price:20000,description,availableNow:true,hasAttributes:!!attributes.length,attributes});
const menus=[
 {key:'rice',title:'Arroz Especial Con Medio Pollo',component:'Medio Pollo',style:'Frito',drink:'7up'},
 {key:'bowl',title:'Bowl De Quinoa Con Tofu',component:'Tofu',style:'Asado',drink:'3fresh'},
 {key:'pasta',title:'Pasta Con Champinones',component:'Champinones',style:'Salteados',drink:'9cool'},
];
for(const m of menus) for(const agent of [false,true]) {
 const attributes=[{attributeName:'Preparación',options:[m.style,'Normal']}];
 const beverages=[{attributeName:'Bebida',options:['Agua',m.drink]}];
 const menu=[p(99101,m.title,'Incluye ensalada',attributes),p(99102,m.component,'Porción individual'),
  p(99103,`Combo ${m.title}`,'Incluye ensalada y bebida de 400ml',[...attributes,...beverages]),
  p(99104,'Gaseosa 400ml','Bebida individual',[{attributeName:'Sabor',options:['Agua',m.drink]}])];
 const finish=async(h:ReturnType<typeof harness>,quantity:number,productId=99103,drink=m.drink)=>{
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(quantity);
  for(const item of items){expect(item.productId).toBe(productId);expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Preparación',attributeValue:m.style});if(productId===99103) expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:drink});}
 };
 for(const quantity of [1,2]) it(`offer before purchase ${m.key}/${agent}/${quantity}`,async()=>{
  const h=harness(menu,agent);
  const text=`Quiero ${quantity===1?'un':'dos'} ${m.title} ${m.style} con bebida ${m.drink}, sin cebolla`;
  const reply=await h.sendQueued(text);
  expect(String(reply)).toContain(`Combo ${m.title}`);
  expect(h.conv.sessionData.cart.some(line=>line.productId===99102||line.productId===99103||line.productId===99104)).toBe(false);
  expect(String(reply)).toMatch(/prefieres|quieres|ofrezco|opci[oó]n|responde|elige/i);
  await h.sendQueued('sí, el combo');
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99103,quantity,note:expect.stringMatching(/sin cebolla/i)});
  expect(h.conv.sessionData.cart[0].attributes).toEqual(expect.arrayContaining([{attributeName:'Preparación',attributeValue:m.style},{attributeName:'Bebida',attributeValue:m.drink}]));
  await finish(h,quantity);
 });
 it(`explicit combo control ${m.key}/${agent}`,async()=>{
  const h=harness(menu,agent);await h.sendQueued(`Quiero dos combos ${m.title} ${m.style} con bebida ${m.drink}, sin cebolla`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99103,quantity:2,note:expect.stringMatching(/sin cebolla/i)});
  await finish(h,2);
 });
 it(`separate beverage control ${m.key}/${agent}`,async()=>{
  const h=harness(menu,agent);await h.sendQueued(`Quiero un ${m.title} ${m.style} y una gaseosa 400ml ${m.drink} aparte`);
  expect(h.conv.sessionData.cart.map(line=>line.productId).sort()).toEqual([99101,99104]);
  expect(h.conv.sessionData.cart.every(line=>line.quantity===1)).toBe(true);
 });
 it(`unavailable combo is not sold ${m.key}/${agent}`,async()=>{
  const h=harness(menu.map(item=>({...item,availableNow:item.id!==99103})),agent);
  h.cfg.ignoreBusinessHours=false;
  await h.sendQueued(`Quiero un ${m.title} ${m.style} con bebida ${m.drink}`);
  expect(h.conv.sessionData.cart.some(line=>line.productId===99103)).toBe(false);
  expect(h.conv.sessionData.pendingMatch?.candidates.some(item=>item.id===99103)).not.toBe(true);
 });
 for (const scenario of ['decline', 'override', 'price', 'stock'] as const) it(`implicit continuation ${m.key}/${agent}/${scenario}`, async()=>{
  const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
  await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida ${m.drink}, sin cebolla`);
  expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine.productId).toBe(99101);
  const before=structuredClone(h.conv.sessionData.cart);
  expect(before).toHaveLength(1);expect(before[0].quantity).toBe(2);
  if(scenario==='price'||scenario==='stock') h.service.catalogService.getMenuProducts.mockResolvedValue(menu.map(item=>item.id===99103?{...item,price:22000,availableNow:scenario!=='stock'}:item));
  const reply=await h.sendQueued(scenario==='decline'?'no gracias':scenario==='override'?'Agua':'sí, el combo');
  if(scenario==='decline') {
   expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingMatch).toBeFalsy();
   expect(reply).toMatch(/sigue igual|como est[aá]/i);await finish(h,2,99101);return;
  }
  if(scenario==='stock') {
   expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/no.*disponible/i);return;
  }
  if(scenario==='price') {
   expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/precio.*cambi/i);
   await h.sendQueued('1');
  }
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99103,quantity:2,note:expect.stringMatching(/sin cebolla/i)});
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:scenario==='override'?'Agua':m.drink});
  await finish(h,2,99103,scenario==='override'?'Agua':m.drink);
 });

}
