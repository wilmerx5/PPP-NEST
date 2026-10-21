import {harness} from './whatsapp-accuracy.test-support';

for (const dish of ['Bowl Vegetal', 'Pasta Del Huerto', 'Arroz Chino']) {
 for (const pick of ['number','code','name'] as const) for (const enabled of [false,true]) for (const change of ['sold-out','removed','price'] as const) {
  it(`${dish} offered combo ${change} pick=${pick} agent=${enabled}`, async()=>{
   const menu=[dish,`Combo De ${dish}`,`Combo De ${dish} Familiar`].map((name,i)=>({id:94601+i,code:601+i,name,price:15000+i*7000,description:i?'Incluye bebida de 1.5L':'Sin bebida',availableNow:true,attributes:[]}));
   const h=harness(menu,enabled);h.cfg.ignoreBusinessHours=false;
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
   Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:946,dailyOrderNumber:94});
   await h.sendQueued(`Quiero dos ${dish} sin cebolla`);
   const before=structuredClone(h.conv.sessionData.cart);
   expect(before).toHaveLength(1);expect(before[0].quantity).toBe(2);
   await h.sendQueued('Trae bebida?');
   expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[0]);
   if(change==='removed') menu.splice(1,1);
   else if(change==='sold-out') menu[1].availableNow=false;
   else menu[1]={...menu[1],price:26000};
   const reply=await h.sendQueued(pick==='number'?'1':pick==='code'?'código 602':`Combo De ${dish}`);
   if(change==='price') {
    expect(reply).toMatch(/precio.*cambi/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued(pick==='number'?'1':pick==='code'?'código 602':`Combo De ${dish}`);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:94602,quantity:2,unitPrice:26000,note:before[0].note})]);
   } else {
    expect(reply).toMatch(/no.*disponible|retirado|ya no/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    // Keep the original list numbering and replacement after a rejected pick.
    await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:94603,quantity:2,note:before[0].note})]);
   }
   await h.sendQueued('no más, recojo en el local');
   if(h.conv.state==='awaiting_payment') await h.sendQueued('1');
   await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.items).toHaveLength(2);
   for(const item of dto.items) expect(item).toEqual(expect.objectContaining({productId:change==='price'?94602:94603,note:before[0].note}));
  });
 }
}
