import { harness } from './whatsapp-accuracy.test-support';

const comments = [
  ['price', 'Eso está muy caro'],
  ['understanding', 'No me entendiste'],
  ['answer', 'No me respondiste lo que te pregunté'],
  ['price', 'Está demasiado caro'],
  ['understanding', 'Eso no fue lo que te pedí'],
  ['answer', 'No has contestado mi pregunta'],
] as const;
for (const [dish, drink] of [['Bowl Vegetal','Jugo 500ml'],['Pizza De Hongos','Gaseosa 400ml'],['Ramen De Miso','Te Frio']])
for (const agent of [false,true]) for (const stage of ['awaiting_name','awaiting_payment','attribute'])
for (const [kind, comment] of comments) {
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
      cart:[{productId:98201,code:98201,name:dish,quantity:1,unitPrice:23000,attributes:[],note:'sin cebolla'}],
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
    const start = h.replies.length;
    await h.sendQueued(comment);
    const reply = h.replies.slice(start).join('\n');
    expect(reply).toMatch(kind === 'price' ? /precio|econ[oó]mic|presupuesto/i : /aclar|pregunta|parte|entend|revis/i);
    expect(reply).not.toMatch(/no (?:tenemos|manejamos)|ya (?:correg[ií]|cambi[eé])|necesito tu nombre real/i);
    expect(reply).toMatch(stage === 'attribute' ? /sabor|limon|naranja/i : stage === 'awaiting_name' ? /nombre/i : /pago|pagas|pagar/i);
    expect(h.conv.state).toBe(state);
    expect(h.conv.sessionData.cart).toEqual(before.cart);
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
    expect(dto.items.filter((item:any)=>item.productId===98201)).toHaveLength(1);
    expect(dto.items.find((item:any)=>item.productId===98201).note).toMatch(/sin cebolla/i);
    expect(dto.items).toHaveLength(stage==='attribute'?3:1);
    for(const item of dto.items.filter((item:any)=>item.productId===98202)) {
      expect(item.attributes).toEqual([{attributeName:'Sabor',attributeValue:'Limon'}]);
      expect(item.note).toMatch(/sin hielo/i);
    }
    expect(dto.customerName).toBe(stage==='awaiting_name'?'Lucia Rojas':'Wilmer');
    expect(dto.address).toContain('23-45');
  });
}
