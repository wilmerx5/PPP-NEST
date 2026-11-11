import { harness, products } from './whatsapp-accuracy.test-support';

const destinations = [
 'Conjunto Villa Galante, Calle 10B #81F-20 torre 21 apto 442',
 'Diagonal 2b 80a-02 — Referencia de mapa: Carrera 80a #2-85',
 'Calle 6b #81b-51 Torre 4 apartamento 416',
];
const inquiries = ['Oye esa es la dirección del mapa?', '¿A dónde va a llegar mi pedido?',
 'No, yo qué pena, es que esa dirección que tú me mandas donde va a llegar el domicilio no es, es la que te envié.'];
function setup(address:string,agent:boolean,state:string) {
 const h=harness(products,agent);
 Object.assign(h.cfg.localContext,{restaurantName:'Local de prueba',restaurantAddress:'Avenida del Local 900',restaurantMapsUrl:'https://example.com/local'});
 Object.assign(h.conv.sessionData,{orderType:'delivery',address,addressConfirmed:true,deliveryLat:4.6,deliveryLng:-74.1,deliveryFeeCalculated:2000,
  cart:[{productId:2,code:2,name:'1/2 Pollo Frito',quantity:1,unitPrice:25000,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]}]});
 h.conv.state=state;
 h.service.conversationService.reopenForNewOrder=jest.fn().mockResolvedValue(h.conv);
 h.service.ordersService.create=jest.fn();
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 return h;
}
for(const address of destinations)for(const agent of [false,true])for(const state of ['completed','closed']) {
 for(const text of inquiries)it(`customer destination with access follow-up ${address}/${agent}/${state}/${text}`,async()=>{
  const h=setup(address,agent,state),before=structuredClone(h.conv.sessionData);
  await h.sendQueued(text);
  expect(h.replies.at(-1)).toMatch(/destino|domicilio/i);expect(h.replies.at(-1)).not.toContain('Avenida del Local 900');
  expect(h.replies.at(-1)).toMatch(/no (?:he )?(?:cambi|modifi)/i);
  expect(h.conv.state).toBe(state);expect(h.conv.sessionData).toEqual(before);
  expect(h.service.conversationService.reopenForNewOrder).not.toHaveBeenCalled();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.replies.at(-1)).toContain(address);
 });
}
