import {harness} from './whatsapp-accuracy.test-support';

const catalogs = [
 ['Ejecutivo Con Pollo Frito','Bandeja Con Pollo Broaster','Arroz Con Pollo'],
 ['Bowl De Garbanzos','Curry De Lentejas','Pasta Del Huerto'],
 ['Pizza De Hongos','Ravioles De Ricota','Lasana Vegetal'],
];

// Seeded carts isolate correction ownership; this is not a replay of a customer's whole chat.
for (const names of catalogs) for (const agent of [false,true])
for (const scenario of ['direct','ambiguous','conflict','cancel'])
for (const payment of ['efectivo','transferencia']) {
 it(`note correction reaches checkout ${names[0]} ${agent} ${scenario} ${payment}`,async()=>{
  const count=scenario==='direct'?2:3;
  const menu=names.slice(0,count).map((name,i)=>({id:97001+i,code:97001+i,name,price:22000+i*1000,availableNow:true,hasAttributes:true,
   attributes:[{attributeName:'Bebida',options:['Limonada','Cola']},{attributeName:'Presentacion',options:['Normal','Grande']}]}));
  const h=harness(menu,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:296,dailyOrderNumber:96});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,
   cart:menu.map((p,i)=>({productId:p.id,code:p.code,name:p.name,quantity:1,unitPrice:p.price,
    attributes:[{attributeName:'Bebida',attributeValue:i===1?'Cola':'Limonada'},{attributeName:'Presentacion',attributeValue:i===2?'Grande':'Normal'}],
    note:i===0?'bien empacado':scenario==='conflict'&&i===1?'con cebolla':'salsa aparte'}))});
  const original=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('uno sin cebolla');
  expect(h.conv.sessionData.cart).toEqual(original);
  await h.sendQueued('1');
  const selected=original.map((line,i)=>i===0?{...line,note:'bien empacado; sin cebolla'}:line);
  expect(h.conv.sessionData.cart).toEqual(selected);
  const reply=await h.sendQueued(scenario==='conflict'?'perdón, al segundo':'no, el otro');
  let expected=original.map((line,i)=>i===(scenario==='direct'?1:2)?{...line,note:'salsa aparte; sin cebolla'}:line);
  if(scenario!=='direct') {
   expect(h.conv.sessionData.cart).toEqual(selected);
   expect(h.conv.sessionData.lastKitchenNoteSelection?.awaitingDestination).toBe(true);
   expect(reply).toMatch(scenario==='conflict'?/incompatible/i:/cu[aá]l|elige/i);
   if(scenario==='cancel') {
    await h.sendQueued('no muevas la nota');expected=selected;
   } else await h.sendQueued('3');
  } else expect(reply).toContain(names[1]);
  expect(h.conv.sessionData.cart).toEqual(expected);
  expect(h.conv.sessionData.lastKitchenNoteSelection).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();

  await h.sendQueued('no más, recojo en el local');
  expect(h.conv.state).toBe('awaiting_payment');
  await h.sendQueued(payment);
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const receipt=await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.conv.state).toBe('completed');
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(expected.length);
  for(const line of expected) {
   const item=dto.items.find(item=>item.productId===line.productId);
   expect(item).toMatchObject({productId:line.productId,note:line.note,attributes:line.attributes});
   expect(receipt).toContain(line.name);
   expect(receipt).toContain(line.note);
  }
 });
}
