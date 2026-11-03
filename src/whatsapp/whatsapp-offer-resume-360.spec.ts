import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])for(const occupied of [false])for(const question of ['Manejan datáfono?','¿Puedo pagar con tarjeta?','Reciben efectivo?'])for(const accept of [false,true])
it(`quoted offer after question ${name} ${agent} ${occupied} ${question} ${accept}`,async()=>{
 const menu=[{id:98001,code:801,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]},{id:98002,code:802,name:'Sopa Del Dia',price:10000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:360,dailyOrderNumber:360});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 if(occupied)await h.sendQueued('Quiero una Sopa Del Dia');
 await h.sendQueued(`Cuánto cuesta ${name}?`);
 expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(98001);
 const before=structuredClone(h.conv.sessionData.cart),offer=structuredClone(h.conv.sessionData.pendingAddOffer),state=h.conv.state;
 const reply=await h.sendQueued(question);
 expect(reply).toContain(name);expect(reply).toMatch(/agreg|añad/i);expect(reply).toMatch(/s[ií]/i);
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAddOffer).toEqual(offer);expect(h.conv.state).toBe(state);
 await h.sendQueued(accept?'sí':'no');
 expect(h.conv.sessionData.cart.filter(l=>l.productId===98001).reduce((n,l)=>n+l.quantity,0)).toBe(accept?1:0);
 expect(h.conv.sessionData.cart.filter(l=>l.productId===98002)).toEqual(before);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(accept){await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(occupied?2:1);expect(dto.items.filter(i=>i.productId===98001)).toHaveLength(1);}
});
for(const agent of [false,true])for(const accept of [false,true])it(`multi quote reminder and decision ${agent} ${accept}`,async()=>{
 const menu=['Bowl Vegetal','Sopa Del Dia'].map((name,i)=>({id:98101+i,code:811+i,name,price:10000,availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('Cuánto cuesta Bowl Vegetal y Sopa Del Dia?');
 expect(h.conv.sessionData.pendingAddOffer?.productIds).toHaveLength(2);
 const before=structuredClone(h.conv.sessionData);
 const reply=await h.sendQueued('Manejan datáfono?');
 expect(reply).toMatch(/productos de la cotización anterior/i);expect(reply).toMatch(/agregar lo cotizado/i);expect(h.conv.sessionData).toEqual(before);
 await h.sendQueued(accept?'sí':'no');expect(h.conv.sessionData.cart.map(l=>l.productId).sort()).toEqual(accept?[98101,98102]:[]);
});
