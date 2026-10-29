import {harness} from './whatsapp-accuracy.test-support';

const catalogs = [
 {family:'Ejecutivo Con Pollo',protein:'Pollo',key:'Presa',choice:'Pechuga'},
 {family:'Bandeja Con Tofu',protein:'Tofu',key:'Corte',choice:'Filete'},
 {family:'Plato Con Pescado',protein:'Pescado',key:'Corte',choice:'Lomo'},
];

// Synthetic seeded carts: exercise a partial preparation change through final persistence.
for(const m of catalogs) for(const agent of [false,true])
for(const quantity of [2,3,4]) for(const index of [0,1])
for(const payment of ['efectivo','transferencia']) {
 it(`partial preparation reaches order ${m.family} ${agent} q=${quantity} index=${index} ${payment}`,async()=>{
  const attributes=[{attributeName:m.key,options:[m.choice,'Cubos']},{attributeName:'Bebida',options:['Limonada','Cola']}];
  const menu=['Frito','Broaster'].map((preparation,i)=>({id:97201+i,code:97201+i,name:m.family+' '+preparation,
   price:24000+i*1000,availableNow:true,hasAttributes:true,attributes}));
  const h=harness(menu,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:297,dailyOrderNumber:97});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const source={productId:menu[0].id,code:menu[0].code,name:menu[0].name,quantity,unitPrice:24000,
   note:'Sin sal; bebida bajita de azúcar',attributes:[{attributeName:m.key,attributeValue:m.choice},{attributeName:'Bebida',attributeValue:'Limonada'}]};
  const sibling={...structuredClone(source),quantity:1,note:'Salsa aparte',attributes:[{attributeName:m.key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}]};
  const original=index?[sibling,source]:[source,sibling];
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,cart:structuredClone(original)});
  const reply=await h.sendQueued(`cámbiame uno de los de ${m.choice} a ${m.protein} broaster`);
  const replacement={...structuredClone(source),quantity:1,productId:menu[1].id,code:menu[1].code,name:menu[1].name,unitPrice:25000};
  const expected=original.flatMap((line,i)=>i===index?[{...line,quantity:quantity-1},replacement]:[line]);
  expect(h.conv.sessionData.cart).toEqual(expected);
  expect(h.conv.state).toBe('building_cart');
  expect(reply).toMatch(/cambi[eé].*1|cambi[eé].*una unidad/i);
  expect(reply).toContain(source.note);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();

  await h.sendQueued('no más, recojo en el local');
  expect(h.conv.state).toBe('awaiting_payment');
  await h.sendQueued(payment);
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.conv.sessionData.cart).toEqual(expected);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const receipt=await h.sendQueued('confirmar');
  expect(h.conv.state).toBe('completed');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  const units=expected.flatMap(line=>Array.from({length:line.quantity},()=>({productId:line.productId,note:line.note,attributes:line.attributes})));
  expect(dto.items).toHaveLength(quantity+1);
  expect(dto.items).toEqual(units.map(unit=>expect.objectContaining(unit)));
  for(const line of expected) {
   expect(receipt).toContain(line.name);
   expect(receipt).toContain(line.note);
  }
  expect(receipt).toContain(((quantity+1)*24000+1000).toLocaleString('es-CO'));
 });
}
