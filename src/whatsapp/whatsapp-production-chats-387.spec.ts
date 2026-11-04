import {harness,products} from './whatsapp-accuracy.test-support';
function setup(agent=true){
 const menu=structuredClone(products);for(const [id,price] of [[4,46000],[98,55000],[2,25000]]){const p=menu.find(p=>p.id===id);if(p)p.price=price;}
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Algo más?',actions:{}});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.ordersService.create=jest.fn().mockResolvedValue({id:387,dailyOrderNumber:387});
 return {h,menu};
}
for(const agent of [false,true]){
 it(`explicit combo with quoted price ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('Un pollo en combo Broaster de 55');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:98,quantity:1,unitPrice:55000})]);});
 it(`offer acceptance with choice consumes offer ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('Que vale medio pollo frito con gaseosa?');await h.sendQueued('Si Arepas fritas');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:2,quantity:1,attributes:expect.arrayContaining([{attributeName:'Arepas',attributeValue:'Fritas'}])})]);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();});
 it(`explicit drink query ignores chicken focus ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('un medio pollo frito');const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Que vale la gaseosa litro ?');expect(reply).toMatch(/gaseosa/i);expect(reply).not.toMatch(/1\/2 Pollo Frito:|Sigue pendiente agregar.*Pollo/i);expect(h.conv.sessionData.cart).toEqual(before);});
 for(const words of ['Por favor','porfa','Por Fis'])it(`courtesy cannot execute purchase ${agent}/${words}`,async()=>{const {h}=setup(agent);await h.sendQueued('un medio pollo frito');const before=structuredClone(h.conv.sessionData.cart);h.agent.runTurn.mockResolvedValue({reply:'Listo ×2',actions:{addItems:[{productId:2,quantity:1}]},toolCalls:['add_item']});h.service.aiService.generateTurn.mockResolvedValue({reply:'Listo ×2',actions:{addItems:[{productId:2,quantity:1}]}});await h.sendQueued(words);expect(h.conv.sessionData.cart).toEqual(before);});
 for(const words of ['Que tiempo demora','Ya mas de una hora','Solo pregunto si se demoran'])it(`draft ETA discloses missing confirmation ${agent}/${words}`,async()=>{const {h}=setup(agent);await h.sendQueued('un medio pollo frito');Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Conjunto de prueba',deliveryFeeCalculated:null,addressConfirmed:false});const reply=await h.sendQueued(words);expect(reply).toMatch(/aún no|todav[ií]a no/i);expect(reply).toMatch(/ubicaci[oó]n|direcci[oó]n/i);expect(reply).not.toMatch(/algo m[aá]s|necesito.*n[uú]mero de orden/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();});
 it(`stale offer from prior visit cannot resurface ${agent}`,async()=>{const {h}=setup(agent);h.conv.sessionData.pendingAddOffer={productId:36,name:'Arroz Chino Con Medio Pollo',price:48000,code:36,quantity:1,sourceText:'Y medio que vale'};(h.conv as any).lastInboundAt=new Date('2026-09-04T19:00:00Z');await h.sendQueued('Buenas tardes');expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();});
}

for (const agent of [false,true]) {
 it(`real quoted sequence stays single through courtesy and DTO ${agent}`,async()=>{
  const {h}=setup(agent);
  await h.sendQueued('Que vale medio pollo frito con gaseosa?');
  const accepted=await h.sendQueued('Si Arepas fritas'); expect(accepted).not.toMatch(/Sigue pendiente agregar/);
  h.agent.runTurn.mockResolvedValue({reply:'Listo ×2',actions:{addItems:[{productId:2,quantity:1}]},toolCalls:['add_item']});
  await h.sendQueued('Por favor');expect(h.conv.sessionData.cart[0].quantity).toBe(1);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
  h.agent.runTurn.mockResolvedValue({reply:'¿Cuál prefieres?',actions:{},toolCalls:[]});
  await h.sendQueued('Que vale la gaseosa litro ?');
  const before=structuredClone(h.conv.sessionData.cart); const prices=await h.sendQueued('1');expect(prices).toMatch(/Gaseosa/);expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('no más'); await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
 });
 it(`declining an old offer cannot become a name ${agent}`,async()=>{
  const {h}=setup(agent);await h.sendQueued('medio pollo frito');h.conv.state='awaiting_name';h.conv.customerName='';
  h.conv.sessionData.pendingAddOffer={productId:2,name:'1/2 Pollo Frito',code:2,price:25000,quantity:1};
  const reply=await h.sendQueued('No');expect(reply).toMatch(/nombre/i);expect(reply).not.toMatch(/nombre real|Sigue pendiente agregar|algo más/i);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();expect(h.conv.customerName).toBe('');
 });
 it(`expired dated offer preserves cart ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('medio pollo frito');const before=structuredClone(h.conv.sessionData.cart);h.conv.sessionData.pendingAddOffer={productId:36,name:'Arroz',code:36,price:48000,quantity:1,createdAt:Date.now()-31*60000};await h.sendQueued('Hola');expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before);});
 it(`pay versus cancel remains clarification ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('medio pollo frito');h.conv.sessionData.paymentMethod='transfer';const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Se puede cancelar antes de enviar el pedido?');expect(reply).toMatch(/pagar.*anular/);expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('Quiero cancelar el pedido');expect(h.conv.sessionData.cart).toHaveLength(0);});
 it(`generic combo rewrite uses another catalog ${agent}`,async()=>{
  const menu=structuredClone(products);menu.push({...menu.find(p=>p.id===98)!,id:9998,name:'Combo De Hamburguesa Asada',price:17000});
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Algo más?',actions:{}});
  await h.sendQueued('Una hamburguesa en combo asada de 17');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:9998,quantity:1,unitPrice:17000})]);
 });
}
for(const agent of [false,true]) {
 it(`quantity-only price continuation keeps chicken family ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('Quisiera un cuarto de pollo que vale');const reply=await h.sendQueued('Y medio que vale');expect(reply).not.toMatch(/Arroz Chino/);expect(h.conv.sessionData.cart).toHaveLength(0);expect(reply).toMatch(/1\/2|medio/i);});
 it(`ETA then no keeps unresolved address visible ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('medio pollo frito');Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Conjunto de prueba',deliveryFeeCalculated:null,addressConfirmed:false});await h.sendQueued('Que tiempo demora');const reply=await h.sendQueued('No es más gracias');expect(reply).toMatch(/ubicaci[oó]n|direcci[oó]n/i);expect(reply).not.toMatch(/35-45|algo m[aá]s/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();});
}
for(const agent of [false,true]) {
 it(`registered order wins over an unresolved draft ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('medio pollo frito');Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Conjunto de prueba',deliveryFeeCalculated:null,addressConfirmed:false});h.service.ordersService.findTodayOrdersByPhone.mockResolvedValue([{id:71,dailyOrderNumber:71,orderStatus:'cooking'}]);const reply=await h.sendQueued('Que tiempo demora');expect(reply).toContain('#71');expect(reply).not.toMatch(/todav[ií]a no/);expect(h.service.ordersService.create).not.toHaveBeenCalled();});
 it(`acceptance and courtesy in one message ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('Que vale medio pollo frito con gaseosa?');await h.sendQueued('Si Arepas fritas\nPor favor');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:2,quantity:1})]);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();});
}

for(const agent of [false,true])it(`unresolved address does not block explicit cancellation ${agent}`,async()=>{const {h}=setup(agent);await h.sendQueued('medio pollo frito');Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Conjunto de prueba',deliveryFeeCalculated:null,addressConfirmed:false});const reply=await h.sendQueued('Quiero cancelar el pedido');expect(h.conv.sessionData.cart).toHaveLength(0);expect(reply).toMatch(/cancelad/i);});
