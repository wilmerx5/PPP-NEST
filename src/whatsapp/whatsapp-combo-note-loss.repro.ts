import { harness } from './whatsapp-accuracy.test-support';
const product=(id:number,name:string,availableNow=true)=>({id,code:id,name,price:20000,availableNow,hasAttributes:false,attributes:[]});
for(const [dish,component,option] of [['Arroz Chino','Medio Pollo','7up']]) for(const agent of [false,true]) {
 it(`plural preserves option and kitchen note ${dish}/${agent}`,async()=>{
  const name=`Combo ${dish} Con ${component}`;
  const menu=[product(99101,dish),product(99102,component),{...product(99103,name),hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua',option]}]}];
  const h=harness(menu,agent);
  const reply=await h.sendQueued(`Quiero dos combos ${dish} con ${component} y bebida ${option}, sin cebolla`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99103,quantity:2,note:expect.stringMatching(/sin cebolla/i)});
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:option});
  expect(String(reply)).toMatch(/sin cebolla/i);
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(2);
  for(const item of items) {
   expect(item).toMatchObject({productId:99103,note:expect.stringMatching(/sin cebolla/i)});
   expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:option});
  }
 });
}
