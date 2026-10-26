import {harness} from './whatsapp-accuracy.test-support';
import {writeFileSync} from 'fs';
const menus=[
 ['Arroz Chino Con Medio Pollo','un arroz chino con medio pollo',1],
 ['Platano Con Queso Y Bocadillo','dos plátanos con queso y bocadillo',2],
 ['Bowl Con Tofu Y Verduras','dos bowls con tofu y verduras',2],
 ['Sandwich Con Jamon Y Queso','dos sandwiches con jamón y queso',2],
] as const;
for(const [i,[name,phrase,quantity]] of menus.entries()) for(const agent of [false,true]) for(const note of ['', 'sin cebolla']) {
 it(`product name should not repeat in note ${name}/${agent}/${note}`,async()=>{
  const h=harness([{id:99101,code:91,name,price:15000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued(`Me das ${phrase} ${note} por favor`);
  writeFileSync(`/tmp/ppp-197-notes-${i}-${agent}-${note?'note':'plain'}.json`,JSON.stringify({cart:h.conv.sessionData.cart,replies:h.replies}));
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0].quantity).toBe(quantity);
  expect(h.conv.sessionData.cart[0].note||'').toBe(note);
  if(!note)expect(h.replies.at(-1)).not.toMatch(/📝/);
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(quantity);
  expect(dto.items.every((item:any)=>(item.note||'')===note)).toBe(true);
 });
}
for(const agent of [false,true]) for(const [text,code,quantity] of [
 ['Quiero un arroz chino con medio pollo',36,1],
 ['Quiero dos plátanos con queso y bocadillo',53,2],
] as const) {
 it(`real catalogue has no redundant note ${code}/${agent}`,async()=>{
  const h=harness(undefined,agent);await h.sendQueued(text);
  writeFileSync(`/tmp/ppp-197-notes-real-${code}-${agent}.json`,JSON.stringify({cart:h.conv.sessionData.cart,replies:h.replies}));
  if(code===36) { await h.sendQueued('1'); if(h.conv.sessionData.pendingAttribute) await h.sendQueued('Frito'); }
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({code,quantity});
  expect(h.conv.sessionData.cart[0].note||'').toBe('');
  expect(h.replies.at(-1)).not.toMatch(/📝/);
 });
}
