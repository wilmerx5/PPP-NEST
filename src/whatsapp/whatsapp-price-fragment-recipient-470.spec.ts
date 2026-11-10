import {harness,products} from './whatsapp-accuracy.test-support';
for(const agent of [false,true])for(const price of ['De 47','De47'])it(`price is not recipient ${agent}/${price}`,async()=>{
 const h=harness(products,agent);h.conv.customerName='';
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 await h.sendQueued('Un Combo De Arroz Paisa');expect(h.conv.sessionData.cart).toHaveLength(1);
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(price);
 expect({name:h.conv.customerName,cart:h.conv.sessionData.cart,reply:h.replies.at(-1)}).toMatchObject({name:'',cart:before});
 expect(h.replies.at(-1)).not.toContain(`Con gusto, *${price}*`);
});
for(const agent of [false,true])it(`explicit recipient replaces legacy price ${agent}`,async()=>{
 const h=harness(products,agent);h.conv.customerName='De 47';
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:470,dailyOrderNumber:470});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.63,lng:-74.15}})};
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 await h.sendQueued('Un Combo De Arroz Paisa');await h.sendQueued('Bebida manzana');
 await h.sendQueued('Calle 10 #81A-20 torre 6 apto 502 a nombre de Ana Torres');
 expect(h.conv.customerName).toBe('Ana Torres');expect(h.replies.at(-1)).toContain('Ana Torres');
 expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:94,quantity:1,attributes:expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Manzana'}])})]);
 if(h.conv.state==='awaiting_payment')await h.sendQueued('transferencia');
 expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0]).toMatchObject({customerName:'Ana Torres',items:[expect.objectContaining({productId:94})]});
});

import {isUsableWhatsappCustomerName} from './whatsapp-session-intents';
for(const fragment of ['47','De 47','De47','de 42','el de 47','la de 18','47 mil','de47 mil','47 pesos','de 8','8','De 47.000','Necesito','No así no más'])it(`invalid recipient fragment ${fragment}`,()=>expect(isUsableWhatsappCustomerName(fragment)).toBe(false));
for(const name of ['María de los Ángeles','Noé García','De la Cruz','Ana María'])it(`genuine recipient ${name}`,()=>expect(isUsableWhatsappCustomerName(name)).toBe(true));

const families=[{name:'Combo De Arroz Paisa',id:94,menu:products},...['Combo Bowl Andino','Combo Ensalada Campestre'].map((name,i)=>({name,id:77000+i,menu:[{id:77000+i,code:77000+i,name,price:42000,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Manzana']}]}]}))];
function setupFamily(f:typeof families[number],agent:boolean){
 const h=harness(f.menu,agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:470,dailyOrderNumber:470});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',customer:{lat:4.63,lng:-74.15}})};
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 return h;
}
async function close(h:ReturnType<typeof harness>,id:number){
 if(h.conv.state==='building_cart')await h.sendQueued('nada mas');
 if(h.conv.state==='awaiting_payment')await h.sendQueued('transferencia');
 expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 expect(h.replies.at(-1)).toContain('Ana Torres');
 const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('confirmar');expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];
 expect(dto.customerName).toBe('Ana Torres');expect(dto.items).toEqual([expect.objectContaining({productId:id,attributes:before[0].attributes})]);
 expect(dto.address).toContain('81A');expect(dto.address).not.toContain('Ana Torres');
}
for(const f of families)for(const agent of [false,true])for(const saved of ['', 'Lucía Rojas'])for(const fragment of ['De 47','De47','de 42','el de 47','la de 18','de47 mil'])it(`price then named delivery ${f.name}/${agent}/${saved}/${fragment}`,async()=>{
 const h=setupFamily(f,agent);h.conv.customerName=saved;
 await h.sendQueued(`Un ${f.name}`);expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:f.id,quantity:1})]);
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(fragment);
 expect(h.conv.customerName).toBe(saved);expect(h.conv.sessionData.cart).toEqual(before);
 expect(h.replies.at(-1)).not.toContain(`Con gusto, *${fragment}*`);
 await h.sendQueued('Bebida manzana');expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Manzana'});
 await h.sendQueued('Calle 10 #81A-20 torre 6 apto 502 a nombre de Ana Torres');
 expect(h.conv.customerName).toBe('Ana Torres');expect(h.replies.at(-1)).toContain('Ana Torres');
 expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:f.id,quantity:1})]);
 await close(h,f.id);
});
for(const f of families)for(const agent of [false,true])for(const legacy of ['De 47','Pedro Pérez'])for(const stage of ['building_cart','awaiting_final_confirm'])for(const prefix of [false,true])it(`named address supersedes stored recipient ${f.name}/${agent}/${legacy}/${stage}/${prefix}`,async()=>{
 const h=setupFamily(f,agent);h.conv.customerName='Lucía Rojas';
 await h.sendQueued(`Un ${f.name}`);
 if(stage==='awaiting_final_confirm'){
  await h.sendQueued('Calle 12 #81A-22');await h.sendQueued('transferencia');expect(h.conv.state).toBe(stage);
 }
 // Defensive persisted-name variant; purchase and checkout prelude use the router.
 h.conv.customerName=legacy;
 const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued(prefix?'a nombre de Ana Torres, Calle 10 #81A-20 torre 6 apto 502':'Calle 10 #81A-20 torre 6 apto 502 a nombre de Ana Torres');
 expect(h.conv.customerName).toBe('Ana Torres');expect(h.conv.sessionData.cart).toEqual(before);
 expect(h.replies.at(-1)).toContain('Ana Torres');await close(h,f.id);
});
