import { harness, products } from './whatsapp-accuracy.test-support';
const menus = [
  { family:'Ejecutivo Con Pollo', protein:'Pollo', key:'Presa', a:'Pierna Pernil', b:'Ala, pechuga', reference:'pechuga' },
  { family:'Bandeja Con Tofu', protein:'Tofu', key:'Corte', a:'Cubos', b:'Filete', reference:'filete' },
  { family:'Plato Con Pescado', protein:'Pescado', key:'Corte', a:'Centro', b:'Lomo', reference:'lomo' },
];
function setup(m:typeof menus[number],agent:boolean) {
  const attrs=[{attributeName:m.key,options:[m.a,m.b]},{attributeName:'Sopa',options:['Ajiaco','Crema']},{attributeName:'Bebida',options:['Limonada','Cola']}];
  const menu=[{id:9911,code:9911,name:m.family+' Frito',price:24000,hasAttributes:true,availableNow:true,attributes:attrs},{id:9912,code:9912,name:m.family+' Broaster',price:25000,hasAttributes:true,availableNow:true,attributes:attrs},{id:9913,code:9913,name:'1 '+m.protein+' Broaster',price:43000,hasAttributes:false,availableNow:true,attributes:[]}];
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,cart:[m.a,m.b].map(value=>({productId:9911,code:9911,name:menu[0].name,quantity:1,unitPrice:24000,attributes:[{attributeName:m.key,attributeValue:value},{attributeName:'Sopa',attributeValue:'Ajiaco'},{attributeName:'Bebida',attributeValue:'Limonada'}],note:'Limonada bajita de azúcar'}))});return {h,menu};
}
for(const m of menus)for(const agent of [false,true]){
 for(const phrase of [`Cambiame El De ${m.reference} con ${m.protein} broaster`,`El que tiene ${m.b} que ya no sea con ${m.protein} frito sino con ${m.protein} broaster`,`El que tiene ${m.b} que ya no sea con ${m.protein} frito sink con ${m.protein} broaster`])it(`${m.family}/${agent}/${phrase}`,async()=>{
  const {h}=setup(m,agent);const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(phrase);
  expect(h.conv.sessionData.cart).toEqual([before[0],{...before[1],productId:9912,code:9912,name:m.family+' Broaster',unitPrice:25000}]);
  expect(h.conv.state).toBe('building_cart');expect(h.replies.at(-1)).toMatch(/cambi[eé]/i);expect(h.replies.at(-1)).toMatch(/bajita de azúcar/);
  await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map((p:{productId:number})=>p.productId)).toEqual([9911,9912]);expect(dto.items.every((p:{note:string})=>p.note==='Limonada bajita de azúcar')).toBe(true);
 });
 it(`${m.family}/${agent}: reject the accidental whole product, preserve both meals`,async()=>{
  const {h,menu}=setup(m,agent);const before=structuredClone(h.conv.sessionData.cart);const p=menu[2];h.conv.sessionData.cart.push({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,attributes:[]});
  await h.sendQueued(`No no quiero Un ${m.protein} quitalo`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/quit[eé]|retir[eé]/i);expect(h.conv.sessionData.pendingMatch).toBeUndefined();
 });
}
for(const agent of [false,true])it(`reported PPP cart through correction ${agent}`,async()=>{
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 const p=products.find((p:any)=>p.id===22);
 h.conv.sessionData.cart=['Pierna Pernil','Ala, pechuga'].map(value=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1,note:'Limonada bajita de azúcar',attributes:[{attributeName:'Presa',attributeValue:value},{attributeName:'Sopa',attributeValue:'Ajiaco'},{attributeName:'Bebida',attributeValue:'Limonada'}]}));
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Cambiame El De pechuga con Pollo broaster');
 expect(h.conv.sessionData.cart).toEqual([before[0],{...before[1],productId:18,code:18,name:'Ejecutivo Con Pollo Broaster',unitPrice:25000}]);expect(h.replies.at(-1)).toMatch(/cambi[eé]/i);
});
for(const m of menus)for(const agent of [false,true]){
 for(const scenario of ['ambiguous owner','unknown owner','multiple units','payment','pending choice','unavailable style','incompatible option','duplicate target','wrong previous style','question'])it(`${m.family}/${agent}: ${scenario} preserves the entire cart`,async()=>{
  const {h,menu}=setup(m,agent);let request=`Cambiame el de ${m.reference} con ${m.protein} broaster`;
  if(scenario==='ambiguous owner')h.conv.sessionData.cart.push({...h.conv.sessionData.cart[1],note:'Sin sal'});
  if(scenario==='unknown owner')request=`Cambiame el de opcion inexistente con ${m.protein} broaster`;
  if(scenario==='multiple units')h.conv.sessionData.cart[1].quantity=2;
  if(scenario==='payment'){h.conv.state='awaiting_mp_payment';h.conv.sessionData.mpPreferenceId='synthetic-only';}
  if(scenario==='pending choice')h.conv.sessionData.pendingMatch={query:'otro',quantity:1,candidates:[menu[2]],intent:'order'};
  if(scenario==='unavailable style')menu[1].availableNow=false;
  if(scenario==='incompatible option')menu[1].attributes=[{attributeName:m.key,options:[m.a]},...menu[1].attributes.slice(1)];
  if(scenario==='duplicate target')menu.push({...menu[1],id:9914,code:9914});
  if(scenario==='wrong previous style')request=`El que tiene ${m.b} que ya no sea con ${m.protein} asado sino con ${m.protein} broaster`;
  if(scenario==='question')request=`¿${request}?`;
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(request);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(scenario!=='question')expect(h.replies.at(-1)).toMatch(/igual|pendiente/i);
 });
 it(`${m.family}/${agent}: recover the accidental product and change only the identified meal`,async()=>{
  const {h,menu}=setup(m,agent);const before=structuredClone(h.conv.sessionData.cart);const p=menu[2];h.conv.sessionData.cart.push({productId:p.id,code:p.code,name:p.name,quantity:1,unitPrice:p.price,attributes:[]});
  await h.sendQueued(`No no quiero un ${m.protein} quitalo`);expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued(`Quiero cambiar un ${m.family}`);expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cuál/i);
  await h.sendQueued(`El que tiene ${m.b} que ya no sea con ${m.protein} frito sink con ${m.protein} broaster`);
  expect(h.conv.sessionData.cart).toEqual([before[0],{...before[1],productId:9912,code:9912,name:m.family+' Broaster',unitPrice:25000}]);
  await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items.map((i:{productId:number})=>i.productId)).toEqual([9911,9912]);
 });
 it(`${m.family}/${agent}: a negated removal of an unknown item never adds it`,async()=>{
  const {h}=setup(m,agent);const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('No no quiero un plato inexistente quitalo');expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/no encontré/i);
 });
}
