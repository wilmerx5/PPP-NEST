import {harness} from './whatsapp-accuracy.test-support';

const menus = [
 {name:'Pasta Primavera',notes:['sin queso','sin cebolla','sin tomate']},
 {name:'Bowl Andino',notes:['sin cilantro','sin cebolla','sin tomate']},
 {name:'Filete Dorado',notes:['sin sal','sin cebolla','sin tomate']},
];
for(const enabled of [false,true])for(const menu of menus)for(const scenario of ['complete','price','edit']){
 test(`${menu.name} three distinct notes ${scenario} agent=${enabled}`,async()=>{
  const h=harness([{id:88001,code:88001,name:menu.name,description:'Plato de prueba',price:18000,availableNow:true,hasAttributes:false,attributes:[]}],enabled);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:126,dailyOrderNumber:126});
  const reply=await h.send(`quiero un ${menu.name} ${menu.notes[0]}, un ${menu.name} ${menu.notes[1]} y un ${menu.name} ${menu.notes[2]}`);
  expect(h.cartRows().map(row=>row.qty)).toEqual([1,1,1]);
  for(let i=0;i<3;i++){
   expect(h.cartRows()[i].note).toContain(menu.notes[i]);
   expect(reply).toContain(menu.notes[i]);
   for(let j=0;j<3;j++)if(i!==j)expect(h.cartRows()[i].note).not.toContain(menu.notes[j]);
  }
  if(scenario==='price'){
   const before=structuredClone(h.conv.sessionData.cart);
   const answer=await h.send('cuánto cuesta todo?');
   expect(answer).toMatch(/54[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);
  }
  if(scenario==='edit'){
   await h.send('a la segunda ponle como nota sin ajo');
   expect(h.cartRows().reduce((sum,row)=>sum+row.qty,0)).toBe(3);
   expect(h.cartRows()[1].note).toContain('sin ajo');
   expect(h.cartRows()[0].note).not.toContain('sin ajo');expect(h.cartRows()[2].note).not.toContain('sin ajo');
  }
  const before=structuredClone(h.cartRows());
  await h.send('no más, recojo en el local');await h.send('contraentrega');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.send('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(3);
  expect(items.map(i=>i.productId)).toEqual([88001,88001,88001]);
  expect(items.map(i=>i.note)).toEqual(before.map(i=>i.note));
 });
}
for(const enabled of [false,true])for(const menu of menus)for(const scenario of ['missing','pending']){
 test(`${menu.name} ordinal protection ${scenario} agent=${enabled}`,async()=>{
  const product={id:88001,code:88001,name:menu.name,price:18000,availableNow:true,hasAttributes:false,attributes:[]};
  const h=harness([product],enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.conv.sessionData.cart=[{productId:88001,code:88001,name:menu.name,unitPrice:18000,quantity:2,note:'sin queso'}];
  if(scenario==='pending')h.conv.sessionData.pendingMatch={query:menu.name,candidates:[product],createdAt:Date.now()} as any;
  const before=structuredClone(h.conv.sessionData.cart);
  const answer=await h.send(scenario==='missing'?'a la tercera ponle como nota sin ajo':'a la primera ponle como nota sin ajo');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(answer).toMatch(scenario==='missing'?/posición no está/:/selección pendiente/);
 });
}
