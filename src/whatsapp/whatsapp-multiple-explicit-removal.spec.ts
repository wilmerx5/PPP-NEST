/** CHAT2510-28: two named removals must apply as one edit, not half a request. */
import {harness} from './whatsapp-accuracy.test-support';
const menus=[
 {a:'Pollo Frito',b:'Combo De Arroz Chino',keep:'Medio Pollo Frito'},
 {a:'Pizza Hawaiana',b:'Combo De Pasta',keep:'Pan De Ajo'},
 {a:'Rollo California',b:'Combo De Ramen',keep:'Sopa Miso'},
];
for(const m of menus)for(const agent of [false,true]){
 const setup=()=>{
  const catalog=[m.a,m.b,m.keep].map((name,i)=>({id:9701+i,code:9701+i,name,price:10000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(catalog as never,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
  Object.assign(h.conv.sessionData,{cart:catalog.map((p,i)=>({productId:p.id,code:p.code,name:p.name,quantity:i===2?2:1,unitPrice:p.price,attributes:[],note:i===2?'Sin salsa':undefined})),phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});return h;
 };
 for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])it(`${m.a}/${agent}/${state}: remove both, preserve other units and close`,async()=>{
  const h=setup();h.conv.state=state;const kept=structuredClone(h.conv.sessionData.cart[2]);
  await h.sendQueued(`elimina el ${m.a} y el ${m.b}`);
  expect(h.conv.sessionData.cart).toEqual([kept]);
  expect(h.conv.state).toBe(state);
  expect(h.replies.at(-1)).toMatch(/retir[eé]|quit[eé]/i);
  expect(h.replies.at(-1)).not.toMatch(/no entend|no pude/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued(`elimina el ${m.a} y el ${m.b}`);expect(h.conv.sessionData.cart).toEqual([kept]);
  await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);
  expect(dto.items.every((p:{productId:number;note?:string})=>p.productId===9703&&p.note==='Sin salsa')).toBe(true);
 });
 it(`${m.a}/${agent}: unknown second target cannot partially remove the first`,async()=>{
  const h=setup();const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`elimina el ${m.a} y el plato inexistente`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cu[aá]l|nombre|aclar/i);
 });
 it(`${m.a}/${agent}: payment link prevents the whole change`,async()=>{
  const h=setup();h.conv.state='awaiting_mp_payment';h.conv.sessionData.mpPreferenceId='synthetic-only';const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`elimina el ${m.a} y el ${m.b}`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/pago/i);
 });
 it(`${m.a}/${agent}: repeated variants need clarification before either removal`,async()=>{
  const h=setup();h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],note:'Sin cebolla'});
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`elimina el ${m.a} y el ${m.b}`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/varias|cu[aá]l/i);
 });
 it(`${m.a}/${agent}: pending selection blocks both removals`,async()=>{
  const h=setup();h.conv.sessionData.pendingMatch={query:'otro',candidates:[],quantity:1,intent:'order'} as never;
  const before=structuredClone(h.conv.sessionData);await h.sendQueued(`elimina el ${m.a} y el ${m.b}`);
  expect(h.conv.sessionData).toEqual(before);expect(h.replies.at(-1)).toMatch(/pendiente/i);
 });
 it(`${m.a}/${agent}: question about removing is not an authorization`,async()=>{
  const h=setup();const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`¿Elimina el ${m.a} y el ${m.b}?`);
  expect(h.conv.sessionData.cart).toEqual(before);
 });

}

for(const agent of [false,true])it(`leading one in a catalog title and conjunction inside another title: ${agent}`,async()=>{
 const names=['1 Pollo Frito','Arroz Con Vegetales Y Hongos','Combo De Pasta'];
 const menu=names.map((name,i)=>({id:9901+i,code:9901+i,name,price:10000,availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.conv.sessionData.cart=menu.map(p=>({productId:p.id,code:p.code,name:p.name,quantity:1,unitPrice:p.price,attributes:[]}));
 await h.sendQueued('elimina el pollo frito y el arroz con vegetales y hongos');
 expect(h.conv.sessionData.cart.map(p=>p.productId)).toEqual([9903]);
});
