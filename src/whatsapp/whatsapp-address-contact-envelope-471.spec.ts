import {harness} from './whatsapp-accuracy.test-support';
for(const agent of [false,true])for(const text of [
 'Si porfa Diagonal 6D bis #78B-50 celular 3000000002 Ana Torres',
 'Calle 6B #81B-51 Torre 4 apartamento 416 Ana Torres 3000000002',
])it(`delivery contact envelope ${agent}/${text}`,async()=>{
 const h=harness([{id:77101,code:77101,name:'Bowl Andino',price:20000,attributes:[],hasAttributes:false}],agent);
 h.conv.customerName='Ana Torres';
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.63,lng:-74.15}})};
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:471,dailyOrderNumber:471});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true});
 await h.sendQueued('Un Bowl Andino');await h.sendQueued('nada mas');await h.sendQueued(text);
 expect(h.conv.sessionData.address).not.toMatch(/s[ií][,\s]*porfa|Ana Torres|3000000002|celular/i);
 expect(h.conv.sessionData.address).toMatch(/(?:78B-50|81B-51)/);expect(h.conv.customerName).toBe('Ana Torres');
 expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3000000002');
 expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:77101,quantity:1})]);
 if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
 expect(h.conv.state).toBe('awaiting_final_confirm');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Ana Torres');expect(dto.address).not.toMatch(/s[ií][,\s]*porfa|Ana Torres|3000000002|celular/i);
});

const families=[{dish:'Arroz Con Pollo',recipient:'Ana Torres'},{dish:'Bowl Andino',recipient:'María del Pilar'},{dish:'Ensalada Campestre',recipient:'Lucía Rojas'}];
function setup(f:typeof families[number],agent:boolean){
 const h=harness([{id:77110,code:77110,name:f.dish,price:20000,attributes:[],hasAttributes:false}],agent);h.conv.customerName=f.recipient;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.63,lng:-74.15}})};
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:471,dailyOrderNumber:471});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,notesCollected:true});return h;
}
async function close(h:ReturnType<typeof harness>,f:typeof families[number]){
 if(h.conv.state==='building_cart')await h.sendQueued('nada mas');
 if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
 expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 expect(h.replies.at(-1)).toMatch(/confirmar/i);
 await h.sendQueued('confirmar');expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe(f.recipient);expect(dto.phone.replace(/\D/g,'').slice(-10)).toBe('3000000002');
 expect(dto.items).toEqual([expect.objectContaining({productId:77110})]);return dto;
}
for(const f of families)for(const agent of [false,true])for(const stage of ['building_cart','awaiting_address','awaiting_final_confirm'])for(const form of ['after','before','before-label','international'])for(const prefix of ['','Si porfa ','Claro, ','Sí, porfa ','Sí,porfa '])it(`known contact address ${f.dish}/${agent}/${stage}/${form}/${prefix}`,async()=>{
 const h=setup(f,agent);await h.sendQueued(`Un ${f.dish}`);
 if(stage==='awaiting_address')await h.sendQueued('nada mas');
 if(stage==='awaiting_final_confirm'){
  await h.sendQueued('Calle 12 #81A-22');
  if(h.conv.state==='awaiting_phone')await h.sendQueued('3000000001');
  await h.sendQueued('contraentrega');expect(h.conv.state).toBe(stage);
 }
 const before=structuredClone(h.conv.sessionData.cart);
 const name=form==='international'?f.recipient.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase():f.recipient;
 const contact=form==='after'?`celular 3000000002 ${name}`:form==='before'?`${name} 3000000002`:form==='before-label'?`${name} celular 3000000002`:`+57 300 000 0002 ${name}`;
 await h.sendQueued(`${prefix}Calle 10 #81A-20 torre 6 apto 502 ${contact}`);
 const address=h.conv.sessionData.address!;
 expect(address).toMatch(/Calle 10 #81A-20/i);expect(address).toMatch(/torre 6.*apto 502/i);
 expect(address.toLowerCase()).not.toMatch(/s[ií][,\s]*porfa|claro|celular|300.?000.?0002|\+57/);
 expect(address.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()).not.toContain(f.recipient.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
 expect(h.conv.customerName).toBe(f.recipient);expect(h.conv.sessionData.cart).toEqual(before);
 expect(h.replies.at(-1)).toContain('81A-20');
 const dto=await close(h,f);expect(dto.address.toLowerCase()).toContain(address.toLowerCase());expect(dto.address).not.toMatch(/s[ií][,\s]*porfa|claro|celular|300.?000.?0002|\+57/i);
});
for(const f of families)for(const agent of [false,true])for(const place of ['Conjunto','Edificio','Barrio','Frente a'])it(`preserve labelled place ${f.dish}/${agent}/${place}`,async()=>{
 const h=setup(f,agent);await h.sendQueued(`Un ${f.dish}`);
 await h.sendQueued(`Calle 10 #81A-20 ${place} ${f.recipient} torre 6 apto 502 3000000002`);
 expect(h.conv.sessionData.address).toContain(`${place} ${f.recipient}`);expect(h.conv.sessionData.address).toMatch(/torre 6.*apto 502/i);
 const dto=await close(h,f);expect(dto.address).toContain(`${place} ${f.recipient}`);
});
for(const text of ['Calle 10 #81A-20 torre 6 apto 502 Otra Persona 3000000002','Calle 10 #81A-20 torre 6 apto 502 Ana Torres','Calle 10 #81A-20 torre 6 apto 502 Ana Torres 3000000002 3000000003','¿Si porfa Calle 10 #81A-20 Ana Torres 3000000002?'])it(`uncertain envelope unchanged ${text}`,async()=>{
 const h=setup(families[0],false);await h.sendQueued('Un Arroz Con Pollo');expect(await h.service.captureKnownRecipientAddressEnvelope(text,h.conv)).toBe(text);
});
for(const state of ['completed','closed','human_takeover'])it(`inactive envelope untouched ${state}`,async()=>{
 const h=setup(families[0],false);await h.sendQueued('Un Arroz Con Pollo');h.conv.state=state;
 const text='Si porfa Calle 10 #81A-20 Ana Torres 3000000002';expect(await h.service.captureKnownRecipientAddressEnvelope(text,h.conv)).toBe(text);
});
it('empty-cart envelope untouched',async()=>{
 const h=setup(families[0],false),text='Si porfa Calle 10 #81A-20 Ana Torres 3000000002';expect(await h.service.captureKnownRecipientAddressEnvelope(text,h.conv)).toBe(text);
});
for(const name of ['Conjunto Los Cedros','Edificio Las Palmas','Barrio Santa Ana','Torres de Castelló'])it(`saved place profile stays in address ${name}`,async()=>{
 const h=setup(families[0],false);await h.sendQueued('Un Arroz Con Pollo');h.conv.customerName=name;
 const text=`Calle 10 #81A-20 ${name} 3000000002`,before=structuredClone(h.conv.sessionData);
 expect(await h.service.captureKnownRecipientAddressEnvelope(text,h.conv)).toBe(text);expect(h.conv.sessionData).toEqual(before);
});
