/** Opt-in diagnostics: never count failing cases as green regression coverage. */
import { writeFileSync } from 'fs';
import { harness } from './whatsapp-accuracy.test-support';
const menus = [
 ['Combo De Hamburguesa','Limonada Natural','Porcion De Papa Francesa'],
 ['Bento De Salmon','Te Verde','Porcion De Arroz'],
 ['Pizza Familiar','Agua Mineral','Pan De Ajo'],
];
for (const [menuIndex,names] of menus.entries()) for (const agent of [false,true])
 for (const state of ['building_cart','awaiting_payment']) for (const extrasPresent of [false,true])
 for (const prefix of ['no va','no quiero']) {
 it(`multiple negation ${menuIndex}/${agent}/${state}/${extrasPresent}/${prefix}`,async()=>{
  const menu=names.map((name,i)=>({id:99101+i,code:91+i,name,price:10000+i*1000,availableNow:true,attributes:[]}));
  const h=harness(menu,agent);h.conv.state=state;
  const cart=menu.slice(0,extrasPresent?3:1).map(p=>({productId:p.id,code:p.code,name:p.name,quantity:1,unitPrice:p.price,attributes:[],note:'bien caliente'}));
  Object.assign(h.conv.sessionData,{cart,orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const expected=structuredClone(cart.slice(0,1));
  const text=`${prefix} ${names[1]} ni ${names[2]}`;
  const turns:any[]=[];
  for(let repeat=0;repeat<2;repeat++) {
   await h.sendQueued(text);
   turns.push({cart:structuredClone(h.conv.sessionData.cart),state:h.conv.state,replies:[...h.replies],pendingAttribute:h.conv.sessionData.pendingAttribute});
  }
  writeFileSync(`/tmp/ppp-195-negation-${menuIndex}-${agent}-${state}-${extrasPresent}-${prefix.replace(' ','-')}.json`,JSON.stringify(turns,null,2));
  for(const turn of turns) {
   expect(turn.cart).toEqual(expected);
   expect(turn.state).toBe(state);
   expect(turn.pendingAttribute).toBeFalsy();
   expect(turn.replies.at(-1)).toMatch(/quit|retir|no est|no ten|sin esos|no figuran/i);
   expect(turn.replies.at(-1)).not.toMatch(/agregu[eé]|elige.*sabor/i);
  }
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:99101,note:'bien caliente'})]);
 });
}
for(const [menuIndex,names] of menus.entries()) for(const agent of [false,true]) {
 it(`positive additional purchase control ${menuIndex}/${agent}`,async()=>{
  const menu=names.map((name,i)=>({id:99101+i,code:91+i,name,price:10000+i*1000,availableNow:true,attributes:[]}));
  const h=harness(menu,agent);
  h.conv.sessionData.cart=[{productId:99101,code:91,name:names[0],quantity:1,unitPrice:10000,attributes:[],note:'bien caliente'}];
  await h.sendQueued(`Agrega un ${names[1]} y un ${names[2]}`);
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity]).sort()).toEqual([[99101,1],[99102,1],[99103,1]]);
  expect(h.conv.sessionData.cart[0].note).toBe('bien caliente');
 });
}
