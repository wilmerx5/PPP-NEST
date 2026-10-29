import { harness } from './whatsapp-accuracy.test-support';

// Pattern sources and boundaries: docs/whatsapp-batch-280-patterns.md.
// Each state changes the information at risk, rather than merely paraphrasing a greeting.
const menus = [['Bowl de garbanzos', 'Agua mineral'], ['Ravioles de ricota', 'Té frío']];
const stages = [
  ['awaiting_name', /nombre/i], ['awaiting_address', /direcci[oó]n/i],
  ['awaiting_phone', /tel[eé]fono/i], ['awaiting_payment', /pago|pagas|pagar/i],
  ['awaiting_final_confirm', /confirmar/i],
] as const;
function setup(names: string[], agent: boolean, state: string) {
  const menu = names.map((name, i) => ({id: 89501+i, code:89501+i, name,
    price:i ? 4000 : 18000, availableNow:true, attributes:[]}));
  const h=harness(menu, agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn();
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.conv.state=state; h.conv.customerName=state==='awaiting_name' ? null as never : 'Cliente Prueba';
  Object.assign(h.conv.sessionData, {
    cart:menu.map((p,i)=>({productId:p.id, code:p.code, name:p.name, quantity:i?1:2, unitPrice:p.price, note:i?'sin hielo':'salsa aparte'})),
    orderType:'delivery', fulfillmentChosen:true, phoneConfirmed:state!=='awaiting_phone',
    contactPhone:h.conv.phoneE164, notesCollected:true,
    ...(state!=='awaiting_name' && state!=='awaiting_address' ? {address:'Calle 10 #20-30',addressConfirmed:true,deliveryFeeCalculated:2000} : {}),
    ...(state==='awaiting_final_confirm' ? {paymentMethod:'cash'} : {}),
  });
  return h;
}
for(const names of menus) for(const agent of [false,true]) {
  for(const [state,reminder] of stages) {
    it.each(['espera un momento','un momentito porfa','ya te confirmo','déjame revisar'])(
      `wait ${names[0]} agent=${agent} ${state}: %s`,async text=>{
        const h=setup(names,agent,state), before=structuredClone(h.conv.sessionData), name=h.conv.customerName;
        const reply=await h.sendQueued(text);
        expect(h.conv.sessionData).toEqual(before); expect(h.conv.customerName).toBe(name);
        expect(h.conv.state).toBe(state); expect(reply).toMatch(/espero|cuando.*listo/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    it.each(['me repites porfa','no entendí bien','qué me habías preguntado','puedes repetir la pregunta'])(
      `repeat ${names[0]} agent=${agent} ${state}: %s`,async text=>{
        const h=setup(names,agent,state), before=structuredClone(h.conv.sessionData), name=h.conv.customerName;
        const reply=await h.sendQueued(text);
        expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe(name);expect(h.conv.state).toBe(state);
        expect(reply).toContain(names[0]);expect(reply).toMatch(/salsa aparte/i);expect(reply).toMatch(reminder);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    it.each(['veci cuánto sería','cuánto queda todo','cuánto sería en total','cuánto es todo el pedido'])(
      `total ${names[0]} agent=${agent} ${state}: %s`,async text=>{
        const h=setup(names,agent,state), before=structuredClone(h.conv.sessionData), name=h.conv.customerName;
        const reply=await h.sendQueued(text);
        expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.sessionData.address).toBe(before.address);
        expect(h.conv.customerName).toBe(name);expect(h.conv.state).toBe(state);
        expect(h.conv.sessionData.paymentMethod).toBe(before.paymentMethod);
        expect(reply).toMatch(before.deliveryFeeCalculated ? /42[.,]000/ : /40[.,]000/);
        expect(reply).toMatch(reminder);expect(reply).not.toMatch(/cuál producto|direcci[oó]n anotada/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
  }
}

for(const names of menus)for(const agent of [false,true])for(const interruption of ['espera un momento','no entendí bien','cuánto queda todo']) {
 it(`resumes to one explicit order after ${interruption} ${names[0]} agent=${agent}`,async()=>{
  const h=setup(names,agent,'awaiting_final_confirm');
  h.service.ordersService.create.mockResolvedValue({id:88,dailyOrderNumber:88});
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(interruption);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.state).toBe('awaiting_final_confirm');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  // The order DTO expands cart quantities into individual kitchen units.
  expect(dto.items.map((item:any)=>({productId:item.productId,note:item.note}))).toEqual(
    before.flatMap(item=>Array.from({length:item.quantity},()=>({productId:item.productId,note:item.note}))));
  expect(dto.customerName).toBe('Cliente Prueba');
 });
}
