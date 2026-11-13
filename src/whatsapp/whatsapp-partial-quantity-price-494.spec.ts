import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const quantity of [1,2,3]) for(const order of ['quantityFirst','priceFirst']) {
 test(`${name}/${agent}/${quantity}/${order}: quantity and price share the staged distribution`,async()=>{
  const h=harness([
   {id:94941,code:81,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
   {id:94942,code:82,name:'Sopa Vegetal',price:10000,availableNow:true,attributes:[]}
  ],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:494,dailyOrderNumber:494});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('quiero una Sopa Vegetal');await h.sendQueued(`quiero cuatro ${name}`);
  await h.sendQueued('dos con mango');
  const cart=structuredClone(h.conv.sessionData.cart);
  const instruction=`deja ${quantity} ${name}`;
  const reply=await h.sendQueued(order==='quantityFirst'?`${instruction}, cuanto cuesta`:`cuanto cuesta; ${instruction}`);
  expect(reply).toMatch(/9[.,]000/);
  if(quantity===1){
   expect(reply).toMatch(/reparto anterior/);
   expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(1);
   expect(h.conv.sessionData.pendingAttribute?.distributionParts?.length || 0).toBe(0);
   expect(h.conv.sessionData.cart).toEqual(cart);
   await h.sendQueued('lulo');
  }else if(quantity===2){
   expect(reply).toMatch(/Repartí 2/);
  }else{
   expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(3);
   expect(h.conv.sessionData.pendingAttribute?.distributionParts).toEqual(['2 con mango']);
   expect(h.conv.sessionData.cart).toEqual(cart);
   await h.sendQueued('los otros con lulo');
  }
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  expect(h.cartRows().find(row=>row.id===94942)?.qty).toBe(1);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.replies.at(-1)).toContain((10000+quantity*9000).toLocaleString('es-CO'));
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(quantity+1);
  const mango=quantity===1?0:2;
  for(const [flavor,count] of [['Mango',mango],['Lulo',quantity-mango]] as const) expect(items.filter((item:any)=>item.productId===94941&&item.attributes.some((a:any)=>a.attributeName==='Sabor'&&a.attributeValue===flavor))).toHaveLength(count);
 });
}
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const guard of ['ambiguous','zero','over30']) {
 test(`${name}/${agent}/${guard}: unsafe quantity-price request preserves staged purchase`,async()=>{
  const h=harness([{id:94943,code:83,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]}],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:494,dailyOrderNumber:494});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  if(guard==='ambiguous')await h.sendQueued(`quiero un ${name} con mango`);
  await h.sendQueued(`quiero cuatro ${name}`);await h.sendQueued('dos con mango');
  const cart=structuredClone(h.conv.sessionData.cart),pending=structuredClone(h.conv.sessionData.pendingAttribute);
  expect(pending?.quantity).toBe(4);expect(pending?.distributionParts).toEqual(['2 con mango']);
  const reply=await h.sendQueued(`deja ${guard==='zero'?0:guard==='over30'?31:2} ${name}, cuanto cuesta`);
  expect(reply).toMatch(/9[.,]000/);
  expect(reply).toMatch(guard==='ambiguous'?/compra pendiente|otra línea/:/entre 1 y 30/);
  expect(h.conv.sessionData.pendingAttribute).toEqual(pending);expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('los otros con lulo');
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(guard==='ambiguous'?5:4);
  for(const [flavor,count] of [['Mango',guard==='ambiguous'?3:2],['Lulo',2]] as const) expect(items.filter((item:any)=>item.attributes.some((a:any)=>a.attributeName==='Sabor'&&a.attributeValue===flavor))).toHaveLength(count);
 });
}
