import {harness,products} from './whatsapp-accuracy.test-support';
function setup(agent:boolean,state:string){
 const h=harness(structuredClone(products),agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Algo más?',actions:{}});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:388,dailyOrderNumber:388});
 h.conv.state=state;
 Object.assign(h.conv.sessionData,{cart:[{productId:23,code:23,name:'Arroz Con Pollo',quantity:1,unitPrice:29500}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,deliveryFeeCalculated:2000,notesCollected:true,paymentMethod:'contraentrega'});
 if(state==='awaiting_name')h.conv.customerName='';
 if(state==='awaiting_phone')Object.assign(h.conv.sessionData,{phoneConfirmed:false,contactPhone:undefined});
 if(state==='awaiting_payment')h.conv.sessionData.paymentMethod=undefined;
 return h;
}
for(const agent of [false,true])for(const [state,next] of [['awaiting_name',/nombre/i],['awaiting_phone',/contacto|tel[eé]fono/i],['awaiting_payment',/pago|pagas/i],['awaiting_final_confirm',/confirmar/i]] as const)for(const text of ['Cuánto se demora mi pedido?','Ya salió mi pedido?'])it(`${state} ${agent} ${text}`,async()=>{
 const h=setup(agent,state);const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(text);
 expect(reply).toMatch(/aún no|todav[ií]a no|sin confirmar/i);expect(reply).toMatch(next);expect(reply).not.toMatch(/n[uú]mero de orden|algo m[aá]s/i);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])it(`labelled name in address burst ${agent}`,async()=>{
 const h=setup(agent,'awaiting_address');h.conv.customerName='';h.conv.sessionData.address=undefined;h.conv.sessionData.addressConfirmed=false;
 await h.sendQueued('Carrera 80 b #2-12\nCasa\nNombre: Carolina\n3001234567');
 expect(h.conv.customerName).toBe('Carolina');expect(h.conv.sessionData.address).not.toMatch(/Carolina|Nombre|3001234567/i);expect(h.conv.sessionData.contactPhone).toMatch(/3001234567/);
});

for(const agent of [false,true])for(const role of ['Es mi nombre','Es la referencia'])it(`ambiguous house/name needs role ${agent}/${role}`,async()=>{
 const h=setup(agent,'awaiting_address');h.conv.customerName='';h.conv.sessionData.address=undefined;h.conv.sessionData.addressConfirmed=false;
 const before=structuredClone(h.conv.sessionData.cart);
 const reply=await h.sendQueued('Carrera 80 b #2-12\nCasa\nCarolina\n3001234567');
 expect(reply).toMatch(/nombre.*referencia/i);expect(h.conv.customerName).toBe('');expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Carolina');expect(h.conv.sessionData.address).not.toMatch(/Carolina/);expect(h.conv.sessionData.cart).toEqual(before);
 await h.sendQueued(role);expect(h.conv.sessionData.pendingRecipientOrPlace).toBeUndefined();
 if(role==='Es mi nombre')expect(h.conv.customerName).toBe('Carolina');else {expect(h.conv.customerName).toBe('');await h.sendQueued('Ana Gomez');}
 await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
});
for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_payment','awaiting_final_confirm'])it(`interruption resumes and closes once ${agent}/${state}`,async()=>{
 const h=setup(agent,state);await h.sendQueued('Ya salió mi pedido?');
 if(state==='awaiting_name')await h.sendQueued('Ana Gomez');
 if(state==='awaiting_phone')await h.sendQueued('3001234567');
 if(state==='awaiting_payment')await h.sendQueued('contraentrega');
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
});
for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_payment','awaiting_final_confirm'])it(`active registered order retains tracking ${agent}/${state}`,async()=>{
 const h=setup(agent,state);h.service.ordersService.findTodayOrdersByPhone.mockResolvedValue([{id:99,dailyOrderNumber:99,orderStatus:'cooking'}]);const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Ya salió mi pedido?');expect(reply).toContain('#99');expect(reply).not.toMatch(/todav[ií]a no/);expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])for(const label of ['Nombre: Celeste Rios','Me llamo Celeste Rios','A nombre de Celeste Rios'])it(`other catalog labelled address ${agent}/${label}`,async()=>{
 const h=setup(agent,'awaiting_address');h.conv.customerName='';
 const dish={id:98801,code:98801,name:'Bowl De Garbanzos',price:21000,attributes:[],availableNow:true};
 h.service.catalogService.getMenuProducts=jest.fn().mockResolvedValue([dish]);
 h.conv.sessionData.cart=[{productId:dish.id,code:dish.code,name:dish.name,unitPrice:dish.price,quantity:2,note:'sin cebolla'}];
 await h.sendQueued(`Calle 20 #30-40\nLocal\n${label}\n3001234567`);expect(h.conv.customerName).toBe('Celeste Rios');expect(h.conv.sessionData.address).not.toMatch(/Celeste|nombre|llamo/i);
 await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.every(item=>item.productId===dish.id&&item.note==='sin cebolla')).toBe(true);expect(dto.customerName).toBe('Celeste Rios');expect(dto.phone.replace(/\D/g,'')).toContain('3001234567');
});
for(const agent of [false,true])it(`totals and cancellation still work during checkout ${agent}`,async()=>{const h=setup(agent,'awaiting_final_confirm');const reply=await h.sendQueued('cuánto suma mi pedido');expect(reply).toMatch(/31[.,]500/);await h.sendQueued('quiero cancelar el pedido');expect(h.conv.sessionData.cart).toHaveLength(0);expect(h.service.ordersService.create).not.toHaveBeenCalled();});

for(const agent of [false,true])for(const text of ['Sí confirmo el pedido. ¿Cuánto tarda?','Confirmar. ¿Cuánto se demora?','Lo confirmo. ¿Cuánto tarda?'])it(`approval plus ETA closes once ${agent}/${text}`,async()=>{const h=setup(agent,'awaiting_final_confirm');await h.sendQueued(text);expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');});

for(const agent of [false,true])for(const text of ['Un pollo frito. ¿Cuánto tarda?','¿Cuánto tarda? Un pollo frito'])it(`purchase plus ETA keeps both intents ${agent}/${text}`,async()=>{
 const h=setup(agent,'awaiting_final_confirm');const reply=await h.sendQueued(text);
 expect(reply).toMatch(/después de confirmar/i);expect(reply).toMatch(/35.*45/);expect(h.conv.sessionData.cart).toHaveLength(2);expect(h.conv.sessionData.cart.find(item=>item.productId===1)?.quantity).toBe(1);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);
});
for(const agent of [false,true])it(`synthetic purchase plus ETA ${agent}`,async()=>{
 const h=setup(agent,'awaiting_final_confirm');const dish={id:98802,code:98802,name:'Bowl De Garbanzos',price:21000,attributes:[],availableNow:true};h.service.catalogService.getMenuProducts=jest.fn().mockResolvedValue([...structuredClone(products),dish]);
 const reply=await h.sendQueued('Dos bowl de garbanzos. ¿Cuánto tarda?');expect(reply).toMatch(/después de confirmar/i);expect(h.conv.sessionData.cart.find(item=>item.productId===dish.id)?.quantity).toBe(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items.filter(item=>item.productId===dish.id)).toHaveLength(2);
});
