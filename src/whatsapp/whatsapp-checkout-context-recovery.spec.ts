import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Bowl Vegetal', 'Pasta Del Huerto', 'Arroz Con Pollo'])
for (const enabled of [false, true]) describe(`Checkout context recovery ${dish} agent=${enabled}`, () => {
  function rig(state='awaiting_name') {
    const h=harness([{id:87002,code:87002,name:dish,price:18000,availableNow:true,attributes:[]}],enabled);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.conversationService.reopenForNewOrder=jest.fn(async()=>{h.conv.state='building_cart';h.conv.sessionData={cart:[],orderType:'pickup'};});
    h.conv.state=state;h.conv.customerName=null as never;
    Object.assign(h.conv.sessionData,{cart:[{productId:87002,code:87002,name:dish,quantity:1,unitPrice:18000,note:'Sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:62,dailyOrderNumber:62});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    return h;
  }
  it.each(['Voy','Ya voy','Un momento','Ya te digo'])('wait bubble after name: %s',async text=>{
    const h=rig();await h.sendQueued('Natalia');
    expect(h.conv.state).toBe('awaiting_address');const before=structuredClone(h.conv.sessionData);
    const reply=await h.sendQueued(text);
    expect(h.conv.customerName).toBe('Natalia');expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_address');
    expect(reply).toMatch(/espero|cuando/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('Calle 10 #20-30');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Natalia');expect(dto.items[0].note).toBe('Sin cebolla');
  });
  it.each(['es el conjunto','es el barrio'])('resolves ambiguous label as place: %s',async text=>{
    const h=rig('building_cart');await h.sendQueued('Solo eso porfa\nLos Cedros');
    const reply=await h.sendQueued(text);
    expect(h.conv.customerName).toBeNull();expect(h.conv.sessionData.pendingDeliveryPlace).toBe('Los Cedros');expect(reply).toMatch(/nombre/i);
    await h.sendQueued('Natalia');await h.sendQueued('Calle 10 #20-30');await h.sendQueued('contraentrega');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.customerName).toBe('Natalia');expect(JSON.stringify(dto)).toContain('Los Cedros');expect(dto.items[0].note).toBe('Sin cebolla');
  });
  it('resolves ambiguous label as recipient',async()=>{
    const h=rig('building_cart');await h.sendQueued('Solo eso porfa\nLuz Marina');
    await h.sendQueued('es mi nombre');expect(h.conv.customerName).toBe('Luz Marina');expect(h.conv.state).toBe('awaiting_address');
    expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('keeps role unresolved through a payment inquiry and blocks direct confirmation',async()=>{
    const h=rig('building_cart');await h.sendQueued('Solo eso porfa\nLos Cedros');
    h.cfg.localContext={transferInfoNote:'Nequi de pruebas 3000000008'};
    await h.sendQueued('Me indicas el nequi');
    expect(h.replies.at(-1)).toContain('3000000008');expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Los Cedros');
    h.conv.customerName='Nombre de perfil';h.conv.state='awaiting_final_confirm';
    Object.assign(h.conv.sessionData,{address:'Calle 10 #20-30',addressConfirmed:true,paymentMethod:'cash',deliveryFeeCalculated:2000});
    const before=structuredClone(h.conv.sessionData);
    await h.service.tryConfirmOrder(h.conv,'customer',h.conv.sessionData,{skipFinalConfirm:true});
    expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.replies.at(-1)).toMatch(/nombre.*barrio/i);expect(h.conv.sessionData).toEqual(before);
    await h.sendQueued('es el barrio');expect(h.conv.sessionData.pendingRecipientOrPlace).toBeUndefined();expect(h.conv.sessionData.pendingDeliveryPlace).toBe('Los Cedros');
    expect(h.conv.sessionData.address).toBeUndefined();expect(h.conv.sessionData.deliveryFeeCalculated).toBeUndefined();
  });
  it('a fresh explicit name clears the ambiguous label without inventing a place',async()=>{
    const h=rig('building_cart');await h.sendQueued('Solo eso porfa\nLos Cedros');
    await h.sendQueued('me llamo Natalia');expect(h.conv.customerName).toBe('Natalia');
    expect(h.conv.sessionData.pendingRecipientOrPlace).toBeUndefined();expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each(['¿Es el barrio?','sí','confirmar'])('does not guess the role from %s',async text=>{
    const h=rig('building_cart');await h.sendQueued('Solo eso porfa\nLos Cedros');const before=structuredClone(h.conv.sessionData);
    await h.sendQueued(text);expect(h.conv.customerName).toBeNull();expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Los Cedros');
    expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('reset discards the ambiguous role',async()=>{
    const h=rig('building_cart');await h.sendQueued('Solo eso porfa\nLos Cedros');await h.sendQueued('reiniciar');
    expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingRecipientOrPlace).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('waiting does not absorb a pickup request',async()=>{
    const h=rig('awaiting_address');h.conv.customerName='Natalia';await h.sendQueued('lo recojo en el local');
    expect(h.conv.sessionData.orderType).toBe('pickup');expect(h.replies.at(-1)).not.toMatch(/te espero/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('a new explicit dish after completion still opens a new cart',async()=>{
    const h=rig('completed');h.conv.customerName='Natalia';h.conv.sessionData.cart=[];
    await h.sendQueued(`Quiero un ${dish}`);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].productId).toBe(87002);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each(['Con salsas porfa','Me regalas unas servilletas','Me puedes enviar sobres de salsa'])('post-order supplies: %s',async text=>{
    const h=rig('completed');h.conv.sessionData.cart=[];const before=structuredClone(h.conv.sessionData);
    const reply=await h.sendQueued(text);expect(reply).toMatch(/solicitud|cambio/i);expect(reply).toMatch(/ll[aá]ma/i);
    expect(reply).not.toMatch(/anot[eé]|agregu[eé]|listo ✅/i);expect(h.conv.state).toBe('completed');expect(h.conv.sessionData).toEqual(before);
    expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('does not assert an order exists merely because conversation is closed',async()=>{
    const h=rig('closed');h.conv.sessionData.cart=[];const reply=await h.sendQueued('Me envías con salsas también porfa');
    expect(reply).not.toMatch(/pedido ya est[aá] registrado/i);expect(reply).toMatch(/solicitud|cambio/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});
