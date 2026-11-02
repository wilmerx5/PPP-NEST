import { harness } from './whatsapp-accuracy.test-support';

for (const otherCatalog of [false, true])
for (const agent of [false, true])
for (const checkout of [false, true])
for (const reversed of [false, true]) {
  it(`partial preparation then targeted note ${JSON.stringify({otherCatalog, agent, checkout, reversed})}`, async () => {
    const family = otherCatalog ? 'Bandeja Con Tofu' : 'Ejecutivo Con Pollo';
    const protein = otherCatalog ? 'Tofu' : 'Pollo';
    const key = otherCatalog ? 'Corte' : 'Presa';
    const choice = otherCatalog ? 'Filete' : 'Pechuga';
    const attrs = [
      {attributeName:key, options:[choice, 'Cubos']},
      {attributeName:'Sopa', options:['Ajiaco', 'Menudencias']},
      {attributeName:'Bebida', options:['Limonada', 'Cola']},
    ];
    const menu = ['Frito', 'Broaster'].map((style,i) => ({
      id:97501+i, code:i+1, name:family+' '+style, price:24000+i*1000,
      availableNow:true, hasAttributes:true, attributes:attrs,
    }));
    const h = harness(menu, agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn = jest.fn().mockResolvedValue({reply:'Aclaremos el pedido', actions:{}});
    h.service.ordersService.create = jest.fn().mockResolvedValue({id:347, dailyOrderNumber:347});
    h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
    const chosen = {
      productId:97501, code:1, name:menu[0].name, quantity:3, unitPrice:24000,
      attributes:[{attributeName:key,attributeValue:choice},{attributeName:'Sopa',attributeValue:'Ajiaco'},{attributeName:'Bebida',attributeValue:'Limonada'}],
      note:'Salsa aparte; limonada bajita de azúcar',
    };
    const untouched = {...structuredClone(chosen), quantity:1, note:'Sin cilantro',
      attributes:[{attributeName:key,attributeValue:'Cubos'},{attributeName:'Sopa',attributeValue:'Menudencias'},{attributeName:'Bebida',attributeValue:'Cola'}]};
    h.conv.sessionData.cart = reversed ? [untouched, chosen] : [chosen, untouched];
    h.conv.state = checkout ? 'awaiting_final_confirm' : 'building_cart';
    if(checkout) h.conv.sessionData.paymentMethod = 'contraentrega';
    const initialState = h.conv.state;
    const changeReply = await h.sendQueued(`Cambia uno de los de ${choice} a ${protein} broaster`);
    expect(changeReply).toMatch(/broaster/i);
    expect(h.conv.sessionData.cart.find(l=>l.productId===97502)).toMatchObject({quantity:1, attributes:chosen.attributes, note:chosen.note});
    const noteReply = await h.sendQueued('El broaster sin arroz');
    const target = h.conv.sessionData.cart.find(l=>l.productId===97502);
    expect(target).toMatchObject({quantity:1,attributes:chosen.attributes});
    expect(target?.note).toMatch(/sin arroz/i);
    expect(target?.note).toMatch(/salsa aparte/i);
    expect(target?.note).toMatch(/bajita de azúcar/i);
    expect(h.conv.sessionData.cart).toContainEqual(untouched);
    expect(h.conv.sessionData.cart).toContainEqual({...chosen,quantity:2});
    expect(h.conv.sessionData.cart.reduce((n,l)=>n+l.quantity,0)).toBe(4);
    expect(h.conv.state).toBe(initialState);
    expect(noteReply).toMatch(/sin arroz/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if(!checkout){await h.sendQueued('no más');await h.sendQueued('contraentrega');}
    const receipt = await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items = h.service.ordersService.create.mock.calls[0][0].items;
    expect(items).toHaveLength(4);
    const changed = items.filter(i=>i.productId===97502);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({attributes:chosen.attributes});
    expect(changed[0].note).toMatch(/sin arroz/i);
    expect(items.filter(i=>/sin arroz/i.test(i.note||''))).toHaveLength(1);
    expect(receipt).toContain('97.000');
  });
}

for(const agent of [false,true])
for(const scenario of ['ambiguous','different dishes','missing','conflict','condition','payment','pending match','pending recovery','long note','question','purchase','repeat']) {
  it(`style note guard ${agent} ${scenario}`,async()=>{
    const menu=[{id:97601,code:1,name:'Bandeja Con Tofu Broaster',price:25000,availableNow:true,hasAttributes:false,attributes:[]},
      {id:97602,code:2,name:'Plato Con Pescado Broaster',price:27000,availableNow:true,hasAttributes:false,attributes:[]}];
    const h=harness(menu,agent);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'Aclaremos el pedido',actions:{}});
    h.service.ordersService.create=jest.fn();h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    h.conv.state='awaiting_final_confirm';h.conv.sessionData.paymentMethod='contraentrega';
    h.conv.sessionData.cart=[{productId:97601,code:1,name:menu[0].name,quantity:2,unitPrice:25000,attributes:[],note:'Salsa aparte'}];
    let phrase='El broaster sin arroz';
    if(scenario==='ambiguous')h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],quantity:1,note:'Sin sal'});
    if(scenario==='different dishes')h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],productId:97602,code:2,name:menu[1].name,unitPrice:27000});
    if(scenario==='missing')phrase='El frito sin arroz';
    if(scenario==='conflict')h.conv.sessionData.cart[0].note='Con arroz';
    if(scenario==='condition')phrase+=' si no cuesta más';
    if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-payment';
    if(scenario==='pending match')h.conv.sessionData.pendingMatch={query:'tofu',quantity:1,candidates:menu,intent:'order'};
    if(scenario==='pending recovery')h.conv.sessionData.pendingUnitDistribution={productId:97601,quantity:2,sourceText:'uno con opciones distintas'};
    if(scenario==='long note')h.conv.sessionData.cart[0].note='Salsa aparte; '+ 'observacion '.repeat(16);
    if(scenario==='question')phrase='¿El broaster sin arroz?';
    if(scenario==='purchase')phrase='Quiero otro broaster sin arroz';
    if(scenario==='repeat'){
      await h.sendQueued(phrase);
      expect(h.conv.sessionData.cart[0].note).toMatch(/sin arroz/i);
    }
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued(phrase);
    if(scenario!=='purchase')expect(h.conv.sessionData.cart).toEqual(before);
    // An explicit additional purchase must not rewrite the existing units' notes.
    if(scenario==='purchase')expect(h.conv.sessionData.cart.find(l=>l.productId===97601&&l.note==='Salsa aparte')?.quantity).toBe(2);
    if(!['question','purchase'].includes(scenario)){
      expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(reply).toMatch(scenario==='repeat'?/sin arroz/i:/igual|pendiente/i);
    }
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
