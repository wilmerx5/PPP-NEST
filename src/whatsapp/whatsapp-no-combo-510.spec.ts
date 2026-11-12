import {harness} from './whatsapp-accuracy.test-support';
const families = [
  {name:'1 Pollo Broaster', combo:'Combo De Pollo Broaster', said:'pollo a la broaster', correction:'UN POLLO SIN COMBO'},
  {name:'Bowl Andino', combo:'Combo De Bowl Andino', said:'Bowl Andino', correction:'UN BOWL ANDINO SIN COMBO'},
  {name:'Hamburguesa Clasica', combo:'Combo De Hamburguesa Clasica', said:'Hamburguesa Clasica', correction:'UNA HAMBURGUESA CLASICA SIN COMBO'},
];
for(const family of families) for(const agent of [false,true]) for(const correction of [false,true])
for(const phrase of ['sin combo','sin el combo','SIN COMBO']) {
 test(`${family.name}/${agent}/${correction}/${phrase}: explicit exclusion selects plain product`,async()=>{
  const h=harness([
   {id:95101,code:1,name:family.name,price:46000,availableNow:true,attributes:[]},
   {id:95102,code:2,name:family.combo,price:55000,availableNow:true,attributes:[]},
  ],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:510,dailyOrderNumber:510});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  if(correction){
   await h.sendQueued(`quiero un ${family.combo}`);
   expect(h.cartRows()).toEqual([expect.objectContaining({id:95102,qty:1})]);
  }
  const reply=await h.sendQueued(correction?family.correction:`Me regala un ${family.said} ${phrase}`);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:95101,qty:1})]);
  expect(reply).toContain(family.name);expect(reply).not.toContain(family.combo);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.replies.at(-1)).toContain('46.000');
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([expect.objectContaining({productId:95101})]);
 });
}
for(const family of families) for(const agent of [false,true]) {
 test(`${family.name}/${agent}: plain correction removes combo drink attributes`,async()=>{
  const arepas={attributeName:'Arepas',options:['Blancas','Fritas']};
  const h=harness([
   {id:95101,code:1,name:family.name,price:46000,availableNow:true,hasAttributes:true,attributes:[arepas]},
   {id:95102,code:2,name:family.combo,price:55000,availableNow:true,hasAttributes:true,
    attributes:[arepas,{attributeName:'Bebida',options:['Colombiana','Pepsi']}]},
  ],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:510,dailyOrderNumber:510});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.conv.sessionData.cart=[{productId:95102,code:2,name:family.combo,unitPrice:55000,quantity:1,
   attributes:[{attributeName:'Arepas',attributeValue:'Blancas'},{attributeName:'Bebida',attributeValue:'Colombiana'}],note:'sin combo'}];
  await h.sendQueued(family.correction);
  expect(h.cartRows()).toEqual([expect.objectContaining({id:95101,qty:1,attrs:['Arepas:Blancas']})]);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([
   expect.objectContaining({productId:95101,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]}),
  ]);
 });
}
