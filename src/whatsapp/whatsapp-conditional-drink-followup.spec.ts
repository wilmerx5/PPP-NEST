import { harness } from './whatsapp-accuracy.test-support';

for(const [dish,drink,small,large,flavor] of [
  ['Bowl Verde','Gaseosa','400ml','1.5L','Cola'],
  ['Pizza Vegetal','Jugo','250ml','500ml','Mora'],
  ['Arroz Marinero','Refresco','300ml','600ml','Limon'],
]) for(const enabled of [false,true]) for(const scenario of ['number','size','price','cancel']) {
  it(`${dish} ${scenario} agent=${enabled}`,async()=>{
    const menu=[{id:93001,code:93001,name:dish,description:'Sin bebida',price:24000,availableNow:true,attributes:[]},
      ...[small,large].map((size,i)=>({id:93002+i,code:93002+i,name:`${drink} ${size}`,price:4000+i*3000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:[flavor,'Naranja']}]}))];
    const h=harness(menu,enabled); const state=scenario==='size'||scenario==='cancel'?'awaiting_final_confirm':'awaiting_payment';h.conv.state=state;
    Object.assign(h.conv.sessionData,{cart:[{productId:93001,code:93001,name:dish,quantity:1,unitPrice:24000,attributes:[],note:'sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:state==='awaiting_final_confirm'?'contraentrega':undefined,deliveryFeeCalculated:2000});
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:9300,dailyOrderNumber:99});
    const before=structuredClone(h.conv.sessionData.cart);
    const first=await h.sendQueued(`el ${dish} trae ${drink}? Si no, agrega dos ${drink} sin hielo`);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(first).toContain(`${drink} ${small}`);expect(first).toContain(`${drink} ${large}`);
    expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
    expect(h.conv.sessionData.pendingCheckoutResume).toBe(state);
    if(scenario==='cancel') {
      const reply=await h.sendQueued('no gracias');
      expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();expect(reply).toMatch(/confirmar/);
    } else {
      if(scenario==='price') {
        const reply=await h.sendQueued('cuanto cuesta la de '+large);
        expect(reply).toMatch(/7[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);
      }
      await h.sendQueued(scenario==='size'?`la de ${large}`:'2');
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(93003);
      const reply=await h.sendQueued(flavor);
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.pendingCheckoutResume).toBeFalsy();
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
      expect(h.conv.sessionData.cart[1]).toMatchObject({productId:93003,quantity:2,note:expect.stringMatching(/sin hielo/i),attributes:[{attributeName:'Sabor',attributeValue:flavor}]});
      expect(reply).toMatch(state==='awaiting_payment'?/método de pago/:/confirmar/);
    }
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if(state==='awaiting_payment') await h.sendQueued('contraentrega');
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((i:any)=>i.productId===93001)).toHaveLength(1);
    expect(dto.items.filter((i:any)=>i.productId===93003)).toHaveLength(scenario==='cancel'?0:2);
    for(const item of dto.items.filter((i:any)=>i.productId===93003)) {
      expect(item.note).toMatch(/sin hielo/i);expect(item.attributes).toEqual([{attributeName:'Sabor',attributeValue:flavor}]);
    }
    expect(dto.address).toContain('20-30');
  });
}

for(const enabled of [false,true]) for(const included of [false,true]) for(const phrase of [
  'el bowl verde trae gaseosa si no agrega una gaseosa 400ml',
  'el bowl verde trae gaseosa? si no viene me mandas una gaseosa 400ml',
  'el bowl verde trae gaseosa, si no me envias una gaseosa 400ml',
]) {
  it(`natural condition: ${phrase}, included=${included}, agent=${enabled}`,async()=>{
    const h=harness([{id:94001,code:94001,name:'Bowl Verde',description:included?'Incluye gaseosa':'Sin bebida',price:20000,availableNow:true,attributes:[]},
      {id:94002,code:94002,name:'Gaseosa 400ml',price:4000,availableNow:true,attributes:[]}],enabled);
    h.conv.state='awaiting_payment';h.conv.sessionData.cart=[{productId:94001,code:94001,name:'Bowl Verde',quantity:1,unitPrice:20000,attributes:[]}];
    const reply=await h.sendQueued(phrase);
    expect(h.conv.state).toBe('awaiting_payment');expect(reply).toContain('método de pago');
    expect(h.conv.sessionData.cart.map(l=>[l.productId,l.quantity])).toEqual(included?[[94001,1]]:[[94001,1],[94002,1]]);
    expect(reply).toMatch(included?/ya viene incluida/i:/agregué/i);
  });
}

for(const enabled of [false,true]) for(const query of ['la de 500ml','la de 2L']) {
  it(`ambiguous or absent volume never chooses a product/code: ${query}, agent=${enabled}`,async()=>{
    const menu=[{id:95001,code:95001,name:'Jugo De Mora 500ml',price:5000,availableNow:true,attributes:[]},
      {id:95002,code:95002,name:'Jugo De Lulo 500ml',price:6000,availableNow:true,attributes:[]},
      {id:500,code:500,name:'Pizza Familiar',price:40000,availableNow:true,attributes:[]}];
    const h=harness(menu,enabled);
    h.conv.sessionData.pendingMatch={query:'quiero dos jugos',quantity:2,intent:'order',candidates:menu.slice(0,2)};
    await h.sendQueued(query);
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([95001,95002]);
  });
}
