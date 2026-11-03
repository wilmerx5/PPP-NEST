import {parsePartialNote} from './whatsapp-partial-note';
import {harness,products} from './whatsapp-accuracy.test-support';
for(const other of [false,true])for(const agent of [false,true])for(const final of [false,true])for(const prior of [false,true])for(const form of ['dos','2','a dos']) {
 it(`partial note keeps options and remaining unit ${other}/${agent}/${final}/${prior}/${form}`,async()=>{
  const menu=other?[{id:98701,code:1,name:'Bowl Campesino',price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Quinoa','Arroz']}]},{id:98702,code:2,name:'Agua Mineral',price:4000,availableNow:true,hasAttributes:false,attributes:[]}]:structuredClone(products);
  const dish=other?menu[0]:menu.find(p=>p.name==='Churrasco');
  const extra=other?menu[1]:menu.find(p=>p.id===50);
  expect(dish).toBeTruthy();expect(extra).toBeTruthy();
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:377,dailyOrderNumber:377});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const attrs=other?[{attributeName:'Base',attributeValue:'Quinoa'}]:[];
  h.conv.sessionData.cart=[{productId:dish.id,code:dish.code,name:dish.name,quantity:3,unitPrice:dish.price,attributes:attrs,note:prior?'Bien caliente':undefined},{productId:extra.id,code:extra.code,name:extra.name,quantity:1,unitPrice:extra.price,attributes:other?[]:[{attributeName:'Sabor',attributeValue:'Mango'}],note:'Bien fría'}];
  const originalExtra=structuredClone(h.conv.sessionData.cart[1]);
  if(final){h.conv.state='awaiting_final_confirm';h.conv.sessionData.paymentMethod='contraentrega';}
  const reply=await h.sendQueued(`${form} de los tres ${dish.name} sin arroz y el otro normal`);
  const cart=h.conv.sessionData.cart;const rows=cart.filter(l=>l.productId===dish.id);
  expect(rows.reduce((s,l)=>s+l.quantity,0)).toBe(3);
  expect(rows.filter(l=>/sin arroz/i.test(l.note||'')).reduce((s,l)=>s+l.quantity,0)).toBe(2);
  expect(rows.filter(l=>!/sin arroz/i.test(l.note||'')).reduce((s,l)=>s+l.quantity,0)).toBe(1);
  expect(rows.every(l=>JSON.stringify(l.attributes)===JSON.stringify(attrs))).toBe(true);
  if(prior)expect(rows.every(l=>/bien caliente/i.test(l.note||''))).toBe(true);
  expect(cart.find(l=>l.productId===extra.id)).toEqual(originalExtra);
  expect(reply).toMatch(/sin arroz/i);
  if(final)expect(h.conv.state).toBe('awaiting_final_confirm');
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);expect(items.filter(i=>i.productId===dish.id&&/sin arroz/i.test(i.note||''))).toHaveLength(2);
 });
}

for(const agent of [false,true])for(const text of ['dos sin arroz y el otro normal','a dos de los cuatro Churrasco sin arroz y el otro normal','a dos de los tres Churrasco sin arroz y los otros dos normales','¿a dos de los tres Churrasco sin arroz y el otro normal?']) {
 it(`ambiguous or inconsistent remainder does not mutate ${agent}/${text}`,async()=>{
  const h=harness(structuredClone(products),agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  const dish=products.find(p=>p.name==='Churrasco');const extra=products.find(p=>p.id===50);
  h.conv.sessionData.cart=[{productId:dish.id,code:dish.code,name:dish.name,quantity:3,unitPrice:dish.price},{productId:extra.id,code:extra.code,name:extra.name,quantity:1,unitPrice:extra.price}];
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual(before);
 });
}
it.each(['agrega a dos de los tres platos sin arroz y el otro normal','a dos platos sin arroz y el otro normal','a cero de los tres platos sin arroz y el otro normal','a dos de los tres platos sin arroz y agrega otro'])('does not expand partial grammar for %s',text=>{
 expect(parsePartialNote(text)).toBeNull();
});
