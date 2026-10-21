import {harness} from './whatsapp-accuracy.test-support';
const families=[{name:'Agua 600ml',request:'botella De Agua',part:'gas'}, {name:'Cafe Natural',request:'Cafe Natural',part:'azúcar'}, {name:'Batido De Fresa',request:'Batido De Fresa',part:'lactosa'}];
for(const f of families)for(const enabled of [false,true])for(const mode of ['initial','correction'])for(const selected of ['con','sin']){
 it(`${f.name}: one binary option ${mode} ${selected}, agent=${enabled}`,async()=>{
  const p={id:98901,code:831,name:f.name,price:3500,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Tipo',options:[`Sin ${f.part}`,`Con ${f.part}`]}]};
  const dish={id:98902,code:832,name:'Churrasco',price:38000,availableNow:true,attributes:[]};
  const h=harness([p,dish],enabled);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:989,dailyOrderNumber:103});
  Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued('Quiero un Churrasco');
  const addedReply=await h.sendQueued(mode==='initial'?`Dos ${f.request}, una ${selected} ${f.part}`:`Quiero dos ${f.name} con ${f.part}`);
  if(mode==='initial'){expect(addedReply).toContain(`Con ${f.part}`);expect(addedReply).toContain(`Sin ${f.part}`);}
  if(mode==='correction'){
   await h.sendQueued('no más, recojo en el local');
   expect(h.conv.state).toBe('awaiting_payment');
   h.service.aiService.generateTurn.mockResolvedValue({reply:`Sí, ya lo corregí: una ${selected} ${f.part} y otra sin ${f.part}.`,actions:{}});
   const reply=await h.sendQueued(`Las dos son con ${f.part}? Quería solo una ${selected} ${f.part}`);
   expect(reply).toMatch(/sin/i);
   expect(h.conv.state).toBe('awaiting_payment');
  }
  const water=()=>h.conv.sessionData.cart.filter(item=>item.productId===p.id);
  expect(water()).toHaveLength(2);
  expect(water().map(item=>({quantity:item.quantity,value:item.attributes?.[0]?.attributeValue}))).toEqual(expect.arrayContaining([
   {quantity:1,value:`Con ${f.part}`},{quantity:1,value:`Sin ${f.part}`},
  ]));
  expect(h.conv.sessionData.cart.filter(item=>item.productId===dish.id)).toEqual([expect.objectContaining({quantity:1,unitPrice:38000})]);
  if(mode==='correction'){
   const before=structuredClone(h.conv.sessionData.cart);
   await h.sendQueued(`Las dos son con ${f.part}? Quería solo una ${selected} ${f.part}`);
   expect(h.conv.sessionData.cart).toEqual(before);
  }
  if(h.conv.state==='building_cart')await h.sendQueued('no más, recojo en el local');
  await h.sendQueued('contraentrega');
  expect(water()).toHaveLength(2);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(3);
  expect(dto.items.filter(item=>item.productId===p.id).map(item=>item.attributes[0].attributeValue).sort()).toEqual([`Con ${f.part}`,`Sin ${f.part}`].sort());
 });
}
