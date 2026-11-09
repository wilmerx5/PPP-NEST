import {harness,products} from './whatsapp-accuracy.test-support';
for(const agent of [false,true])for(const combo of [false,true])for(const reverse of [false,true])for(const lead of ['Un ',''])for(const drink of combo?[false,true]:[false]) {
 it(`compound preparation ownership ${agent}/${combo}/${reverse}/${lead}/${drink}`,async()=>{
  const h=harness(products,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:467,dailyOrderNumber:467});
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  const rice=`${combo?'combo de ':''}arroz chino con medio pollo frito${drink?' con bebida colombiana':''}`;
  await h.sendQueued(reverse?`Medio pollo broaster aparte y ${lead}${rice}`:`${lead}${rice} y medio pollo broaster aparte`);
  expect({cart:h.conv.sessionData.cart,pending:h.conv.sessionData.pendingAttribute,reply:h.replies.at(-1)}).toMatchObject({cart:expect.arrayContaining([
   expect.objectContaining({productId:combo?97:36,quantity:1,attributes:expect.arrayContaining([{attributeName:'Pollo',attributeValue:'Frito'}])}),
   expect.objectContaining({productId:5,quantity:1}),
  ])});
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  if(h.conv.state==='building_cart')await h.sendQueued('nada mas');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(2);expect(dto.items.find(p=>p.productId===(combo?97:36)).attributes).toContainEqual({attributeName:'Pollo',attributeValue:'Frito'});
 });
}

const families=[{label:'PPP',menu:products,base:36,combo:97,name:'arroz chino con medio pollo',extra:26}];
for(const [index,name] of ['Bowl Andino Con Medio Pollo','Ensalada Campestre Con Medio Pollo'].entries()) {
 const id=76700+index*10, attributes=[{attributeName:'Pollo',options:['Frito','Broaster']}];
 families.push({label:name,base:id,combo:id+1,name,extra:id+2,menu:[
  ...products.filter(p=>[2,5].includes(p.id)),
  {id,code:id,name,price:30000,hasAttributes:true,attributes},
  {id:id+1,code:id+1,name:'Combo '+name,price:35000,hasAttributes:true,attributes:[...attributes,{attributeName:'Bebida',options:['Colombiana','Manzana']}]},
  {id:id+2,code:id+2,name:'Crema De Verduras',price:7000,hasAttributes:false,attributes:[]},
 ]});
}
for(const f of families)for(const agent of [false,true])for(const combo of [false,true])for(const reverse of [false,true])for(const style of ['Frito','Broaster'])for(const phase of ['cart','payment','final']) {
 it(`scoped preparation ${f.label}/${agent}/${combo}/${reverse}/${style}/${phase}`,async()=>{
  const h=harness(f.menu,agent),otherStyle=style==='Frito'?'Broaster':'Frito',otherId=style==='Frito'?5:2;
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:467,dailyOrderNumber:467});
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  const prior=f.menu.find(p=>p.id===f.extra)!;await h.sendQueued('Un '+prior.name);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  h.conv.sessionData.cart[0].note='bien empacado';const saved=structuredClone(h.conv.sessionData.cart[0]);
  if(phase!=='cart')await h.sendQueued('nada mas');if(phase==='final')await h.sendQueued('contraentrega');
  const compound=`${combo?'combo de ':''}${f.name} ${style}${combo?' con bebida colombiana':''}`;
  await h.sendQueued(reverse?`Medio pollo ${otherStyle} aparte y un ${compound}`:`Un ${compound} y medio pollo ${otherStyle} aparte`);
  expect(h.conv.sessionData.cart.find(p=>p.productId===f.extra)).toEqual(saved);
  expect(h.conv.sessionData.cart.map(p=>[p.productId,p.quantity]).sort()).toEqual([[f.extra,1],[combo?f.combo:f.base,1],[otherId,1]].sort());
  const chosen=h.conv.sessionData.cart.find(p=>p.productId===(combo?f.combo:f.base))!;
  expect(chosen.attributes).toContainEqual({attributeName:'Pollo',attributeValue:style});
  if(combo)expect(chosen.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Colombiana'});
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingMatch).toBeUndefined();
  expect(h.replies.at(-1)).toContain(chosen.name);expect(h.replies.at(-1)).not.toMatch(/por ahora no manejamos/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(h.conv.state==='building_cart')await h.sendQueued('nada mas');
  if(h.conv.state==='awaiting_payment')await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(3);
  expect(dto.items.find(p=>p.productId===chosen.productId).attributes).toEqual(chosen.attributes);
  expect(dto.items.find(p=>p.productId===f.extra).note).toBe('bien empacado');
 });
}
