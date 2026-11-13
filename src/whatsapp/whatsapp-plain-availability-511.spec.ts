import {harness} from './whatsapp-accuracy.test-support';
const families = [
  {name:'1 Pollo Broaster', combo:'Combo De Pollo Broaster', said:'pollo a la broaster', correction:'UN POLLO SIN COMBO'},
  {name:'Bowl Andino', combo:'Combo De Bowl Andino', said:'Bowl Andino', correction:'UN BOWL ANDINO SIN COMBO'},
  {name:'Hamburguesa Clasica', combo:'Combo De Hamburguesa Clasica', said:'Hamburguesa Clasica', correction:'UNA HAMBURGUESA CLASICA SIN COMBO'},
];
for(const family of families) for(const agent of [false,true]) for(const missing of [false,true]) {
 test(`${family.name}/${agent}/${missing}: unavailable plain option never adds excluded combo`,async()=>{
  const h=harness([
   ...(!missing?[{id:95101,code:1,name:family.name,price:46000,availableNow:false,attributes:[]}]:[]),
   {id:95102,code:2,name:family.combo,price:55000,availableNow:true,attributes:[]},
  ],agent);
  h.cfg.ignoreBusinessHours=false;
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued(`Me regala un ${family.said} sin combo`);
  expect(h.cartRows()).toHaveLength(0);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(reply).not.toMatch(/Listo ✅/);
 });
}
for(const family of families) for(const agent of [false,true]) for(const quantity of [2,3])
for(const correction of [false,true]) for(const drink of [false,true]) {
 test(`${family.name}/${agent}/${quantity}/${correction}/${drink}: plain quantity and separate drink keep exact total`,async()=>{
  const h=availableMenu(family,agent);
  if(correction) await h.sendQueued(`quiero ${quantity} ${family.combo}`);
  await h.sendQueued(`Me regala ${quantity} ${family.said} sin combo${!correction&&drink?' y una Limonada Natural':''}`);
  if(correction&&drink) await h.sendQueued('una Limonada Natural');
  expect(h.cartRows().filter(row=>row.id===95101).reduce((sum,row)=>sum+row.qty,0)).toBe(quantity);
  expect(h.cartRows().some(row=>row.id===95102)).toBe(false);
  expect(h.cartRows().find(row=>row.id===95103)?.qty||0).toBe(drink?1:0);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.replies.at(-1)).toContain((quantity*46000+(drink?5000:0)).toLocaleString('es-CO'));
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(quantity+(drink?1:0));
 });
}
for(const family of families) for(const agent of [false,true]) {
 test(`${family.name}/${agent}: excluding one combo preserves another explicitly requested combo`,async()=>{
  const h=availableMenu(family,agent);
  await h.sendQueued(`quiero dos ${family.said} sin combo y un Combo De Pasta Marinera`);
  expect(h.cartRows()).toEqual(expect.arrayContaining([
   expect.objectContaining({id:95101,qty:2}),expect.objectContaining({id:95104,qty:1}),
  ]));
  expect(h.cartRows()).toHaveLength(2);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(3);
 });
}
function availableMenu(family:typeof families[number],agent:boolean){
 const h=harness([
  {id:95101,code:1,name:family.name,price:46000,availableNow:true,attributes:[]},
  {id:95102,code:2,name:family.combo,price:55000,availableNow:true,attributes:[]},
  {id:95103,code:3,name:'Limonada Natural',price:5000,availableNow:true,attributes:[]},
  {id:95104,code:4,name:'Combo De Pasta Marinera',price:30000,availableNow:true,attributes:[]},
 ],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:511,dailyOrderNumber:511});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 return h;
}
for(const family of families) for(const agent of [false,true]) {
 test(`${family.name}/${agent}: missing plain option preserves unrelated basket`,async()=>{
  const h=harness([
   {id:95102,code:2,name:family.combo,price:55000,availableNow:true,attributes:[]},
   {id:95105,code:5,name:'Sopa Vegetal',price:10000,availableNow:true,attributes:[]},
  ],agent);
  h.cfg.ignoreBusinessHours=false;
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn();
  h.conv.sessionData.cart=[{productId:95105,code:5,name:'Sopa Vegetal',unitPrice:10000,quantity:2,attributes:[],note:'sin sal'}];
  const cart=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`Me regala un ${family.said} sin combo`);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
