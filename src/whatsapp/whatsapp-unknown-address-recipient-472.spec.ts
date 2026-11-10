import {harness} from './whatsapp-accuracy.test-support';
for(const agent of [false,true])for(const saved of ['', 'Lucía Rojas'])it(`unknown recipient role ${agent}/${saved}`,async()=>{
 const h=harness([{id:77201,code:77201,name:'Bowl Andino',price:20000,attributes:[],hasAttributes:false}],agent);h.conv.customerName=saved;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.63,lng:-74.15}})};
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:472,dailyOrderNumber:472});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true});
 await h.sendQueued('Un Bowl Andino');const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('Calle 10 #81A-20 torre 6 apto 502 Ana Torres 3000000002');
 expect({label:h.conv.sessionData.pendingRecipientOrPlace,reply:h.replies.at(-1)}).toMatchObject({label:'Ana Torres',reply:expect.stringMatching(/nombre.*referencia|nombre.*conjunto/i)});
 expect(h.conv.customerName).toBe(saved);expect(h.conv.sessionData.cart).toEqual(before);
 expect(h.conv.sessionData.address).not.toContain('Ana Torres');expect(h.conv.sessionData.address).toContain('502');
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('es mi nombre');expect(h.conv.customerName).toBe('Ana Torres');expect(h.conv.sessionData.pendingRecipientOrPlace).toBeFalsy();
 if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Ana Torres');expect(dto.address).not.toContain('Ana Torres');expect(dto.phone.replace(/\D/g,'').slice(-10)).toBe('3000000002');
});

const families=[{dish:'Arroz Con Pollo',label:'Ana Torres'},{dish:'Bowl Andino',label:'Juliana'},{dish:'Ensalada Campestre',label:'María del Pilar'}];
function setup(f:typeof families[number],agent:boolean){
 const h=harness([{id:77210,code:77210,name:f.dish,price:20000,attributes:[],hasAttributes:false}],agent);h.conv.customerName='Lucía Rojas';
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.63,lng:-74.15}})};
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:472,dailyOrderNumber:472});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164});return h;
}
async function purchase(h:ReturnType<typeof harness>,f:typeof families[number],stage='building_cart'){
 await h.sendQueued(`2 ${f.dish}`);expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:77210,quantity:2})]);
 if(stage==='awaiting_address'){await h.sendQueued('nada mas');expect(h.conv.state).toBe(stage);}
 if(stage==='awaiting_final_confirm'){await h.sendQueued('Calle 12 #81A-22');await h.sendQueued('contraentrega');expect(h.conv.state).toBe(stage);}
}
async function close(h:ReturnType<typeof harness>,name:string){
 if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
 expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe(name);expect(dto.phone.replace(/\D/g,'').slice(-10)).toBe('3000000002');
 expect(dto.items).toEqual([expect.objectContaining({productId:77210}),expect.objectContaining({productId:77210})]);expect(dto.address).toContain('81A-20');expect(dto.address).toMatch(/torre 6.*apto 502/i);return dto;
}
for(const f of families)for(const agent of [false,true])for(const saved of ['', 'Carlos Pérez'])for(const form of ['before','after'])for(const role of ['name','place'])for(const stage of ['building_cart','awaiting_address','awaiting_final_confirm'])for(const prefix of ['', 'Sí, porfa '])it(`clarify address role ${f.dish}/${agent}/${saved}/${form}/${role}/${stage}/${prefix}`,async()=>{
 const h=setup(f,agent);await purchase(h,f,stage);
 // Persisted-name variants are defensive; all purchase/checkout steps use the router.
 h.conv.customerName=saved;h.service.deliveryRouting.quoteDeliveryFee.mockClear();
 const before=structuredClone(h.conv.sessionData.cart);
 const contact=form==='before'?`${f.label} celular 3000000002`:`+57 300 000 0002 ${f.label}`;
 await h.sendQueued(`${prefix}Calle 10 #81A-20 torre 6 apto 502 ${contact}`);
 expect(h.conv.sessionData.pendingRecipientOrPlace).toBe(f.label);expect(h.conv.customerName).toBe(saved);expect(h.conv.sessionData.cart).toEqual(before);
 expect(h.conv.sessionData.address).toMatch(/torre 6.*apto 502/i);expect(h.conv.sessionData.address).not.toContain(f.label);
 expect(h.conv.sessionData.address).not.toMatch(/celular|300.?000.?0002|\+57|s[ií],? porfa/i);
 expect(h.replies.at(-1)).toMatch(/nombre.*referencia/i);expect((h.replies.at(-1)!.match(/\?/g)||[])).toHaveLength(1);
 expect(h.replies.at(-1)).not.toMatch(/algo m[aá]s|c[oó]mo pagas/i);expect(h.service.deliveryRouting.quoteDeliveryFee).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.pendingRecipientOrPlace).toBe(f.label);
 await h.sendQueued(role==='name'?'es mi nombre':'es una referencia');expect(h.conv.sessionData.pendingRecipientOrPlace).toBeFalsy();
 let name=role==='name'?f.label:saved;
 if(role==='place'&&!saved){expect(h.conv.state).toBe('awaiting_name');await h.sendQueued('me llamo Luis Gómez');name='Luis Gómez';}
 expect(h.conv.customerName).toBe(name);expect(h.conv.sessionData.cart).toEqual(before);
 if(role==='place')expect(h.conv.sessionData.address).toContain(f.label);else expect(h.conv.sessionData.address).not.toContain(f.label);
 const dto=await close(h,name);if(role==='place')expect(dto.address).toContain(f.label);else expect(dto.address).not.toContain(f.label);
});
for(const f of families)for(const agent of [false,true])for(const action of ['payment','cancel'])it(`role interruption ${f.dish}/${agent}/${action}`,async()=>{
 const h=setup(f,agent);await purchase(h,f);const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued(`Calle 10 #81A-20 torre 6 apto 502 ${f.label} 3000000002`);expect(h.conv.sessionData.pendingRecipientOrPlace).toBe(f.label);
 if(action==='cancel'){
  await h.sendQueued('cancelar pedido');expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingRecipientOrPlace).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 }else{
  await h.sendQueued('pago por nequi');expect(h.conv.sessionData.pendingRecipientOrPlace).toBe(f.label);expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.paymentMethod).toMatch(/transfer/);await h.sendQueued('es mi nombre');const dto=await close(h,f.label);expect(dto.address).toMatch(/transferencia/i);
 }
});
for(const scenario of ['known','explicit','reference','two-phones','question','no-phone','catalog','completed','closed','human','empty','pending','mixed'])it(`excluded role envelope ${scenario}`,async()=>{
 const f=families[1],h=setup(f,false);await purchase(h,f);
 let text='Calle 10 #81A-20 torre 6 apto 502 Ana Torres 3000000002';
 if(scenario==='known')h.conv.customerName='Ana Torres';
 if(scenario==='explicit')text='Calle 10 #81A-20 a nombre de Ana Torres 3000000002';
 if(scenario==='reference')text='Calle 10 #81A-20 Frente a puerta azul 3000000002';
 if(scenario==='two-phones')text+=' 3000000003';
 if(scenario==='question')text+='?';
 if(scenario==='no-phone')text='Calle 10 #81A-20 torre 6 apto 502 Ana Torres';
 if(scenario==='mixed')text='Calle 10 #81A-20 torre 6 apto 502 3000000002 Ana Torres y dos postres';
 if(scenario==='catalog')text='Calle 10 #81A-20 torre 6 apto 502 Bowl Andino 3000000002';
 if(['completed','closed','human'].includes(scenario))h.conv.state=scenario==='human'?'human_takeover':scenario;
 if(scenario==='empty')h.conv.sessionData.cart=[];
 if(scenario==='pending')h.conv.sessionData.pendingAttribute={productId:77210,name:f.dish,code:77210,price:20000,quantity:2,attributes:[],selected:[]};
 const before=structuredClone(h.conv.sessionData),name=h.conv.customerName,count=h.replies.length;
 expect(await h.service.tryClarifyUnknownRecipientEnvelope(h.conv,'customer',text)).toBe(false);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe(name);expect(h.replies).toHaveLength(count);
});
for(const agent of [false,true])for(const role of ['nombre','destinatario','referencia','barrio','conjunto'])it(`brief role answer ${agent}/${role}`,async()=>{
 const f=families[0],h=setup(f,agent);await purchase(h,f);const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('Calle 10 #81A-20 torre 6 apto 502 Ana Torres 3000000002');expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Ana Torres');
 await h.sendQueued(role);expect(h.conv.sessionData.pendingRecipientOrPlace).toBeFalsy();expect(h.conv.sessionData.cart).toEqual(before);
 const dto=await close(h,['nombre','destinatario'].includes(role)?'Ana Torres':'Lucía Rojas');
 if(!['nombre','destinatario'].includes(role))expect(dto.address).toContain('Ana Torres');else expect(dto.address).not.toContain('Ana Torres');
});
for(const f of families)for(const agent of [false,true])for(const known of [false,true])for(const field of ['mi teléfono','mi celular es','número:'])it(`personal phone field ${f.dish}/${agent}/${known}/${field}`,async()=>{
 const h=setup(f,agent);await purchase(h,f);const before=structuredClone(h.conv.sessionData.cart);
 const label=known?'Lucía Rojas':f.label;
 await h.sendQueued(`Calle 10 #81A-20 torre 6 apto 502 ${label} ${field} 3000000002`);
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.address).not.toContain(label);expect(h.conv.sessionData.address).not.toMatch(/mi tel|mi cel|n[uú]mero|3000000002/i);
 if(!known){expect(h.conv.sessionData.pendingRecipientOrPlace).toBe(label);await h.sendQueued('nombre');}else expect(h.conv.sessionData.pendingRecipientOrPlace).toBeFalsy();
 const dto=await close(h,label);expect(dto.address).not.toContain(label);
});
