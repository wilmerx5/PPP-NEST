import { harness, products } from './whatsapp-accuracy.test-support';

// A specific beverage cannot be inferred, but generic inclusion remains useful evidence.
for(const [base,combo] of [['Arroz Paisa','Combo De Arroz Paisa'],['Pizza Vegetal','Combo Pizza Vegetal'],['Bowl Verde','Combo Bowl Verde']]) {
  for(const enabled of [false,true]) for(const state of ['building_cart','awaiting_payment']) {
    for(const description of ['Acompañado con papa francesa y bebida de 1.5L','Incluye bebida de 400ml']) {
      it(`${combo}: ${description}, ${state}, agent=${enabled}`,async()=>{
        const menu=[{id:92001,code:81,name:base,description:'Con papas',price:25000,availableNow:true,attributes:[]},
          {id:92002,code:94,name:combo,description,price:32000,availableNow:true,attributes:[]}];
        const h=harness(menu,enabled);h.conv.state=state;
        if(state==='building_cart') h.conv.sessionData.pendingMatch={query:base,intent:'order',candidates:menu.map(p=>({id:p.id,code:p.code,name:p.name,price:p.price,description:p.description}))};
        else h.conv.sessionData.cart=[{productId:92002,code:94,name:combo,quantity:2,unitPrice:32000,attributes:[],note:'sin cebolla'}];
        const before=structuredClone(h.conv.sessionData);
        const reply=await h.sendQueued('vienen con gaseosa?');
        expect(reply).toContain(combo);expect(reply).toContain('#94');expect(reply).toContain(description);
        expect(reply).toMatch(/no tengo confirmado/i);expect(reply).not.toMatch(/sí traen? gaseosa|pide la gaseosa aparte/i);
        expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.state).toBe(state);
        expect(h.conv.sessionData.pendingMatch).toEqual(before.pendingMatch);
        if(state==='awaiting_payment') expect(reply).toContain('método de pago');
        else {
          // Codes in the explanatory response must not silently renumber the original list.
          await h.sendQueued('2');expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual([92002]);
        }
      });
    }
  }
}
for(const enabled of [false,true]) for(const description of ['Sin bebida','Bebida opcional con costo adicional','Con papas']) {
  it(`does not claim generic inclusion without evidence: ${description}, agent=${enabled}`,async()=>{
    const h=harness([{id:92003,code:95,name:'Combo Vegetal',description,price:25000,availableNow:true,attributes:[]}],enabled);
    const reply=await h.sendQueued('el combo vegetal trae gaseosa?');
    expect(reply).not.toMatch(/sí indica.*bebida|incluyen bebida/i);
    expect(h.conv.sessionData.cart).toEqual([]);
  });
}

for(const enabled of [false,true]) {
  it(`real rice listing preserves all three beverage combos, agent=${enabled}`,async()=>{
    const h=harness(products,enabled);
    await h.sendQueued('que arroces tiene');
    const before=structuredClone(h.conv.sessionData.pendingMatch);
    const reply=await h.sendQueued('vienen con gaseosa?');
    for(const [name,code] of [['Combo Arroz Chino Con Costillas De Cerdo',85],['Combo Arroz Chino Con Medio Pollo',97],['Combo De Arroz Paisa',94]]) {
      expect(reply).toContain(name);expect(reply).toContain(`#${code}`);
    }
    expect(reply).toContain('1.5L');expect(reply).not.toMatch(/sí trae[n]? gaseosa|pide la gaseosa aparte/i);
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.pendingMatch).toEqual(before);
    await h.sendQueued('94');
    expect(h.conv.sessionData.pendingAttribute?.productId).toBe(94);
    await h.sendQueued('Colombiana');
    expect(h.conv.sessionData.cart.map(l=>[l.code,l.quantity])).toEqual([[94,1]]);
  });
}
