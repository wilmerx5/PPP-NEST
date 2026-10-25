import { harness } from './whatsapp-accuracy.test-support';

for (const dish of ['Bowl Vegetal', 'Pizza De Hongos', 'Ramen De Miso'])
for (const agent of [false, true])
for (const field of ['name', 'phone'])
for (const inquiry of ['threeAfter', 'threeBefore']) {
  it(`${dish}: feedback + ${field} + ${inquiry} during awaiting_payment, agent=${agent}`, async () => {
    const menu = [
      {id:98301,code:98301,name:dish,price:23000,description:'Preparado con verduras. Sin bebida.',availableNow:true,attributes:[]},
      {id:98302,code:98302,name:'Bebida Del Dia',price:6000,description:'Bebida individual.',availableNow:true,hasAttributes:true,
        attributes:[{attributeName:'Sabor',options:['Limon','Naranja']}]},
    ];
    const h = harness(menu, agent);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    h.service.ordersService.create = jest.fn().mockResolvedValue({id:9830,dailyOrderNumber:99});
    h.conv.state = 'awaiting_payment';
    Object.assign(h.conv.sessionData, {
      cart:[{productId:98301,code:98301,name:dish,quantity:2,unitPrice:23000,attributes:[],note:'sin cebolla'}],
      orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 #23-45',addressConfirmed:true,
      phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,
    });
    const before = structuredClone(h.conv.sessionData);
    const contact = {name:'mi nombre es Ana Torres',phone:'mi teléfono es 3001112233'}[field];
    const start = h.replies.length;
    const question = `¿cuánto cuesta ${dish}? ¿qué trae ${dish}? ¿cuánto tarda el domicilio?`;
    const message = inquiry==='threeBefore' ? `No me respondiste: ${question} ${contact}` : `No me entendiste, ${contact}; ${question}`;
    await h.sendQueued(message);
    const reply = h.replies.slice(start).join('\n');
    expect(reply).toMatch(/verduras/i);
    expect(reply).toMatch(/Suele demorar/i);
    expect(reply).toMatch(/23[.,]000/);
    expect(reply).toMatch(/pag[ao]|m[eé]todo/i);
    expect(reply).not.toMatch(/nombre real|no me qued[oó] clara|dime qu[eé] parte/i);
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
    if(field==='name') expect(h.conv.customerName).toBe('Ana Torres');
    if(field==='phone') expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
    expect(h.conv.sessionData.address).toBe(before.address);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item:any)=>item.productId===98301)).toHaveLength(2);
    expect(dto.items).toHaveLength(2);
    for(const item of dto.items.filter((item:any)=>item.productId===98301)) expect(item.note).toMatch(/sin cebolla/);
    expect(dto.customerName).toBe(field==='name'?'Ana Torres':'Wilmer');
    expect(dto.phone.replace(/\D/g,'')).toContain(field==='phone'?'3001112233':'3000000001');
    expect(dto.address).toContain('23-45');
  });
}
