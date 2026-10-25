import {harness} from './whatsapp-accuracy.test-support';
for(const dish of ['Pizza Vegetal','Bowl De Tofu','Ramen Miso'])
for(const prefix of ['Quiero dos','Dos'])
for(const agent of [false,true]) for(const details of ['Nequi de pruebas: 3000000000','']) {
 it(`${prefix} ${dish}: purchase plus transfer question, agent=${agent}, configured=${!!details}`,async()=>{
  const product={id:98701,code:87,name:dish,price:23000,description:'Preparación de la casa.',availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([product],agent);
  h.cfg.localContext={...h.cfg.localContext,transferInfoNote:details};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  await h.sendQueued(`${prefix} ${dish}\nCuánto sería para pagar por Nequi\nMe envía el número gracias`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:product.id,quantity:2});
  const reply=h.replies.join('\n');
  expect(reply).not.toMatch(/Cotizaci[oó]n|Te los agrego/i);
  expect(reply).toContain('46.000');
  expect(reply).toContain(details || 'No tengo los datos de cuenta ni el titular confirmados');
  expect(h.conv.sessionData.paymentMethod).toBeFalsy();
  expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('nada más');
  await h.sendQueued('contraentrega');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(2);
  expect(dto.items.every(item=>item.productId===product.id)).toBe(true);
 });
}
for(const agent of [false,true]) {
 it(`a quotation remains informational, agent=${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('Cotiza un arroz con pollo\nCuánto sería para pagar por Nequi\nMe envía el número gracias');
  expect(h.conv.sessionData.cart).toHaveLength(0);
 });
 it(`pending options survive the transfer inquiry, agent=${agent}`,async()=>{
  const product={id:98702,code:88,name:'Té Artesanal',price:9000,description:'Té de la casa.',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Jazmín','Oolong']}]};
  const h=harness([product],agent);
  h.cfg.localContext={transferInfoNote:'Cuenta de prueba 12345'};
  await h.sendQueued('Quiero un té artesanal\nCuánto sería para pagar por Nequi\nMe envía el número gracias');
  expect(h.replies.join('\n')).toContain('12345');
  expect(h.conv.sessionData.pendingAttribute).toBeTruthy();
  expect(h.conv.sessionData.cart).toHaveLength(0);
  await h.sendQueued('Oolong');
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Oolong'}]});
 });
}
