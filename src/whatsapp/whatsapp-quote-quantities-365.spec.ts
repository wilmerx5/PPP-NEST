import { harness } from './whatsapp-accuracy.test-support';

for (const other of [false, true]) for (const agent of [false, true]) {
 for (const quantities of [[2,3], [3,2], [1,4], [1,1]]) for (const words of [false,true]) {
  for (const changed of [false,true]) it(`quoted quantities ${other} ${agent} ${quantities} ${words} ${changed}`, async () => {
   const names = other ? ['Pasta Vegetal','Crema De Zapallo'] : ['Arroz Con Pollo','Sopa Del Dia'];
   const menu = names.map((name,i)=>({id:98501+i,code:851+i,name,price:20000+i*10000,availableNow:true,hasAttributes:false,attributes:[]}));
   const h = harness(menu,agent); h.cfg.ignoreBusinessHours=false;
   h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:365,dailyOrderNumber:365});
   h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
   const numbers=['','un','dos','tres','cuatro'];
   const query = menu.map((p,i)=>`${words ? numbers[quantities[i]] : quantities[i]} ${p.name}`).join(' y ');
   const quote = await h.sendQueued(`Cuánto cuestan ${query}?`);
   expect(h.conv.sessionData.pendingAddOffer?.productIds).toEqual(menu.map(p=>p.id));
   expect(h.conv.sessionData.cart).toEqual([]);
   expect(quote).toContain((quantities[0]*20000+quantities[1]*30000).toLocaleString('es-CO'));
   if(changed) {
    const current=structuredClone(menu); current[0].price=22000;
    h.service.catalogService.getMenuProducts.mockResolvedValue(current);
    const revised=await h.sendQueued('sí'); expect(h.conv.sessionData.cart).toEqual([]);
    expect(revised).toContain((quantities[0]*22000+quantities[1]*30000).toLocaleString('es-CO'));
   }
   await h.sendQueued('Me pasas el menú porfa');
   await h.sendQueued('sí');
   expect(h.conv.sessionData.cart).toHaveLength(2);
   for(let i=0;i<2;i++) expect(h.conv.sessionData.cart).toContainEqual(expect.objectContaining({productId:menu[i].id,quantity:quantities[i],unitPrice:i===0&&changed?22000:menu[i].price}));
   await h.sendQueued('no más'); await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(quantities[0]+quantities[1]);
  });
 }
}

for (const agent of [false,true]) for(const pack of [0,1,2]) for(const accept of [false,true]) {
 it(`implicit quantity and numeric name ${agent} ${pack} ${accept}`, async()=>{
  const menu=[{id:98511,code:861,name:pack===2?'Pack 6 Empanadas':pack===1?'6 Empanadas':'Pasta Vegetal',price:20000},{id:98512,code:862,name:'Limonada Natural',price:5000}].map(p=>({...p,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  const reply=await h.sendQueued(`Cuánto cuesta ${menu[0].name} y dos ${menu[1].name}?`);
  expect(h.conv.sessionData.pendingAddOffer?.productIds).toEqual(menu.map(p=>p.id));
  expect(reply).toContain('30.000');
  expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued(accept?'sí':'no');
  if(accept){expect(h.conv.sessionData.cart).toHaveLength(2);expect(h.conv.sessionData.cart).toContainEqual(expect.objectContaining({productId:98511,quantity:1}));expect(h.conv.sessionData.cart).toContainEqual(expect.objectContaining({productId:98512,quantity:2}));}
  else expect(h.conv.sessionData.cart).toEqual([]);
 });
}
