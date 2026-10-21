import {harness} from './whatsapp-accuracy.test-support';

for(const dish of ['Bowl Mediterraneo','Pescado Al Horno','Churrasco']) for(const enabled of [false,true]) for(const scenario of ['contact','address']) {
 it(`${dish}: complete inquiry and ${scenario} correction, agent=${enabled}`,async()=>{
  const menu=[{id:98101,code:811,name:dish,description:'Acompañado con arroz y ensalada',price:24000,availableNow:true,attributes:[]}];
  const h=harness(menu,enabled);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:981,dailyOrderNumber:101});
  h.cfg.paymentMethods=h.cfg.paymentMethods.map(method=>({...method,enabled:method.flow!=='mercadopago'}));
  expect(await h.sendQueued('Hola buenas tardes tienes la carta por favor')).not.toMatch(/no tenemos productos/i);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(await h.sendQueued(`Cuánto cuesta ${dish}?`)).toContain('24.000');
  expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued(`Dame dos ${dish} sin ensalada`);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:98101,quantity:2,note:expect.stringMatching(/sin ensalada/i)})]);
  await h.sendQueued('Para domicilio\nCarlos Torres\n3000000006\nCalle 10 #81A-20\nTorre 4 apto 505');
  expect(h.conv.state).toBe('awaiting_payment');
  const before=structuredClone(h.conv.sessionData.cart);
  const content=await h.sendQueued('Qué trae ese plato?');
  expect(content).toMatch(/arroz/i);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.state).toBe('awaiting_payment');
  if(scenario==='contact'){
   const ack=await h.sendQueued('a nombre de Ana Rivera, teléfono: 300 111 2233');
   expect(ack).toMatch(/Ana Rivera/i);
   expect((ack || '').replace(/[^0-9]/g,'')).toContain('3001112233');
  }else{
   const ack=await h.sendQueued('Cambia la dirección a Calle 12 #34-56 apartamento 302');
   expect(ack).toContain('302');
  }
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.state).toBe('awaiting_payment');
  const price=await h.sendQueued('Cuánto cuesta el pedido?');
  expect(price).toMatch(/48.000|50.000/);
  await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  const timing=await h.sendQueued('Cuánto tarda en llegar el pedido?');
  expect(timing).not.toMatch(/no tenemos productos|de cuál producto.*precio/i);
  expect(timing).toMatch(/tiempo|minutos|demora|tarda|estimad|confirmad/i);
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(2);
  expect(dto.items.every(item=>item.productId===98101&&/sin ensalada/i.test(item.note))).toBe(true);
  expect(dto.customerName).toBe(scenario==='contact'?'Ana Rivera':'Carlos Torres');
  expect(dto.phone.replace(/\D/g,'')).toContain(scenario==='contact'?'3001112233':'3000000006');
  expect(dto.address).toContain(scenario==='address'?'302':'505');
  await h.sendQueued('Gracias');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 });
}
