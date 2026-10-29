import { harness } from './whatsapp-accuracy.test-support';

// Derived variants of the shared abandoned checkout: name -> payment details -> silence.
for (const dish of ['Bowl Vegetal', 'Pasta Del Huerto', 'Arroz Con Pollo'])
for (const enabled of [false, true]) describe(`Unfinished checkout ${dish} agent=${enabled}`, () => {
  function rig(state = 'awaiting_address') {
    const h = harness([{id:87101,code:87101,name:dish,price:18000,availableNow:true,attributes:[]}], enabled);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.conv.state=state; h.conv.customerName=state==='awaiting_name'?null as never:'Natalia';
    Object.assign(h.conv.sessionData,{cart:[{productId:87101,name:dish,quantity:1,unitPrice:18000,note:'Sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
    h.cfg.localContext={transferInfoNote:'Nequi de pruebas 3000000008'};
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:64,dailyOrderNumber:64});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    return h;
  }
  it.each(['Veci me regalas el nequi porfa','Me pasas tu nequi','A qué número transfiero','Me compartes el número para transferir','Cuál es tu Nequi'])('answers colloquial details without selecting payment: %s',async text=>{
    const h=rig();const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(text);
    expect(reply).toContain('3000000008');expect(reply).toMatch(/dirección/i);
    expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe('awaiting_address');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('handles name plus colloquial inquiry and completes only after explicit confirmation',async()=>{
    const h=rig('awaiting_name');await h.sendQueued('Estefani\nVeci me regalas el nequi porfa',{raw:{coalescedMessages:[{messageId:'n',text:'Estefani'},{messageId:'p',text:'Veci me regalas el nequi porfa'}]}});
    expect(h.conv.customerName).toBe('Estefani');expect(h.replies.join(' ')).toContain('3000000008');expect(h.conv.sessionData.paymentMethod).toBeUndefined();
    await h.sendQueued('Calle 10 #20-30');await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Estefani');expect(dto.items).toHaveLength(1);expect(dto.items[0].note).toBe('Sin cebolla');
  });
  it('keeps the role clarification when answering payment details',async()=>{
    const h=rig('awaiting_name');h.conv.sessionData.pendingRecipientOrPlace='Los Cedros';const before=structuredClone(h.conv.sessionData);
    expect(await h.sendQueued('Me regalas el Nequi')).toContain('3000000008');expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBeNull();
  });
  it('does not invent details when they are absent',async()=>{
    const h=rig();h.cfg.localContext={};const reply=await h.sendQueued('A qué número transfiero');expect(reply).toMatch(/no tengo.*datos/i);expect(reply).not.toContain('3000000008');expect(h.conv.sessionData.paymentMethod).toBeUndefined();
  });
  it.each(['Me regalas un arroz y el nequi','Me pasas tu nequi y agrega una bebida','Pago por Nequi','Mi Nequi es 3000000007'])('does not swallow a mixed request or payment choice: %s',text=>{
    const h=rig();expect(h.service.isMerchantPaymentDetailsQuestion(text)).toBe(false);
  });
});
