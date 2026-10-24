import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Bowl Vegetal', 'Pizza De Hongos', 'Ramen De Miso'])
for (const agent of [false, true])
for (const stage of ['awaiting_name', 'awaiting_payment', 'attribute'])
for (const field of ['name', 'phone', 'address'])
for (const inquiry of ['priceAfter', 'contentsAfter', 'priceBefore']) {
  it(`${dish}: feedback + ${field} + ${inquiry} during ${stage}, agent=${agent}`, async () => {
    const menu = [
      {id:98301,code:98301,name:dish,price:23000,description:'Preparado con verduras. Sin bebida.',availableNow:true,attributes:[]},
      {id:98302,code:98302,name:'Bebida Del Dia',price:6000,description:'Bebida individual.',availableNow:true,hasAttributes:true,
        attributes:[{attributeName:'Sabor',options:['Limon','Naranja']}]},
    ];
    const h = harness(menu, agent);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    h.service.ordersService.create = jest.fn().mockResolvedValue({id:9830,dailyOrderNumber:99});
    h.conv.state = stage === 'awaiting_name' ? 'awaiting_name' : 'awaiting_payment';
    if (stage === 'awaiting_name') h.conv.customerName = '';
    Object.assign(h.conv.sessionData, {
      cart:[{productId:98301,code:98301,name:dish,quantity:2,unitPrice:23000,attributes:[],note:'sin cebolla'}],
      orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 #23-45',addressConfirmed:true,
      phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,
    });
    if (stage === 'attribute') {
      await h.sendQueued(`el ${dish} trae bebida? Si no, agrega dos Bebida Del Dia sin hielo`);
      expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:98302,quantity:2});
    }
    const before = structuredClone(h.conv.sessionData);
    const contact = {name:'mi nombre es Ana Torres',phone:'mi teléfono es 3001112233',address:'la dirección es Carrera 12 #34-56'}[field];
    const start = h.replies.length;
    const question = inquiry==='contentsAfter' ? `¿qué trae ${dish}?` : `¿cuánto cuesta ${dish}?`;
    const message = inquiry==='priceBefore' ? `No me respondiste: ${question} ${contact}` : `No me entendiste, ${contact}; ${question}`;
    await h.sendQueued(message);
    const reply = h.replies.slice(start).join('\n');
    expect(reply).toMatch(inquiry==='contentsAfter' ? /verduras/i : /23[.,]000/);
    expect(reply).not.toMatch(/nombre real|no me qued[oó] clara|dime qu[eé] parte/i);
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
    if(field==='name') expect(h.conv.customerName).toBe('Ana Torres');
    if(field==='phone') expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
    if(field==='address') expect(h.conv.sessionData.address).toContain('34-56');
    else expect(h.conv.sessionData.address).toBe(before.address);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if(stage==='attribute') await h.sendQueued('Limon');
    if(stage==='awaiting_name' && field!=='name') await h.sendQueued('Lucia Rojas');
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item:any)=>item.productId===98301)).toHaveLength(2);
    expect(dto.items).toHaveLength(stage==='attribute'?4:2);
    for(const item of dto.items.filter((item:any)=>item.productId===98301)) expect(item.note).toMatch(/sin cebolla/);
    for(const item of dto.items.filter((item:any)=>item.productId===98302)) {
      expect(item.attributes).toEqual([{attributeName:'Sabor',attributeValue:'Limon'}]);
      expect(item.note).toMatch(/sin hielo/);
    }
    expect(dto.customerName).toBe(field==='name'?'Ana Torres':stage==='awaiting_name'?'Lucia Rojas':'Wilmer');
    expect(dto.phone.replace(/\D/g,'')).toContain(field==='phone'?'3001112233':'3000000001');
    expect(dto.address).toContain(field==='address'?'34-56':'23-45');
  });
}
