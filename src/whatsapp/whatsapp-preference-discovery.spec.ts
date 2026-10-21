import { harness, products } from './whatsapp-accuracy.test-support';
import { splitKitchenPreference } from './whatsapp-kitchen-preference';

for (const enabled of [false,true]) {
 for (const [family,side,first,second] of [
  ['Pollo','papa','Pollo Frito','Pollo Broaster'],
  ['Bowl','quinoa','Bowl Vegetal','Bowl Oriental'],
  ['Pasta','queso','Pasta Del Huerto','Pasta De Hongos'],
 ]) for (const degree of ['arta','harta','bastante']) {
  it(`quantity preference ${family} ${degree} agent=${enabled}`,async()=>{
   const menu=[first,second,`Porcion De ${side}`].map((name,i)=>({id:99801+i,code:99801+i,name,price:15000,availableNow:true,attributes:[]}));
   const h=harness(menu,enabled);
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:998,dailyOrderNumber:98});
   Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
   const reply=await h.sendQueued(`Quiero un ${family} con ${degree} ${side}`);
   expect(reply).not.toMatch(/no encontr|no manejamos|no tenemos|alternativas/i);
   expect(h.conv.sessionData.pendingMatch?.note).toContain(`${degree} ${side}`);
   expect(h.conv.sessionData.cart).toHaveLength(0);
   const selected=h.conv.sessionData.pendingMatch!.candidates[0];
   expect(reply).toContain(`1. ${selected.name}`);
   await h.sendQueued('1');
   expect(h.conv.sessionData.cart).toHaveLength(1);
   expect(h.conv.sessionData.cart[0].productId).toBe(selected.id);
   expect(h.conv.sessionData.cart[0].note).toContain(`${degree} ${side}`);
   expect(h.conv.sessionData.cart[0].quantity).toBe(1);
   await h.sendQueued('no más, recojo en el local');
   if(h.conv.state==='awaiting_payment')await h.sendQueued('1');
   await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.items).toHaveLength(1);
   expect(dto.items[0].note).toContain(`${degree} ${side}`);
  });
 }
 for(const preference of ['picante','dulce','ligero']) for(const occupied of [false,true]){
  it(`discovery ${preference} occupied=${occupied} agent=${enabled}`,async()=>{
   const menu=[{id:99811,code:99811,name:'Bowl Vegetal',categoryName:'Bowls',price:15000,availableNow:true,attributes:[]}];
   const h=harness(menu,enabled);
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
   if(occupied)await h.sendQueued('Quiero un bowl vegetal');
   const before=structuredClone(h.conv.sessionData);
   const reply=await h.sendQueued(`Quiero algo ${preference}`);
   expect(reply).not.toMatch(/no manejamos|no tenemos|no encontr/i);
   expect(reply).toMatch(new RegExp(preference,'i'));
   expect(reply).toMatch(/qué|cuál/i);
   expect(h.conv.sessionData.cart).toEqual(before.cart);
   expect(h.conv.state).toBe('building_cart');
  });
 }
}
it.each(['Quiero un bowl con harta quinoa y dos sopas','Quiero un pollo con harta papa para calle 12 34','Quiero una pasta con bastante queso y una bebida'])('does not swallow another intent %s',text=>expect(splitKitchenPreference(text, true)).toBeNull());

for(const enabled of [false,true])it(`exact reported PPP sequence agent=${enabled}`,async()=>{
 const h=harness(products,enabled);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 const discovery=await h.sendQueued('Quiero algo picante');
 expect(discovery).not.toMatch(/no manejamos|no tenemos/i);
 const reply=await h.sendQueued('Quiero Un Pollo con arta papa');
 expect(reply).not.toMatch(/no encontr|alternativas|no manejamos/i);
 expect(h.conv.sessionData.pendingMatch?.note).toContain('arta papa');
 expect(h.conv.sessionData.cart).toHaveLength(0);
 const first=h.conv.sessionData.pendingMatch!.candidates[0];
 await h.sendQueued('1');
 expect(h.conv.sessionData.cart).toHaveLength(1);
 expect(h.conv.sessionData.cart[0].productId).toBe(first.id);
 expect(h.conv.sessionData.cart[0].note).toContain('arta papa');
});
