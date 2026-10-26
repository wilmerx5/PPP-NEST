import { harness } from './whatsapp-accuracy.test-support';
import { writeFileSync } from 'fs';
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
 const snapshot=(h:ReturnType<typeof harness>,key:string)=>writeFileSync(`/tmp/ppp-205-${m.key}-${agent}-${key}.json`,JSON.stringify({cart:h.conv.sessionData.cart,state:h.conv.state,replies:h.replies,pendingMatch:h.conv.sessionData.pendingMatch,pendingAttribute:h.conv.sessionData.pendingAttribute},null,2));
 const finish=async(h:ReturnType<typeof harness>,quantity:number)=>{
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(quantity);
  for(const item of items){expect(item.productId).toBe(99103);expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:m.drink});}
 };
 for(const quantity of [1,2]) it(`offer before purchase ${m.key}/${agent}/${quantity}`,async()=>{
  const h=harness(menu,agent);
  const text=`Quiero ${quantity===1?'un':'dos'} ${m.title} ${m.style} con bebida ${m.drink}, sin cebolla`;
  const reply=await h.sendQueued(text);snapshot(h,`offer-${quantity}`);
  expect(String(reply)).toContain(`Combo ${m.title}`);
  expect(h.conv.sessionData.cart.some(line=>line.productId===99102||line.productId===99103||line.productId===99104)).toBe(false);
  expect(String(reply)).toMatch(/prefieres|quieres|ofrezco|opci[oó]n|responde|elige/i);
  await h.sendQueued('sí, el combo');snapshot(h,`accepted-${quantity}`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99103,quantity,note:expect.stringMatching(/sin cebolla/i)});
  expect(h.conv.sessionData.cart[0].attributes).toEqual(expect.arrayContaining([{attributeName:'Preparación',attributeValue:m.style},{attributeName:'Bebida',attributeValue:m.drink}]));
  await finish(h,quantity);
 });
 it(`explicit combo control ${m.key}/${agent}`,async()=>{
  const h=harness(menu,agent);await h.sendQueued(`Quiero dos combos ${m.title} ${m.style} con bebida ${m.drink}, sin cebolla`);snapshot(h,'explicit');
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99103,quantity:2,note:expect.stringMatching(/sin cebolla/i)});
  await finish(h,2);
 });
 it(`separate beverage control ${m.key}/${agent}`,async()=>{
  const h=harness(menu,agent);await h.sendQueued(`Quiero un ${m.title} ${m.style} y una gaseosa 400ml ${m.drink} aparte`);snapshot(h,'separate');
  expect(h.conv.sessionData.cart.map(line=>line.productId).sort()).toEqual([99101,99104]);
  expect(h.conv.sessionData.cart.every(line=>line.quantity===1)).toBe(true);
 });
 it(`unavailable combo is not sold ${m.key}/${agent}`,async()=>{
  const h=harness(menu.map(item=>({...item,availableNow:item.id!==99103})),agent);
  h.cfg.ignoreBusinessHours=false;
  await h.sendQueued(`Quiero un ${m.title} ${m.style} con bebida ${m.drink}`);snapshot(h,'unavailable');
  expect(h.conv.sessionData.cart.some(line=>line.productId===99103)).toBe(false);
  expect(h.conv.sessionData.pendingMatch?.candidates.some(item=>item.id===99103)).not.toBe(true);
 });
}
