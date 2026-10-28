import { harness } from './whatsapp-accuracy.test-support';
const p=(id:number,name:string)=>({id,code:id,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]});
for (const [dish,component,preparation,drink] of [
 ['Arroz Chino','Medio Pollo','Frito','7up'],
 ['Bowl De Quinoa','Tofu','Asado','3fresh'],
 ['Pasta','Champinones','Salteados','9cool'],
]) for (const agent of [false,true]) for (const quantity of [1,2]) {
 it(`full combo identity and options ${dish}/${agent}/${quantity}`,async()=>{
  const menu=[p(99001,dish),p(99002,component),{...p(99003,`Combo ${dish} Con ${component}`),
   hasAttributes:true,attributes:[{attributeName:'Preparación',options:[preparation,'Normal']},{attributeName:'Bebida',options:['Agua',drink]}]}];
  const h=harness(menu,agent);
  const reply=await h.sendQueued(`Quiero ${quantity===1?'un':'dos'} ${dish} con ${component} ${preparation} y bebida ${drink}`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99003,quantity});
  expect(h.conv.sessionData.cart[0].attributes).toEqual(expect.arrayContaining([
   {attributeName:'Preparación',attributeValue:preparation},{attributeName:'Bebida',attributeValue:drink},
  ]));
  expect(String(reply)).toContain(`Combo ${dish}`);
  expect(String(reply)).not.toMatch(/no manejamos|cuál prefieres/i);
  expect(h.conv.state).toBe('building_cart');
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(quantity);
  for(const item of items) {
   expect(item.productId).toBe(99003);
   expect(item.attributes).toEqual(expect.arrayContaining([
    {attributeName:'Preparación',attributeValue:preparation},{attributeName:'Bebida',attributeValue:drink},
   ]));
  }
 });
}

for(const agent of [false,true]) for(const spelling of ['7up','7 up']) {
 it(`implicit package keeps preparation and numeric drink ${agent}/${spelling}`,async()=>{
  const h=harness(undefined,agent);
  const reply=await h.sendQueued(`Buenas noches para pedir un arroz chino con medio pollo frito y gaseosa ${spelling}`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({code:97,quantity:1});
  expect(h.conv.sessionData.cart[0].attributes).toEqual(expect.arrayContaining([
   {attributeName:'Pollo',attributeValue:'Frito'}, {attributeName:'Bebida',attributeValue:'7up'},
  ]));
  expect(String(reply)).toMatch(/7up/i);
  expect(String(reply)).not.toMatch(/no manejamos|cuál prefieres/i);
 });
}

for(const [dish,component,drink] of [['Arroz Chino','Medio Pollo','7up'],['Bowl De Quinoa','Tofu','3fresh'],['Pasta','Champinones','9cool']]){
 const combo={id:99003,code:99003,name:`Combo ${dish} Con ${component}`,price:20000,availableNow:true,attributes:[{attributeName:'Bebida',options:[drink]}]};
 const catalog=harness([combo] as never,false).service.catalogService;
 for(const text of [
  `¿Cuánto cuesta un ${dish} con ${component} y bebida ${drink}?`,
  `No quiero un ${dish} con ${component} y bebida ${drink}`,
  `Un ${dish} y un ${component} y bebida ${drink}`,
  `Un ${dish} con ${component} y dos bebidas ${drink}`,
  `Un ${dish} con ${component} aparte y bebida ${drink}`,
  `Un ${dish} con ${component} y bebida inventada`,
 ])it(`does not assume a package for another intention: ${text}`,()=>expect(catalog.implicitlyNamedCombo(text,[combo] as never)).toBeNull());
 it(`duplicate package titles need an explicit choice ${dish}`,()=>expect(catalog.implicitlyNamedCombo(`Un ${dish} con ${component} y bebida ${drink}`,[combo,{...combo,id:99004}] as never)).toBeNull());
 it(`an unavailable package is not selected ${dish}`,()=>expect(catalog.implicitlyNamedCombo(`Un ${dish} con ${component} y bebida ${drink}`,[{...combo,availableNow:false}] as never)).toBeNull());
}
