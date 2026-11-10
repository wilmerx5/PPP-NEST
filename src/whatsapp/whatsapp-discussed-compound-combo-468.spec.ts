import {harness,products} from './whatsapp-accuracy.test-support';
for(const agent of [false,true])for(const typo of [false,true])for(const style of ['frito','broaster']) {
 it(`discussed rice compound ${agent}/${typo}/${style}`,async()=>{
  const h=harness(products,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:468,dailyOrderNumber:468});
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued('Cuánto vale el arroz chino');expect(h.conv.sessionData.cart).toHaveLength(0);
  await h.sendQueued(`el combo con medio ${typo?'pollor':'pollo'} ${style}`);
  expect({cart:h.conv.sessionData.cart,pending:h.conv.sessionData.pendingAttribute,reply:h.replies.at(-1)}).toMatchObject({cart:[expect.objectContaining({productId:97,quantity:1,
   attributes:expect.arrayContaining([{attributeName:'Pollo',attributeValue:style==='frito'?'Frito':'Broaster'}])})]});
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('nada mas');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:97})]);
 });
}

const families=[{label:'PPP',menu:products,baseName:'Arroz Chino',target:97}];
for(const [index,name] of ['Bowl Andino','Ensalada Campestre'].entries()) {
 const id=76800+index*10;
 families.push({label:name,baseName:name,target:id+1,menu:[
  ...products.filter(p=>[2,5,98,99].includes(p.id)),
  {id,code:id,name,price:22000,hasAttributes:false,attributes:[]},
  {id:id+1,code:id+1,name:`Combo ${name} Con Medio Pollo`,price:35000,hasAttributes:true,attributes:[{attributeName:'Pollo',options:['Frito','Broaster']},{attributeName:'Bebida',options:['Colombiana','Manzana']}]},
 ]});
}
for(const f of families)for(const agent of [false,true])for(const typo of [false,true])for(const style of ['Frito','Broaster'])for(const inquiry of ['Cuánto vale','Qué trae','Cómo viene']) {
 it(`discussed catalog compound ${f.label}/${agent}/${typo}/${style}/${inquiry}`,async()=>{
  const h=harness(f.menu,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:468,dailyOrderNumber:468});
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued(`${inquiry} ${f.baseName.startsWith('Ensalada')?'la':'el'} ${f.baseName}`);expect(h.conv.sessionData.cart).toHaveLength(0);
  await h.sendQueued(`el combo con medio ${typo?'pollor':'pollo'} ${style}`);
  expect({cart:h.conv.sessionData.cart,reply:h.replies.at(-1)}).toMatchObject({cart:[expect.objectContaining({productId:f.target,quantity:1,
   attributes:expect.arrayContaining([{attributeName:'Pollo',attributeValue:style}])})]});
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingMatch).toBeUndefined();
  expect(h.replies.at(-1)).toContain(h.conv.sessionData.cart[0].name);
  const selected=structuredClone(h.conv.sessionData.cart[0]);
  await h.sendQueued('nada mas');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:f.target,attributes:selected.attributes})]);
 });
}
