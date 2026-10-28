import {harness} from './whatsapp-accuracy.test-support';
const menus=[
 {name:'Bento Oriental',key:'Proteína',a:'Tofu',b:'Tempura',drink:'Agua'},
 {name:'Pasta Primavera',key:'Salsa',a:'Pesto',b:'Pomodoro',drink:'Té Verde'},
 {name:'Wrap Vegetal',key:'Proteína',a:'Tofu',b:'Garbanzos',drink:'Jugo Mora'},
];
for(const m of menus)for(const agent of [false,true]){
 const setup=()=>{
  const p={id:9501,code:51,name:m.name,price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:m.key,options:[m.a,m.b]},{attributeName:'Bebida',options:['Cola',m.drink]}]};
  const h=harness([p],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,cart:[{productId:p.id,code:p.code,name:p.name,quantity:2,unitPrice:p.price,note:'Sin cebolla',attributes:[{attributeName:m.key,attributeValue:m.a},{attributeName:'Bebida',attributeValue:'Cola'}]}]});return h;
 };
 for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])it(`${m.name}/${agent}/${state}: unresolved pair, drink, clarification and DTO`,async()=>{
  const h=setup();h.conv.state=state;const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`un plato que sea ${m.b} y el otro opción desconocida`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingUnitDistribution?.productId).toBe(9501);expect(h.replies.at(-1)).toMatch(/reparto completo/i);
  for(const close of ['no mas','contraentrega','confirmar','sí','listo']){await h.sendQueued(close);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.pendingUnitDistribution).toBeDefined();}
  await h.sendQueued(`Y de tomar ${m.drink} por f`);expect(h.conv.sessionData.cart[0].quantity).toBe(2);expect(h.conv.sessionData.pendingUnitDistribution).toBeDefined();
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:m.drink});
  const drinkCart=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`uno con ${m.b} y el otro opcion desconocida`);expect(h.conv.sessionData.cart).toEqual(drinkCart);expect(h.conv.sessionData.pendingUnitDistribution).toBeDefined();
  await h.sendQueued(`uno con ${m.b} y el otro con ${m.a}`);expect(h.conv.sessionData.pendingUnitDistribution).toBeUndefined();
  expect(h.conv.sessionData.cart.map(p=>p.quantity)).toEqual([1,1]);expect(h.conv.sessionData.cart.map(p=>p.attributes?.find(a=>a.attributeName===m.key)?.attributeValue)).toEqual([m.b,m.a]);
  expect(h.conv.sessionData.cart.every(p=>p.note==='Sin cebolla'&&p.attributes?.some(a=>a.attributeName==='Bebida'&&a.attributeValue===m.drink))).toBe(true);
  await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.every((p:{note?:string})=>p.note==='Sin cebolla')).toBe(true);
 });
 it(`${m.name}/${agent}: removing the disputed product removes the blocker`,async()=>{
  const h=setup();await h.sendQueued(`un plato que sea ${m.b} y el otro opcion desconocida`);await h.sendQueued(`Quita todo el ${m.name}`);
  await h.sendQueued('Hola');expect(h.conv.sessionData.pendingUnitDistribution).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`${m.name}/${agent}: direct tool confirmation cannot bypass unresolved distribution`,async()=>{
  const h=setup();await h.sendQueued(`un plato que sea ${m.b} y el otro opcion desconocida`);
  await h.service.tryConfirmOrder(h.conv,'customer',h.conv.sessionData,{skipFinalConfirm:true});
  expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.pendingUnitDistribution).toBeDefined();expect(h.replies.at(-1)).toMatch(/reparto/i);
 });

 it(`${m.name}/${agent}: complete distribution cannot consume another cart edit`,async()=>{
  const h=setup();await h.sendQueued(`un plato que sea ${m.b} y el otro opcion desconocida`);
  h.conv.sessionData.pendingCartAttributeEdit={sourceText:'cambia la bebida',cartSignature:JSON.stringify(h.conv.sessionData.cart),candidates:[{cartIndex:0,name:m.name}]};
  const before=structuredClone(h.conv.sessionData);await h.sendQueued(`uno con ${m.b} y el otro con ${m.a}`);
  expect(h.conv.sessionData).toEqual(before);expect(h.replies.at(-1)).toMatch(/cu[aá]l|elige|cambio/i);
 });
 it(`${m.name}/${agent}: a partial edit cannot strand the unresolved two-unit plan`,async()=>{
  const h=setup();await h.sendQueued(`un plato que sea ${m.b} y el otro opcion desconocida`);
  const before=structuredClone(h.conv.sessionData);await h.sendQueued(`Cambia una ${m.name} a ${m.b}`);
  expect(h.conv.sessionData).toEqual(before);expect(h.replies.at(-1)).toMatch(/reparto completo/i);
 });

}
