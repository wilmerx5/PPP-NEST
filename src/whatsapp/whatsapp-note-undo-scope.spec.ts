import {harness} from './whatsapp-accuracy.test-support';

const menus=[
 {name:'Bao De Hongos',attr:'Salsa',a:'Teriyaki',b:'Ponzu'},
 {name:'Pizza Del Huerto',attr:'Masa',a:'Fina',b:'Gruesa'},
 {name:'Batido De Mango',attr:'Base',a:'Leche',b:'Agua'},
];
for(const f of menus)for(const enabled of [false,true])for(const scenario of ['remove-earlier','repeat-removal','ambiguous']){
 test(`${f.name} undo note ${scenario} agent=${enabled}`,async()=>{
  const p={id:89100,code:89100,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b]}]};
  const h=harness([p],enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:129,dailyOrderNumber:129});
  const line=(value:string,note:string)=>({productId:p.id,code:p.code,name:p.name,quantity:2,unitPrice:p.price,attributes:[{attributeName:f.attr,attributeValue:value}],note});
  h.conv.sessionData.cart=[line(f.a,'sin cebolla'),line(f.b,'sin tomate')];
  await h.send('a la primera ponle como nota sin ajo');
  await h.send('a la primera ponle como nota salsa aparte');
  const before=structuredClone(h.conv.sessionData.cart);
  expect(before[0].note).toContain('sin ajo');expect(before[0].note).toContain('salsa aparte');
  if(scenario==='ambiguous'){
   const reply=await h.send(`quita la nota sin ajo de ${f.name}`);
   expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/varias líneas|cu[aá]l|aclar/i);
  }
  const reply=await h.send('quita la nota sin ajo de primera');
  expect(reply).toMatch(/actualic|nota/i);
  const after=structuredClone(h.conv.sessionData.cart);
  expect(after[1]).toEqual(before[1]);
  expect(after[0]).toEqual({...before[0],note:'sin cebolla; salsa aparte'});
  if(scenario==='repeat-removal'){
   await h.send('quita la nota sin ajo de primera');expect(h.conv.sessionData.cart).toEqual(after);
  }
  const total=await h.send('Cuánto es el total');expect(total).toMatch(/72[.,]000/);
  expect(h.conv.sessionData.cart).toEqual(after);
  await h.send('no más, recojo en el local');await h.send('contraentrega');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.send('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);
  expect(items.filter(i=>i.note==='sin cebolla; salsa aparte')).toHaveLength(2);
  expect(items.filter(i=>i.note==='sin tomate')).toHaveLength(2);
  expect(items.some(i=>i.note?.includes('sin ajo'))).toBe(false);
 });
}
