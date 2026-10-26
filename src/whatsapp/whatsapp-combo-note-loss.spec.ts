import { harness } from './whatsapp-accuracy.test-support';
const product=(id:number,name:string,availableNow=true)=>({id,code:id,name,price:20000,availableNow,hasAttributes:false,attributes:[]});
for(const [dish,component,option] of [['Arroz Chino','Medio Pollo','7up'], ['Bowl De Quinoa','Tofu','3fresh'], ['Pasta','Champinones','9cool']]) for(const agent of [false,true]) for(const note of ['sin cebolla','sin ensalada']) {
 it(`plural preserves option and kitchen note ${dish}/${agent}/${note}`,async()=>{
  const name=`Combo ${dish} Con ${component}`;
  const menu=[product(99101,dish),product(99102,component),{...product(99103,name),hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua',option]}]}];
  const h=harness(menu,agent);
  const reply=await h.sendQueued(`Quiero dos combos ${dish} con ${component} y bebida ${option}, ${note}`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99103,quantity:2,note:expect.stringMatching(new RegExp(note, 'i'))});
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:option});
  expect(h.conv.state).toBe('building_cart');
  expect(h.conv.sessionData.cart[0].note).not.toMatch(new RegExp(`con ${component}`, 'i'));
  expect(String(reply)).toMatch(new RegExp(note, 'i'));
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(2);
  for(const item of items) {
   expect(item).toMatchObject({productId:99103,note:expect.stringMatching(new RegExp(note, 'i'))});
   expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:option});
  }
 });
}

for (const name of ['Combo Arroz Chino Con Medio Pollo', 'Combo Bowl De Quinoa Con Tofu', 'Combo Pasta Con Champinones']) {
 for (const plural of [false, true]) {
  it(`catalog title alone is not a note ${name}/${plural}`, () => {
   const p = product(99103, name);
   const catalog = harness([p], false).service.catalogService;
   expect(catalog.orderKitchenNote(`Quiero ${plural ? 'dos' : 'un'} ${plural ? name.replace('Combo', 'Combos') : name}`, p)).toBeUndefined();
  });
 }
}
