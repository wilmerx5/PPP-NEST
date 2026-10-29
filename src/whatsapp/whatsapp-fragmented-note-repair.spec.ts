import { harness } from './whatsapp-accuracy.test-support';

const menus = [['Bowl de garbanzos','Curry de lentejas'],['Pizza del huerto','Ravioles de ricota']];
for (const names of menus) for (const enabled of [false,true]) {
  const setup=async()=>{
    const menu=names.map((name,i)=>({id:88001+i,code:88001+i,name,price:20000,availableNow:true,attributes:[]}));
    const h=harness(menu,enabled);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.ordersService.create=jest.fn();
    for(const name of names) await h.sendQueued(`Quiero un ${name}`);
    await h.sendQueued('uno sin cebolla');
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
    return h;
  };
  it.each(['no, el otro','perdón, el otro','mejor el otro'])(`unanchored repair asks ${names[0]} agent=${enabled}: %s`,async text=>{
    const h=await setup();
    const before=structuredClone(h.conv.sessionData);
    const reply=await h.sendQueued(text);
    expect(h.conv.sessionData).toEqual(before);
    expect(reply).toContain(names[0]);expect(reply).toContain(names[1]);
    expect(reply).toMatch(/cu[aá]l|indica|elige/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each(['no, el segundo','perdón, el segundo','mejor el segundo'])(`explicit repair selects only second ${names[0]} agent=${enabled}: %s`,async text=>{
    const h=await setup();
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued(text);
    expect(h.conv.sessionData.cart).toEqual([before[0],{...before[1],note:'sin cebolla'}]);
    expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
    expect(reply).toMatch(/anotad/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it.each(['no el segundo','¿mejor el segundo?','mejor el cuarto'])(`negative, question or absent row stays pending ${names[0]} agent=${enabled}: %s`,async text=>{
    const h=await setup(); const before=structuredClone(h.conv.sessionData);
    await h.sendQueued(text);
    expect(h.conv.sessionData).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it(`review repair cannot confirm ${names[0]} agent=${enabled}`,async()=>{
    const h=await setup();h.conv.state='awaiting_final_confirm';
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('perdón, el segundo');
    expect(h.conv.sessionData.cart).toEqual([before[0],{...before[1],note:'sin cebolla'}]);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it(`repair notes only one unit ${names[0]} agent=${enabled}`,async()=>{
    const h=await setup();h.conv.sessionData.cart[1].quantity=3;
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('mejor el segundo');
    expect(h.conv.sessionData.cart).toEqual([before[0],{...before[1],quantity:2},{...before[1],quantity:1,note:'sin cebolla'}]);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

}
