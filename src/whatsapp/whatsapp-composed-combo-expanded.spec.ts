import { harness } from './whatsapp-accuracy.test-support';

// Exact named compound vs plural, with competing component SKUs and final order DTO.
for (const [menuIndex, [base, component, option]] of [
 ['Arroz Chino', 'Medio Pollo', '7up'],
 ['Bowl De Quinoa', 'Tofu', '3fresh'],
 ['Pasta', 'Champinones', '9cool'],
].entries()) for (const agent of [false, true]) for (const quantity of [1, 2]) for (const spaced of [false, true]) {
 it(`compound ${menuIndex}/${agent}/${quantity}/${spaced}`, async () => {
  const name = `Combo ${base} Con ${component}`;
  const product = (id: number, name: string) => ({id,code:id,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]});
  const menu = [product(99101,base),product(99102,component),{...product(99103,name),hasAttributes:true,
   attributes:[{attributeName:'Bebida',options:['Agua',option]}]}];
  const h=harness(menu,agent);
  const flavor=spaced?option.replace(/(\d)([a-z])/,'$1 $2'):option;
  const reply=await h.sendQueued(`Quiero ${quantity===1?'un combo':'dos combos'} ${base} con ${component} y bebida ${flavor}`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99103,quantity});
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:option});
  expect(String(reply)).not.toMatch(/no manejamos|no pude|cuál prefieres/i);
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(quantity);
  for(const item of items) {
   expect(item).toMatchObject({productId:99103});
   expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:option});
  }
 });
}
