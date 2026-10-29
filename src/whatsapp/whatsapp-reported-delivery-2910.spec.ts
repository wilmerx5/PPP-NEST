import {harness} from './whatsapp-accuracy.test-support';
const menu=[
 {id:98001,code:1,name:'1 Pollo Frito',price:44000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Arepas',options:['Blancas','Fritas']}]},
 {id:98002,code:4,name:'1 Pollo Broaster',price:46000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Arepas',options:['Blancas','Fritas']}]},
 {id:98003,code:8,name:'Porcion De Papa Francesa',price:8000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:98004,code:10,name:'Combo De Pollo Frito',price:53000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Ginger']},{attributeName:'Arepas',options:['Blancas','Fritas']}]},
];
function setup(agent:boolean){
 const h=harness(structuredClone(menu),agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:52,dailyOrderNumber:52});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([{id:52,dailyOrderNumber:52,orderStatus:'cooking'}]);
 h.service.conversationService.reopenForNewOrder=jest.fn().mockImplementation(async()=>{h.conv.state='building_cart';h.conv.sessionData={cart:[],orderType:'delivery'};});
 h.service.deliveryRouting.quoteDeliveryFee=jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.63,lng:-74.15}});
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.6,restaurantLng:-74.1});
 Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 return h;
}
for(const agent of [false,true]){
 for(const address of ['calle 7B de Bogotá, número 78C de casa 79','carrera 12A de Bogotá, número 34B de casa 56','calle 7B, número 78C-79'])
 it(`dictated address retains numbers ${agent} ${address}`,async()=>{
  const h=setup(agent);await h.sendQueued('Quiero un pollo frito');
  await h.sendQueued(`Con una porción de papa a la francesa, por favor, para la ${address}.`);
  const expected=address.includes('12A')?['12','34','56']:['7','78','79'];
  for(const part of expected)expect(h.conv.sessionData.address).toContain(part);
  expect(h.conv.sessionData.cart.map(x=>[x.productId,x.quantity])).toEqual([[98001,1],[98003,1]]);
  expect(h.conv.sessionData.cart[1].note||'').not.toMatch(/con una porcion de/i);
  await h.sendQueued('contraentrega');await h.sendQueued('confirmo');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];for(const part of expected)expect(dto.address).toContain(part);
 });
 for(const address of ['Calle 7b','Carrera 12A de Bogotá','Calle 7B #78C'])it(`incomplete street blocks checkout ${agent} ${address}`,async()=>{
  const h=setup(agent);await h.sendQueued('Un pollo frito');await h.sendQueued('no');await h.sendQueued(address);await h.sendQueued('contraentrega');const reply=await h.sendQueued('confirmo');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.state).not.toBe('completed');expect(h.replies.join('\n')).toMatch(/completa|número|placa|direccion|dirección/i);
 });
 for(const state of ['completed','closed'])for(const address of ['Calle 7b 78c 79','Corrige la dirección a Carrera 12A #34B-56','Apto 302 torre 2','quiero cambiar la dirección','esa no es mi dirección'])it(`post order address does not reopen ${agent} ${state} ${address}`,async()=>{
  const h=setup(agent);h.conv.state=state;h.conv.sessionData.address='Calle 7B';const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued(address);
  expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);
  expect(reply).toMatch(/no.*(?:modifi|aplic|actualiz)|no.*cambi/i);expect(reply).toMatch(/direcci[oó]n|entrega/i);expect(reply).not.toMatch(/qué se te antoja|s[ií], llegamos/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const text of ['Bebida ginger y arepas fritas','arepas fritas y bebida ginger'])it(`two included attributes ${agent} ${text}`,async()=>{
  const h=setup(agent);await h.sendQueued('Un combo de pollo frito');const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:before[0].productId,quantity:1,attributes:expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Ginger'},{attributeName:'Arepas',attributeValue:'Fritas'}])});expect(reply).not.toMatch(/para cu[aá]l/i);
 });
 for(const typo of ['booster','boster'])it(`spoken broaster clarification ${agent} ${typo}`,async()=>{
  const h=setup(agent);const reply=await h.sendQueued(`Gracias, me das un pollo a la ${typo} por favor`);
  expect(h.conv.sessionData.cart).toHaveLength(0);expect(reply).toMatch(/broaster/i);expect(reply).not.toMatch(/Pollo Frito/i);
  expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([98002]);await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:98002,quantity:1})]);
 });
 it(`ETA includes units and avoids remaining-time promise ${agent}`,async()=>{
  const h=setup(agent);h.conv.state='completed';h.cfg.localContext={deliveryTimeNote:'35-45'};const reply=await h.sendQueued('cuánto se demora más o menos');expect(reply).toMatch(/35-45 minutos/);expect(reply).toMatch(/estimad|restante|total/i);
 });
}

for(const agent of [false,true]) {
 for(const fault of ['two owners','two units','unknown second','question','payment','pending'])it(`paired option guards ${agent} ${fault}`,async()=>{
  const h=setup(agent);await h.sendQueued('Un combo de pollo frito');
  if(fault==='two owners')h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[0]),note:'Sin sal'});
  if(fault==='two units')h.conv.sessionData.cart[0].quantity=2;
  if(fault==='payment')h.conv.sessionData.mpPreferenceId='synthetic';
  if(fault==='pending')h.conv.sessionData.pendingMatch={query:'otra',candidates:[menu[0]],quantity:1,intent:'order'};
  const before=structuredClone(h.conv.sessionData.cart);const text=fault==='unknown second'?'Bebida Ginger y arepas desconocidas':fault==='question'?'¿Bebida Ginger y arepas Fritas?':'Bebida Ginger y arepas Fritas';
  await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`legacy greeting without call invitation ${agent}`,async()=>{
  const h=setup(agent);Object.assign(h.cfg,{aiDisclaimerMessage:'Con gusto te atiendo. Aún estoy aprendiendo y a veces cometo errores. Si quieres, también puedes llamarnos al *3118866823*.'});
  await h.sendQueued('Buenas noches');expect(h.replies.join(' ')).not.toMatch(/llamarnos|aprendiendo/);
  expect(h.service.resolveOrderThanksMessage({orderType:'delivery'},'Gracias por pedirnos, que tengas excelente dia :D')).not.toMatch(/excelente d[ií]a/);
 });
 for(const mode of ['fixed','distance'])it(`cached partial street cannot confirm ${agent} ${mode}`,async()=>{
  const h=setup(agent);await h.sendQueued('Un pollo frito');h.conv.state='awaiting_final_confirm';
  Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 7B de Bogotá',addressConfirmed:true,deliveryFeeCalculated:2000,paymentMethod:'cash'});h.cfg.deliveryFeeMode=mode;
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.state).toBe('awaiting_address');expect(h.conv.sessionData.addressConfirmed).toBe(false);
 });
 for(const address of ['calle 7B de Santa Marta, número 78C de casa 79','carrera 12A, número 34B-56, mi teléfono 3001234567'])it(`dictation does not confuse street and contact ${agent} ${address}`,async()=>{
  const h=setup(agent);await h.sendQueued('Un pollo frito');await h.sendQueued('no');await h.sendQueued(address);
  const stored=h.conv.sessionData.address!;expect(stored).toMatch(/78C-79|34B-56/i);expect(stored).not.toContain('3001234567');
 });
}

for(const agent of [false,true])for(const amount of ['medio','cuarto','dos'])it(`typo preserves portion and quantity ${agent} ${amount}`,async()=>{
 const h=setup(agent);h.service.catalogService.getMenuProducts.mockResolvedValue([...structuredClone(menu),{...menu[1],id:98005,code:5,name:'1/2 Pollo Broaster'},{...menu[1],id:98006,code:6,name:'1/4 Pollo Broaster'}]);
 await h.sendQueued(`Me das ${amount} pollo a la booster`);expect(h.conv.sessionData.cart).toHaveLength(0);
 expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([amount==='medio'?98005:amount==='cuarto'?98006:98002]);
 expect(h.conv.sessionData.pendingMatch?.quantity).toBe(amount==='dos'?2:1);
});
for(const name of ['Porcion De Yuca','Porcion De Arroz'])for(const agent of [false,true])it(`synthetic portion and address ${name} ${agent}`,async()=>{
 const h=setup(agent);h.service.catalogService.getMenuProducts.mockResolvedValue([...structuredClone(menu),{id:98009,code:9,name,price:5000,hasAttributes:false,availableNow:true,attributes:[]}]);
 await h.sendQueued('Un pollo frito');await h.sendQueued(`Con una ${name}, por favor, para la carrera 12A de Bogotá, número 34B de casa 56`);
 expect(h.conv.sessionData.cart.map(x=>[x.productId,x.quantity])).toEqual([[98001,1],[98009,1]]);expect(h.conv.sessionData.cart[1].note).toBeFalsy();expect(h.conv.sessionData.address).toContain('34B-56');expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
