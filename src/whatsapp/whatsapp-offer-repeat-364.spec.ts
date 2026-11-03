import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])for(const multi of [false,true])for(const question of ['Dime?','No entendí','Cómo así veci','Me repites porfa'])for(const accept of [false,true])
it(`repeat pending quote ${name} ${agent} ${multi} ${question} ${accept}`,async()=>{
 const menu=[name,'Sopa Del Dia'].map((name,i)=>({id:98501+i,code:851+i,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:364,dailyOrderNumber:364});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 await h.sendQueued(`Cuánto cuesta ${name}${multi?' y Sopa Del Dia':''}?`);expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(98501);
 const before=structuredClone(h.conv.sessionData),state=h.conv.state;
 const reply=await h.sendQueued(question);expect(reply).toContain(name);if(multi)expect(reply).toContain('Sopa Del Dia');expect(reply).toMatch(/agreg|añad/i);expect(reply).toMatch(/s[ií]/i);expect(reply).not.toMatch(/llevas anotado|pedido.*registrado|carrito vac[ií]o/i);
 expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued(accept?'sí':'no');expect(h.conv.sessionData.cart.map(l=>l.productId).sort()).toEqual(accept?(multi?[98501,98502]:[98501]):[]);
 if(accept){await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(multi?2:1);}
});
for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])it(`repeat keeps single quote quantity ${name} ${agent}`,async()=>{
 const h=harness([{id:98501,code:851,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]}],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued(`Cuánto valen 2 ${name}?`);const before=structuredClone(h.conv.sessionData);
 const reply=await h.sendQueued('Me repites porfa');expect(reply).toContain('×2');expect(h.conv.sessionData).toEqual(before);
 await h.sendQueued('sí');expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].quantity).toBe(2);
});
for(const agent of [false,true])for(const state of ['completed','closed','human','human_takeover'])it(`repeat cannot reopen closed quote ${agent} ${state}`,async()=>{
 const h=harness([{id:98501,code:851,name:'Pasta Vegetal',price:20000,availableNow:true,hasAttributes:false,attributes:[]}],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('Cuánto cuesta Pasta Vegetal?');h.conv.state=state;const before=structuredClone(h.conv.sessionData),count=h.replies.length;
 expect(await h.service.tryRepeatCheckoutQuestion(h.conv,'customer',h.conv.sessionData,'Dime?',h.cfg)).toBe(false);expect(h.conv.sessionData).toEqual(before);expect(h.replies).toHaveLength(count);
});
