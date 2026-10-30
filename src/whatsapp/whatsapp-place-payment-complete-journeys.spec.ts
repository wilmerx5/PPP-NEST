import { harness } from './whatsapp-accuracy.test-support';

// Based on the user-supplied name/place/Nequi chats. Successful continuations,
// identities, address, quote and alternate catalog are synthetic development data.
for (const dish of ['Arroz Con Pollo', 'Bowl Vegetal'])
for (const agent of [false,true]) describe(`place/payment journey ${dish}, agent mock=${agent}`,()=>{
  function start() {
    const h=harness([{id:94160,code:160,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
    h.conv.customerName='';
    Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:315,dailyOrderNumber:315});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    h.cfg.localContext={transferInfoNote:'Nequi de pruebas 3000000008'};
    Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
    h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerAddress}:{customerAddress:string})=>customerAddress.includes('20-30')
      ?{ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.64,lng:-74.14}}
      :{ok:false,reason:'address_ambiguous',message:'No pude ubicarla. Comparte calle y número.'})};
    return h;
  }
  async function order(h:ReturnType<typeof start>) {
    expect(h.conv.sessionData.cart).toEqual([]);
    await h.sendQueued('Buenas tardes');
    await h.sendQueued(`Veci me envías un ${dish}`);
    await h.sendQueued('a la primera ponle como nota sobres de salsa de tomate aparte');
    expect(h.conv.sessionData.cart).toHaveLength(1);
    expect(h.conv.sessionData.cart[0]).toMatchObject({productId:94160,quantity:1,note:expect.stringMatching(/salsa.*tomate/i)});
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }
  async function paymentInquiry(h:ReturnType<typeof start>) {
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued('Me indicas el nequi');
    expect(reply).toContain('3000000008');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }
  async function complete(h:ReturnType<typeof start>,name='Camila Rojas',place?:string) {
    await h.sendQueued('Calle 10 #20-30');
    expect(h.conv.sessionData.addressConfirmed).toBe(true);
    expect(h.conv.sessionData.address).toContain('20-30');
    await h.sendQueued('Por nequi');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.replies.at(-1)).toMatch(/confirmar/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const receipt=await h.sendQueued('Confirmo');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.customerName).toBe(name);
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toMatchObject({productId:94160,note:expect.stringMatching(/salsa.*tomate/i)});
    expect(JSON.stringify(dto)).toContain('20-30');
    if(place) expect(JSON.stringify(dto)).toContain(place);
    expect(receipt).toMatch(/315/);expect(receipt).toContain(dish);expect(receipt).toMatch(/20\.000/);
    expect(h.conv.state).toBe('completed');
  }
  it('place-role clarification survives payment inquiry, repeated question and wait bubble',async()=>{
    const h=start();await order(h);
    await h.sendQueued('Solo eso porfa\nLos Cedros');
    expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Los Cedros');
    expect(h.conv.customerName).toBe('');
    await paymentInquiry(h);
    const reply=await h.sendQueued('¿Es el barrio?');
    expect(reply).toMatch(/nombre|barrio/i);
    expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Los Cedros');
    await h.sendQueued('es el barrio');
    expect(h.conv.sessionData.pendingDeliveryPlace).toBe('Los Cedros');
    expect(h.conv.customerName).toBe('');
    await h.sendQueued('Camila Rojas');
    await h.sendQueued('Voy');
    expect(h.conv.customerName).toBe('Camila Rojas');
    expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
    await complete(h,'Camila Rojas','Los Cedros');
  });
  it('an ambiguous label can be a recipient; never invents a neighborhood',async()=>{
    const h=start();await order(h);
    await h.sendQueued('Solo eso porfa\nLuz Marina');
    expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Luz Marina');
    await paymentInquiry(h);
    await h.sendQueued('es mi nombre');
    expect(h.conv.customerName).toBe('Luz Marina');
    expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();
    expect(h.conv.state).toBe('awaiting_address');
    await complete(h,'Luz Marina');
    expect(JSON.stringify(h.service.ordersService.create.mock.calls[0][0])).not.toContain('Los Cedros');
  });
  it('a new explicit recipient resolves role without guessing the discarded label',async()=>{
    const h=start();await order(h);
    await h.sendQueued('Solo eso porfa\nLos Cedros');
    await paymentInquiry(h);
    await h.sendQueued('me llamo Camila Rojas');
    expect(h.conv.customerName).toBe('Camila Rojas');
    expect(h.conv.sessionData.pendingRecipientOrPlace).toBeUndefined();
    expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();
    await complete(h);
    expect(JSON.stringify(h.service.ordersService.create.mock.calls[0][0])).not.toContain('Los Cedros');
  });
  it('an unresolved delivery place is followed by a name, wait and payment inquiry',async()=>{
    const h=start();await order(h);
    await h.sendQueued('Así veci');
    expect(h.conv.state).toBe('awaiting_name');
    await h.sendQueued('Envíalo a Conjunto Los Pinos');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('Mi nombre es Camila Rojas');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.conv.state).not.toBe('awaiting_final_confirm');
    await h.sendQueued('Un momento');
    expect(h.conv.customerName).toBe('Camila Rojas');
    await paymentInquiry(h);
    await complete(h);
  });
  it('confirmation cannot bypass an unresolved role, then clarification recovers',async()=>{
    const h=start();await order(h);
    await h.sendQueued('Solo eso porfa\nLos Cedros');
    for(const text of ['sí','confirmar']) {
      await h.sendQueued(text);
      expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Los Cedros');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.customerName).toBe('');
    }
    await h.sendQueued('es el conjunto');await h.sendQueued('Camila Rojas');
    await complete(h,'Camila Rojas','Los Cedros');
  });
  it('reset retires the unresolved role and the next purchase completes cleanly',async()=>{
    const h=start();await order(h);
    await h.sendQueued('Solo eso porfa\nLos Cedros');await paymentInquiry(h);
    await h.sendQueued('reiniciar');
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingRecipientOrPlace).toBeUndefined();
    expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();
    await order(h);await h.sendQueued('Solo eso porfa');
    await h.sendQueued('Camila Rojas');
    await h.sendQueued('para domicilio');
    await complete(h);
    expect(JSON.stringify(h.service.ordersService.create.mock.calls[0][0])).not.toContain('Los Cedros');
  });
});
