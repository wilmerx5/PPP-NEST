import {harness} from './whatsapp-accuracy.test-support';
for(const dish of ['Combo De Pollo Frito','Combo De Pizza Vegetal','Combo De Ramen Miso'])
for(const agent of [false,true]) for(const query of ['Con que viene el\nCombo\n?','¿Qué incluye el combo?','¿Con qué viene acompañado el combo?']) {
 it(`${dish}: composition preserves selected drink: ${query}, agent=${agent}`,async()=>{
  const combo={id:98701,code:87,name:dish,price:23000,description:'Acompañado con papa y bebida.',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Pepsi']}]};
  const h=harness([combo],agent);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  Object.assign(h.conv.sessionData,{cart:[{productId:combo.id,code:combo.code,name:combo.name,quantity:1,unitPrice:combo.price,attributes:[{attributeName:'Bebida',attributeValue:'Pepsi'}]}],productFocus:{productId:combo.id,name:combo.name},orderType:'delivery',fulfillmentChosen:true,address:'Calle 12 #23-45',addressConfirmed:true,deliveryFeeCalculated:2000,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  const before=structuredClone(h.conv.sessionData.cart);
  const start=h.replies.length;
  await h.sendQueued(query);
  const reply=h.replies.slice(start).join('\n');
  expect(reply).toMatch(/papa|arepa/i);
  expect(reply).not.toMatch(/versiones|cambiar ese plato|Cu[aá]l prefieres para ese pedido/i);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('nada más');
  await h.sendQueued('contraentrega');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(1);
  expect(dto.items[0].attributes).toEqual([{attributeName:'Bebida',attributeValue:'Pepsi'}]);
 });
}
