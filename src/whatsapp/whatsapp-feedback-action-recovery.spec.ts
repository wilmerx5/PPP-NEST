import { harness } from './whatsapp-accuracy.test-support';

const scenarios = ['quantity', 'quantityColon', 'contents', 'price'] as const;
for (const [dish, drink] of [['Bowl Vegetal','Jugo 500ml'],['Pizza De Hongos','Gaseosa 400ml'],['Ramen De Miso','Te Frio']])
for (const agent of [false,true]) for (const stage of ['awaiting_name','awaiting_payment','attribute'])
for (const kind of scenarios) {
  it(`${dish}: ${stage} ${kind}, agent=${agent}`, async () => {
    const menu = [
      {id:98201,code:98201,name:dish,price:23000,description:'Preparado con verduras. Sin bebida.',availableNow:true,attributes:[]},
      {id:98202,code:98202,name:drink,price:6000,description:'Bebida individual.',availableNow:true,hasAttributes:true,
        attributes:[{attributeName:'Sabor',options:['Limon','Naranja']}]},
    ];
    const h = harness(menu,agent);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    h.conv.state = stage === 'awaiting_name' ? 'awaiting_name' : 'awaiting_payment';
    Object.assign(h.conv.sessionData,{
      cart:[{productId:98201,code:98201,name:dish,quantity:2,unitPrice:23000,attributes:[],note:'sin cebolla'}],
      orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 #23-45',addressConfirmed:true,
      phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,
    });
    if (stage === 'awaiting_name') {
      h.conv.customerName = '';
    }
    h.service.ordersService.create = jest.fn().mockResolvedValue({id:9820,dailyOrderNumber:99});
    if (stage === 'attribute') {
      await h.sendQueued(`el ${dish} trae bebida? Si no, agrega dos ${drink} sin hielo`);
      expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:98202,quantity:2});
    }
    const before = structuredClone(h.conv.sessionData);
    const state = h.conv.state;
    const name = h.conv.customerName;
    const comment = {
      quantity: `No me entendiste, deja solo una ${dish}`,
      quantityColon: `Eso no fue lo que te pedí: deja solo una ${dish}`,
      contents: `No me respondiste: ¿qué trae ${dish}?`,
      price: `No has contestado mi pregunta, ¿cuánto cuesta ${dish}?`,
    }[kind];
    const corrected = kind === 'quantity' || kind === 'quantityColon';
    const start = h.replies.length;
    await h.sendQueued(comment);
    const reply = h.replies.slice(start).join('\n');
    if (kind === 'contents') expect(reply).toMatch(/verduras/i);
    if (kind === 'price') expect(reply).toMatch(/23[.,]000/);
    expect(reply).not.toMatch(/escr[ií]beme cu[aá]l|dime qu[eé] parte|necesito tu.*nombre real/i);
    expect(h.conv.state).toBe(state);
    expect(h.conv.sessionData.cart).toEqual(before.cart.map(line=>({...line,quantity:corrected?1:2})));
    expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
    expect(h.conv.customerName).toBe(name);
    expect(h.conv.sessionData.address).toBe(before.address);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if (stage === 'attribute') await h.sendQueued('Limon');
    if (stage === 'awaiting_name') await h.sendQueued('Lucia Rojas');
    await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((item:any)=>item.productId===98201)).toHaveLength(corrected?1:2);
    expect(dto.items.find((item:any)=>item.productId===98201).note).toMatch(/sin cebolla/i);
    expect(dto.items).toHaveLength((corrected?1:2)+(stage==='attribute'?2:0));
    for(const item of dto.items.filter((item:any)=>item.productId===98202)) {
      expect(item.attributes).toEqual([{attributeName:'Sabor',attributeValue:'Limon'}]);
      expect(item.note).toMatch(/sin hielo/i);
    }
    expect(dto.customerName).toBe(stage==='awaiting_name'?'Lucia Rojas':'Wilmer');
    expect(dto.address).toContain('23-45');
  });
}
