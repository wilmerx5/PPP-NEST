import { harness } from './whatsapp-accuracy.test-support';

for (const [name, side] of [['Arroz Con Pollo','ensalada'],['Plato De Pasta','salsa'],['Bowl Vegetal','aderezo']])
for (const agent of [false,true]) for (const known of [false,true]) {
  test(`${name}: purchase plus side detail, known=${known}, agent=${agent}`, async () => {
    const h=harness([{id:94001,code:81,name,description:`Acompañado con ${side}${known ? " de tomate y cebolla" : ""}`,price:30000,availableNow:true,attributes:[]}],agent);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:146,dailyOrderNumber:146});
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    await h.sendQueued(`Me das un ${name} por favor, con qué viene acompañado?`);
    const before=structuredClone(h.conv.sessionData.cart);
    const response=await h.sendQueued(`De qué es la ${side}?`);
    expect(response).toMatch(known ? /tomate y cebolla/i : /no tengo.*(?:detalle|ingrediente|confirmad)|no.*(?:especifica|detalla)/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    const added=await h.sendQueued(`Agrégalo al pedido por favor, pero de qué es la ${side} el día de hoy`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:94001,qty:1})]);
    expect(added).toMatch(known ? /tomate y cebolla/i : /no tengo|no.*(?:especifica|detalla)/i);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
    expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
    const cart=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`De qué es la ${side}?`);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    await close(h,94001);
  });
}

for (const [name,options] of [['Trucha',['Frita','Apanada','Asada']],['Tofu',['Frito','Apanado','Asado']],['Berenjena',['Frita','Apanada','Asada']]] as const)
for (const agent of [false,true]) {
  test(`${name}: unavailable preparation then offered option, agent=${agent}`, async () => {
    const h=harness([{id:94002,code:82,name,price:29000,availableNow:true,hasAttributes:true,
      attributes:[{attributeName:'Seleccion',options:[...options]}]}],agent);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:146,dailyOrderNumber:146});
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    const offer=await h.sendQueued(`Me das un ${name} en salsa marinera`);
    expect(offer).toMatch(/asada|asado/i);
    const selected=await h.sendQueued(`Dame una ${options[2]} por favor`);
    expect(selected).not.toMatch(/no manejamos/);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:94002,qty:1,attrs:[`Seleccion:${options[2]}`]})]);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    await close(h,94002,options[2]);
  });
}

async function close(h: ReturnType<typeof harness>, id: number, preparation?: string) {
  await h.sendQueued('no más, recojo en el local');
  expect(h.conv.state).toBe('awaiting_payment');
  await h.sendQueued('en efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(1);
  expect(dto.items[0].productId).toBe(id);
  if(preparation) expect(dto.items[0].attributes).toEqual([{attributeName:'Seleccion',attributeValue:preparation}]);
}

for (const name of ['Bagre', 'Tofu', 'Berenjena']) for (const agent of [false,true]) {
  test(`${name}: accompaniment questions never duplicate purchase, agent=${agent}`, async () => {
    const h=harness([{id:94003,code:83,name,description:'Acompañado con papa francesa, ensalada y arroz',price:29000,availableNow:true,hasAttributes:true,
      attributes:[{attributeName:'Seleccion',options:['Frito','Asado','En Salsa']}]}],agent);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:146,dailyOrderNumber:146});
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    const response=await h.sendQueued(`Dame un ${name} en salsa pero con que viene`);
    expect(response).toMatch(/papa francesa, ensalada y arroz/i);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:94003,qty:1,attrs:['Seleccion:En Salsa']})]);
    for (const question of [`Me puedes confirmar con qué está acompañado el ${name} en salsa`, `Con que va el ${name} en salsa`]) {
      const before=structuredClone(h.conv.sessionData.cart);
      const answer=await h.sendQueued(question);
      expect(answer).toMatch(/papa francesa, ensalada y arroz/i);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
    }
    // Reproduce the historical corrupted cart, including an inquiry saved as a note.
    const line=structuredClone(h.conv.sessionData.cart[0]);
    h.conv.sessionData.cart.push({...line,note:'con que esta acompanado'});
    h.conv.sessionData.cart.push({...line,productId:95000,name:'Otro plato',note:undefined});
    h.conv.state='awaiting_name';
    const dirty=structuredClone(h.conv.sessionData.cart);
    const inquiry=await h.sendQueued(`Con que va el ${name} en salsa`);
    expect(inquiry).toMatch(/papa francesa, ensalada y arroz/i);
    expect(h.conv.sessionData.cart).toEqual(dirty);
    expect(h.conv.state).toBe('awaiting_name');
    await h.sendQueued(`Solo quiero un ${name} y que lleve las papas sudadas`);
    expect(h.cartRows()).toEqual([expect.objectContaining({id:94003,qty:1,attrs:['Seleccion:En Salsa'],note:expect.stringMatching(/papas sudadas/i)})]);
    await close(h,94003,'En Salsa');
    expect(JSON.stringify(h.service.ordersService.create.mock.calls[0][0])).toMatch(/papas sudadas/i);
    expect(JSON.stringify(h.service.ordersService.create.mock.calls[0][0])).not.toMatch(/con que esta acompanado/);
  });
}
