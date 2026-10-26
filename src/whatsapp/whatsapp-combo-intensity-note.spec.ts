import { harness } from './whatsapp-accuracy.test-support';
const product=(id:number,name:string,availableNow=true)=>({id,code:id,name,price:20000,availableNow,hasAttributes:false,attributes:[]});
for(const [dish,component,option] of [['Arroz Chino','Medio Pollo','7up'], ['Bowl De Quinoa','Tofu','3fresh'], ['Pasta','Champinones','9cool']]) for(const agent of [false,true]) for(const note of ['con bastante ají','con poco ají','con mucho ají']) {
 it(`plural preserves option and kitchen note ${dish}/${agent}/${note}`,async()=>{
  const name=`Combo ${dish} Con ${component}`;
  const menu=[product(99101,dish),product(99102,component),{...product(99103,name),hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua',option]}]}];
  const h=harness(menu,agent);
  const reply=await h.sendQueued(`Quiero dos combos ${dish} con ${component} y bebida ${option}, ${note}`);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99103,quantity:2,note:expect.stringMatching(new RegExp(note.replace(/^con /, '(?:con )?').replace('í', '[ií]'), 'i'))});
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:option});
  expect(h.conv.state).toBe('building_cart');
  expect(h.conv.sessionData.cart[0].note).not.toMatch(new RegExp(`con ${component}`, 'i'));
  expect(String(reply)).toMatch(new RegExp(note.replace(/^con /, '(?:con )?').replace('í', '[ií]'), 'i'));
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(2);
  for(const item of items) {
   expect(item).toMatchObject({productId:99103,note:expect.stringMatching(new RegExp(note.replace(/^con /, '(?:con )?').replace('í', '[ií]'), 'i'))});
   expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:option});
  }
 });
}

const framed = (text: string, extra: any[] = []) => harness([product(99101, 'Plato Vegetal'), ...extra], false).service.catalogService.frameSpokenOrder(text, [product(99101, 'Plato Vegetal'), ...extra]).text;
it.each(['con bastante ají', 'con bastante aji', 'con arto ají por favor', 'con poco ají'])('trailing condiment attaches %s', note => {
 expect(framed(`un Plato Vegetal, ${note}`)).toBe(`un Plato Vegetal ${note}`);
});
it.each(['un ají', 'dos ajíes', 'con bastante ají y una bebida', 'con bastante ají?', 'con bastante queso'])('does not swallow another request %s', tail => {
 expect(framed(`un Plato Vegetal, ${tail}`)).toBe(`un Plato Vegetal, ${tail}`);
});
it('an exact catalogue name still owns its clause', () => {
 const text = 'un Plato Vegetal, con bastante ají';
 expect(framed(text, [product(99102, 'Con Bastante Ají')])).toBe(text);
});
