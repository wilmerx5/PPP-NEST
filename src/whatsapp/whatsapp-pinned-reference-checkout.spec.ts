import { harness } from './whatsapp-accuracy.test-support';
const pin = 'Ubicación compartida — https://maps.google.com/?q=4.62,-74.14';
function setup(dish: string, agent: boolean, state: string) {
  const h = harness([{id:98701,code:87,name:dish,price:23000,availableNow:true,attributes:[]}], agent);
  h.conv.state = state;
  Object.assign(h.conv.sessionData, {
    cart:[{productId:98701,code:87,name:dish,quantity:2,unitPrice:23000,attributes:[],note:'sin cebolla'}],
    orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,
    address:pin,addressConfirmed:true,deliveryLat:4.62,deliveryLng:-74.14,deliveryFeeCalculated:5000,
    ...(state==='awaiting_final_confirm'?{paymentMethod:'contraentrega'}:{}),
  });
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  return h;
}
for (const dish of ['Bowl Vegetal','Pizza De Hongos','Ramen De Miso'])
for (const agent of [false,true])
for (const state of ['awaiting_payment','awaiting_final_confirm'])
for (const request of [false,true]) {
  it(`${dish}: pin reference + repeat + DTO, ${agent}/${state}/${request}`,async()=>{
    const h=setup(dish,agent,state);
    const cart=structuredClone(h.conv.sessionData.cart);
    if(request) {
      await h.sendQueued('Puedes poner en la direcciones esta porfa');
      expect(h.replies.at(-1)).toMatch(/cuál.*referencia/);
      expect(h.conv.state).toBe(state);
    }
    const reference=request?'Terraza Aurora 1972':'Hotel Aurora 1972';
    await h.sendQueued(reference);
    expect(h.conv.sessionData.address).toBe(`${pin} — ${reference}`);
    expect(h.conv.sessionData.deliveryFeeCalculated).toBe(5000);
    expect(h.conv.sessionData.deliveryLat).toBe(4.62);
    expect(h.conv.sessionData.deliveryLng).toBe(-74.14);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.state).toBe(state);
    expect(h.replies.at(-1)).toMatch(/pagas|confirmar/);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('Puedes poner en la direcciones esta porfa');
    await h.sendQueued(reference);
    expect(h.conv.sessionData.address).toBe(`${pin} — ${reference}`);
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.address).toContain(pin);
    expect(dto.address).toContain(reference);
    expect(dto.deliveryFee).toBe(5000);
    expect(dto.items).toEqual(Array.from({length:2},()=>expect.objectContaining({productId:98701,note:'sin cebolla'})));
  });
}
for (const agent of [false,true]) {
  for (const interruption of ['¿Cuánto es el total?', 'contraentrega', 'Me llamo Laura García', '3001234567']) {
    it(`reference waiting permits interruption ${agent}: ${interruption}`,async()=>{
      const h=setup('Bowl Vegetal',agent,'awaiting_payment');
      await h.sendQueued('Puedes poner en la direcciones esta porfa');
      await h.sendQueued(interruption);
      expect(h.conv.sessionData.address).toBe(pin);
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(5000);
      await h.sendQueued('Terraza Aurora 1972');
      expect(h.conv.sessionData.address).toBe(`${pin} — Terraza Aurora 1972`);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
  it(`reference request does not capture a replacement street ${agent}`,async()=>{
    const h=setup('Ramen De Miso',agent,'awaiting_payment');
    await h.sendQueued('Puedes poner en la direcciones esta porfa');
    await h.sendQueued('Calle 12 #34-56');
    expect(h.conv.sessionData.address).toContain('34-56');
    expect(h.conv.sessionData.address).not.toContain('maps.google.com');
    expect(h.conv.sessionData.deliveryLat).not.toBe(4.62);
  });
  it(`reference request does not prevent reset ${agent}`,async()=>{
    const h=setup('Pizza De Hongos',agent,'awaiting_final_confirm');
    await h.sendQueued('Puedes poner en la direcciones esta porfa');
    await h.sendQueued('reiniciar');
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingDeliveryReferenceAddress).toBeUndefined();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
for (const dish of ['Bowl Vegetal','Pizza De Hongos','Ramen De Miso'])
for (const agent of [false,true]) {
  it(`${dish}: place before name survives street completion and DTO ${agent}`,async()=>{
    const h=setup(dish,agent,'awaiting_name');
    h.conv.customerName=null as any;
    Object.assign(h.conv.sessionData,{address:undefined,addressConfirmed:false,deliveryLat:null,deliveryLng:null,deliveryFeeCalculated:undefined});
    await h.sendQueued('Para la portería nuevo sol');
    expect(h.replies.at(-1)).toMatch(/Anoté.*dirección/);
    expect(h.replies.at(-1)).toMatch(/nombre/);
    await h.sendQueued('Laura García');
    await h.sendQueued('Calle 12 #34-56');
    expect(h.conv.sessionData.address).toMatch(/nuevo sol/i);
    expect(h.conv.customerName).toBe('Laura García');
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.address).toMatch(/nuevo sol/i);
    expect(dto.address).toContain('34-56');
    expect(dto.customerName).toBe('Laura García');
    expect(dto.items).toHaveLength(2);
  });
}
