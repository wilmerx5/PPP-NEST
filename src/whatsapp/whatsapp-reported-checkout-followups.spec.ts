import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Bowl Vegetal', 'Pasta Del Huerto', 'Arroz Con Pollo'])
for (const enabled of [false, true]) describe(`Reported checkout followups ${dish} agent=${enabled}`, () => {
  function rig(state = 'awaiting_address') {
    const h = harness([{id: 87001, code: 87001, name: dish, price: 18000, availableNow: true, attributes: []}], enabled);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.conversationService.reopenForNewOrder = jest.fn(async () => { h.conv.state='building_cart'; h.conv.sessionData={cart:[],orderType:'pickup'}; });
    h.conv.state = state;
    h.conv.customerName = 'Natalia';
    Object.assign(h.conv.sessionData, {cart: [{productId:87001, name:dish, quantity:1, unitPrice:18000}], orderType:'delivery', fulfillmentChosen:true, phoneConfirmed:true, contactPhone:h.conv.phoneE164, notesCollected:true});
    h.cfg.localContext = {transferInfoNote:'Nequi de pruebas 3000000008', deliveryTimeNote:'35-45'};
    h.service.ordersService.create = jest.fn();
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([{id:60, dailyOrderNumber:60, orderStatus:'cooking'}]);
    return h;
  }
  it.each(['Me indicas el nequi','Me indica el número de Nequi','Me puedes indicar la cuenta de Nequi'])('answers %s and resumes address', async text => {
    const h=rig(); const before=structuredClone(h.conv.sessionData);
    const reply=await h.sendQueued(text);
    expect(reply).toContain('3000000008'); expect(reply).toMatch(/dirección/i);
    expect(h.conv.sessionData).toEqual(before); expect(h.conv.state).toBe('awaiting_address');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each(['Natalia\nVoy','Natalia\nYa voy','María\nFernanda'])('keeps name boundaries in %s', async text => {
    const h=rig('awaiting_name'); h.conv.customerName=null as never;
    await h.sendQueued(text);
    expect(h.conv.customerName?.replace(/\s+/g, ' ')).toBe(text.startsWith('Natalia')?'Natalia':'María Fernanda');
    expect(h.conv.state).toBe('awaiting_address');
    expect(h.conv.sessionData.cart).toHaveLength(1); expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each(['Me envías con salsas también porfa','Me avisas cuando llegue el pedido gracias','Y cuánto se demora veci','Y cuánto sr demora veci'])('handles post-order %s',async text=>{
    const h=rig('completed'); h.conv.sessionData.cart=[]; const before=structuredClone(h.conv.sessionData);
    const reply=await h.sendQueued(text);
    if(text.includes('salsas')) {expect(reply).toMatch(/solicitud|cambio/i); expect(reply).toMatch(/ll[aá]ma/i); expect(reply).not.toMatch(/anot[eé]|agregu[eé]/i);}
    else if(text.includes('avisas')) expect(reply).toMatch(/aviso|notifica/i);
    else {expect(reply).toContain('#60'); expect(reply).toContain('35-45 minutos'); expect(reply).not.toMatch(/dime el.*número/i);}
    expect(h.conv.state).toBe('completed'); expect(h.conv.sessionData).toEqual(before); expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('keeps name and payment inquiry from consecutive bubbles through order DTO', async()=>{
    const h=rig('awaiting_name'); h.conv.customerName=null as never;
    h.service.ordersService.create.mockResolvedValue({id:61,dailyOrderNumber:61});
    h.service.ordersService.findTodayOrdersByPhone.mockResolvedValue([]);
    await h.sendQueued('Estefani\nMe indicas el nequi', {raw:{coalescedMessages:[
      {messageId:'name-1',text:'Estefani'},{messageId:'payment-1',text:'Me indicas el nequi'}]}});
    expect(h.conv.customerName).toBe('Estefani'); expect(h.conv.state).toBe('awaiting_address');
    expect(h.replies.join(' ')).toContain('3000000008');
    expect(h.conv.sessionData.address || '').not.toMatch(/nequi/i);
    await h.sendQueued('Calle 10 #20-30'); await h.sendQueued('contraentrega');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.customerName).toBe('Estefani'); expect(dto.items).toHaveLength(1);
    expect(dto.items[0].productId).toBe(87001);
  });
  it('does not assign a bare destination as the name after closing the cart',async()=>{
    const h=rig('building_cart'); h.conv.customerName=null as never;
    await h.sendQueued('Solo eso porfa\nRosaleda');
    expect(h.conv.customerName).toBeNull();
    expect(h.conv.sessionData.cart).toHaveLength(1);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.replies.join(' ')).toMatch(/dirección|barrio|conjunto/i);
  });
  it('ignores an actual reaction without ignoring unsupported media',async()=>{
    const h=rig('completed'); const before=structuredClone(h.conv.sessionData);
    await h.sendQueued('Mensaje (reaction)',{messageType:'other',raw:{type:'reaction',reaction:{message_id:'out-1',emoji:'👍'}}});
    expect(h.replies).toEqual([]); expect(h.conv.sessionData).toEqual(before);
    await h.sendQueued('Mensaje (other)',{messageType:'other',raw:{type:'unknown'}});
    expect(h.replies.join(' ')).toMatch(/texto.*audio/i);
  });
});
