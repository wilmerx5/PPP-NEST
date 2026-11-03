import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])for(const multi of [false,true])for(const question of ['Me pasas el menú porfa','Me compartes la carta','Cuánto se demora el domicilio?','Cuánto tarda la entrega?'])for(const accept of [false,true])
it(`pending quote info ${name} ${agent} ${multi} ${question} ${accept}`,async()=>{
 const menu=[name,'Sopa Del Dia'].map((name,i)=>({id:98201+i,code:821+i,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.cfg.menuUrl='https://example.test/menu';h.cfg.localContext={deliveryTimeNote:'25-35 minutos'};
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:361,dailyOrderNumber:361});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 await h.sendQueued(`Cuánto cuesta ${name}${multi?' y Sopa Del Dia':''}?`);
 expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(98201);if(multi)expect(h.conv.sessionData.pendingAddOffer?.productIds).toHaveLength(2);
 const before=structuredClone(h.conv.sessionData),state=h.conv.state;
 const reply=await h.sendQueued(question);
 expect(reply).toContain(question.includes('domicilio')||question.includes('entrega')?'25-35':'https://example.test/menu');
 expect(reply).toContain(multi?'productos de la cotización anterior':name);expect(reply).toMatch(/agregar lo cotizado/i);
 expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued(accept?'sí':'no');expect(h.conv.sessionData.cart.map(l=>l.productId).sort()).toEqual(accept?(multi?[98201,98202]:[98201]):[]);
 if(accept){await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items.map(i=>i.productId).sort()).toEqual(multi?[98201,98202]:[98201]);}
});
// Mixed actions and order-specific follow-ups must keep their own routing.
import {isStandaloneDeliveryEtaInquiry} from './whatsapp-session-intents';
for(const text of ['Cuánto tarda la entrega y agrega una sopa','Confirma y dime cuánto tarda la entrega','Cuánto tarda mi pedido','Cuándo llega la orden #20','Si tarda poco agrega una sopa','Cuánto cuesta la entrega','Cuánto tarda la entrega, Calle 10 #20-30','Cuánto tarda la entrega y cuánto vale'])
it(`ETA remains read-only ${text}`,()=>expect(isStandaloneDeliveryEtaInquiry(text)).toBe(false));
