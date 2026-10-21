import { harness } from './whatsapp-accuracy.test-support';

for (const [dish, description] of [['Bowl De Lentejas','Con arroz y ensalada'], ['Pizza Vegetal','Con tomate y champiñones'], ['Pescado Al Horno','Con papa y zanahoria']]) {
 for (const enabled of [false,true]) for (const state of ['awaiting_payment','awaiting_final_confirm']) for (const scenario of ['contentsName','etaPhone','etaAddress']) for (const questionFirst of [false,true]) {
  it(`${dish}: ${scenario}, ${state}, questionFirst=${questionFirst}, agent=${enabled}`,async()=>{
   const h=harness([{id:99301,code:99301,name:dish,description,price:24000,availableNow:true,attributes:[]}],enabled);
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:9930,dailyOrderNumber:102});
   h.cfg.paymentMethods=h.cfg.paymentMethods.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
   await h.sendQueued(`Quiero un ${dish} sin cebolla`);
   const cart=structuredClone(h.conv.sessionData.cart);
   expect(cart).toHaveLength(1);
   h.conv.state=state;
   Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,contactPhone:'3000000006',phoneConfirmed:true,notesCollected:true,deliveryFeeCalculated:2000,paymentMethod:state==='awaiting_final_confirm'?'cash':undefined});
   const question=scenario==='contentsName'?`¿Qué trae el ${dish}?`:'¿Cuánto tarda el domicilio?';
   const change=scenario==='contentsName'?'A nombre de Ana Martinez.':scenario==='etaPhone'?'Mi teléfono es 3000000007.':'Cambia la dirección a Calle 12 #34-56 apartamento 302.';
   const replyStart=h.replies.length;
   await h.sendQueued(questionFirst?`${question} ${change}`:`${change} ${question}`);
   const reply=h.replies.slice(replyStart).join('\n');
   expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if(scenario==='contentsName') {
    expect(reply).toContain(description);
    expect(h.conv.customerName).toBe('Ana Martinez');
   } else {
    expect(reply).toMatch(/suele demorar|minutos|tiempo.*(?:confirm|estimad)/i);
    if(scenario==='etaPhone') expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3000000007');
    else expect(h.conv.sessionData.address).toMatch(/12.*34.?56.*302/i);
   }
   expect(h.conv.state).toBe(state);
   expect(reply).toMatch(state==='awaiting_payment'?/paga|pago|contraentrega/i:/confirmar/i);
   if(state==='awaiting_payment')await h.sendQueued('contraentrega');
   await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.items).toHaveLength(1);
   expect(dto.items[0]).toMatchObject({productId:99301,note:expect.stringMatching(/sin cebolla/i)});
   expect(dto.customerName).toBe(scenario==='contentsName'?'Ana Martinez':'Wilmer');
   expect(dto.phone.replace(/\D/g,'')).toContain(scenario==='etaPhone'?'3000000007':'3000000006');
   expect(dto.address).toMatch(scenario==='etaAddress'?/302/:/20.?30/);
  });
 }
}
