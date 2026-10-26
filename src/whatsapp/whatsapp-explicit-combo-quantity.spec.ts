import { harness } from './whatsapp-accuracy.test-support';
const product=(id:number,name:string,availableNow=true)=>({id,code:id,name,price:20000,availableNow,hasAttributes:false,attributes:[]});
const title='Combo Bowl De Quinoa Con Tofu';
const base=product(99101,'Bowl De Quinoa');
const combo=product(99102,title);
const resolve=(text:string,menu=[base,combo])=>harness(menu,false).service.catalogService.explicitlyNamedCombo(text,menu);
it.each(['un combo','dos combos','3 combos'])('unique full title %s',prefix=>{
 expect(resolve(`Quiero ${prefix} Bowl De Quinoa Con Tofu`)).toEqual(combo);
});
it('incomplete family stays unresolved',()=>expect(resolve('Quiero dos combos de quinoa')).toBeNull());
it('two identical active names stay unresolved',()=>expect(resolve(`Quiero dos ${title}`,[combo,product(99103,title)])).toBeNull());
it('unavailable exact title does not select shorter available title',()=>expect(resolve(`Quiero dos ${title}`,[product(99103,'Combo Bowl De Quinoa'),{...combo,availableNow:false}])).toBeNull());
it('two unrelated fully named combos stay unresolved',()=>expect(resolve(`Quiero ${title} y Combo Pasta Con Setas`,[combo,product(99103,'Combo Pasta Con Setas')])).toBeNull());
it('one longer title wins over its contained prefix',()=>expect(resolve(`Quiero dos ${title}`,[product(99103,'Combo Bowl De Quinoa'),combo])).toEqual(combo));
it('extra title word does not match a partial word',()=>expect(resolve('Quiero dos Combo Bowl De Quinoa Con Tofutina')).toBeNull());
for(const [dish,component,option] of [['Bowl De Quinoa','Tofu','3fresh'],['Pasta','Champinones','9cool']]) for(const agent of [false,true]) {
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
