import { harness } from './whatsapp-accuracy.test-support';

for (const agent of [false, true]) for (const names of [['Churrasco','Trucha','Mojarra'], ['Risotto','Lasaña','Raviolis']])
for (const kind of ['description','size']) for (const pending of [false,true]) {
  it(`chained inquiry ${names} ${kind} pending=${pending} agent=${agent}`, async () => {
    const menu=names.map((name,i)=>({id:38001+i,code:i+1,name,description:`Porción de ${400+i*100} gramos. Con verduras.`,price:20000,availableNow:true,hasAttributes:false,attributes:[] as {attributeName:string;options:string[]}[]}));
    if(pending)menu.push({id:38004,code:4,name:'Jugo',description:'Jugo natural.',price:5000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mora','Mango']}]});
    const h=harness(menu,agent);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:380,dailyOrderNumber:380});
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    if(pending){
      h.conv.state='awaiting_attribute';
      h.conv.sessionData.pendingAttribute={productId:38004,code:4,name:'Jugo',price:5000,quantity:1,attributes:[{attributeName:'Sabor',options:['Mora','Mango']}],selected:[]};
    }
    const before=structuredClone(h.conv.sessionData);
    await h.sendQueued(kind==='description'?`Cómo viene el ${names[0]}`:`Qué tan grande es el ${names[0]}`);
    for(const [i,name] of names.slice(1).entries()) {
      const reply=await h.sendQueued(`Y la ${name}`);
      expect(reply).toContain(name);
      expect(reply).toContain(`${500+i*100} gramos`);
      expect(reply).not.toMatch(/Listo ✅/i);
      if(!pending)expect(reply).not.toMatch(/Escribe el número|cuál prefieres/i);
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      if(pending)expect(h.conv.state).toBe('awaiting_attribute');
    }
    if(pending){
      await h.sendQueued('Mora');
      await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([38004]);
    }
  });
}

for(const agent of [false,true]) for(const names of [['Churrasco','Trucha','Mojarra'],['Risotto','Lasaña','Raviolis']]) {
  const menu=names.map((name,i)=>({id:38011+i,code:i+1,name,description:`Porción de ${400+i*100} gramos. Con verduras.`,price:20000,availableNow:true,hasAttributes:false,attributes:[] as {attributeName:string;options:string[]}[]}));
  it(`purchase breaks query chain and closes without losing items ${agent} ${names}`,async()=>{
    const h=harness(menu,agent);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:380,dailyOrderNumber:380});
    await h.sendQueued(`Cómo viene el ${names[0]}`);
    await h.sendQueued(`Y la ${names[1]}`);
    await h.sendQueued(`Y la ${names[2]}`);
    await h.sendQueued(`Dame un ${names[1]}`);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:38012,quantity:1})]);
    await h.sendQueued(`Y la ${names[0]}`);
    expect(h.replies.at(-1)).not.toMatch(/Porción de 400 gramos.*pedido sigue igual/s);
    // Resolve a catalog choice, if offered; the earlier inquiry must not eat this addition.
    if(h.conv.sessionData.pendingMatch)await h.sendQueued('1');
    expect(h.conv.sessionData.cart.map(x=>x.productId).sort()).toEqual([38011,38012]);
    await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items.map(x=>x.productId).sort()).toEqual([38011,38012]);
  });
  it(`bare other after one dish asks instead of selecting ${agent} ${names}`,async()=>{
    const h=harness(menu,agent);
    await h.sendQueued(`Cómo viene el ${names[0]}`);
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued('Y el otro');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(reply).toMatch(/cu[aá]l|nombre|qu[eé] plato/i);
    expect(reply).not.toMatch(/Listo ✅/);
    const answer=await h.sendQueued(names[1]);
    expect(answer).toContain('500 gramos');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingCompositionAsk).toBeFalsy();
  });
}

for(const agent of [false,true])for(const measured of [false,true])it(`size clarification preserves the question agent=${agent} measured=${measured}`,async()=>{
  const menu=[{id:38031,code:1,name:'Tarta',description:'Porción de 400 gramos.',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
    {id:38032,code:2,name:'Flan',description:measured?'Porción de 200 gramos.':'Con crema.',price:10000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);
  await h.sendQueued('Qué tan grande es la Tarta');
  await h.sendQueued('Y el otro');
  expect(h.conv.sessionData.pendingCompositionAsk).toBeTruthy();
  const answer=await h.sendQueued('Flan');
  expect(answer).toMatch(measured?/200 gramos/:/no tengo.*tamaño.*confirmado/i);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.conv.sessionData.pendingCompositionAsk).toBeFalsy();
});
