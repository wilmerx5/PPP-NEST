import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const [assigned,quantity] of [[2,1],[2,2],[1,1]]) for(const phrase of ['mejor solo','cambia la cantidad a']) {
 test(`${name}/${agent}/${assigned}/${quantity}/${phrase}: reduced total resolves staged choices without stale groups`,async()=>{
  const h=harness([
   {id:94931,code:81,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
   {id:94932,code:82,name:'Sopa Vegetal',price:10000,availableNow:true,attributes:[]}
  ],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:493,dailyOrderNumber:493});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('quiero una Sopa Vegetal');await h.sendQueued(`quiero cuatro ${name}`);
  const cart=structuredClone(h.conv.sessionData.cart);
  expect(await h.sendQueued(`${assigned===1?'uno':'dos'} con mango`)).toContain(`Faltan ${4-assigned} unidades`);
  const reply=await h.sendQueued(`${phrase} ${quantity===1?'uno':'dos'}`);
  if(quantity<assigned){
   expect(reply).toMatch(/reparto|elegid|asignad/i);
   expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(1);
   expect(h.conv.sessionData.pendingAttribute?.distributionParts?.length || 0).toBe(0);
   expect(h.conv.sessionData.cart).toEqual(cart);
   await h.sendQueued('lulo');
  }else{
   expect(reply).toMatch(/Mango/i);
   expect(reply).not.toMatch(/¿Qué.*Sabor|Faltan.*unidades/i);
  }
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  const flavor=quantity<assigned?'Lulo':'Mango';
  const desserts=h.cartRows().filter(row=>row.id===94931);
  expect(desserts).toHaveLength(1);expect(desserts[0].qty).toBe(quantity);expect(desserts[0].attrs).toContain(`Sabor:${flavor}`);
  expect(h.cartRows().find(row=>row.id===94932)?.qty).toBe(1);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.replies.at(-1)).toContain((10000+quantity*9000).toLocaleString('es-CO'));
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(quantity+1);
  expect(items.filter((item:any)=>item.productId===94931&&item.attributes.some((a:any)=>a.attributeName==='Sabor'&&a.attributeValue===flavor))).toHaveLength(quantity);
 });
}
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const sameFlavor of [false,true]) for(const quantity of [1,2]) {
 test(`${name}/${agent}/${sameFlavor}/${quantity}: reduction after two staged messages`,async()=>{
  const h=harness([{id:94933,code:83,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]}],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:493,dailyOrderNumber:493});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued(`quiero cuatro ${name}`);await h.sendQueued('uno con mango');
  await h.sendQueued(sameFlavor?'uno con mango':'uno con lulo');
  expect(h.conv.sessionData.pendingAttribute?.distributionParts).toHaveLength(2);
  expect(h.cartRows()).toEqual([]);
  const reply=await h.sendQueued(`mejor que sean ${quantity===1?'uno':'dos'}`);
  if(quantity===1){
   expect(reply).toMatch(/reparto anterior.*2 unidades/);
   expect(h.conv.sessionData.pendingAttribute?.distributionParts?.length || 0).toBe(0);
   expect(h.cartRows()).toEqual([]);
   expect(await h.sendQueued(`cuánto cuesta ${name}`)).toMatch(/9[.,]000/);
   expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(1);
   await h.sendQueued('lulo');
  }else expect(reply).toMatch(/Repartí 2/);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.replies.at(-1)).toContain((quantity*9000).toLocaleString('es-CO'));
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(quantity);
  const mango=quantity===1?0:sameFlavor?2:1;
  for(const [flavor,count] of [['Mango',mango],['Lulo',quantity-mango]] as const) expect(items.filter((item:any)=>item.productId===94933&&item.attributes.some((a:any)=>a.attributeName==='Sabor'&&a.attributeValue===flavor))).toHaveLength(count);
 });
}
