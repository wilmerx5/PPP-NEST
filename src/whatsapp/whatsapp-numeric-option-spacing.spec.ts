import { harness, products } from './whatsapp-accuracy.test-support';
for(const [name,option] of [['Combo De Hamburguesa','7up'],['Bento De Salmon','3fresh'],['Pizza Familiar','9cool']]) {
 const menu=[{id:99101,code:91,name,price:12000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Agua',option]}]}];
 const spaced=option.replace(/(\d)([a-z])/,'$1 $2');
 for(const quantity of [1,2,3]) {
  it(`catalog spacing keeps quantity ${name}/${quantity}`,()=>{
   const h=harness(menu,false);
   const text=`Quiero ${quantity} ${name} con ${spaced}`;
   const normalized=h.service.catalogService.normalizeNumericOptionTokens(text,menu);
   expect(normalized).toBe(`Quiero ${quantity} ${name} con ${option}`);
   expect(h.service.catalogService.normalizeNumericOptionTokens(normalized,menu)).toBe(normalized);
  });
 }
 for(const agent of [false,true]) {
  it(`numeric option purchase ${name}/${agent}`,async()=>{
   const h=harness(menu,agent);
   await h.sendQueued(`Quiero un ${name} con ${spaced}`);
   expect(h.conv.sessionData.cart).toHaveLength(1);
   expect(h.conv.sessionData.cart[0].quantity).toBe(1);
   expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:option});
   await close(h,99101);
  });
 }
}
for(const text of ['Quiero 7 pollos','calle 7 sur 25 31','Quiero 2 aguas de 600 ml','Quiero 3 fresh']) {
 it(`unlisted numeric words stay unchanged: ${text}`,()=>{
  const h=harness(undefined,false);
  expect(h.service.catalogService.normalizeNumericOptionTokens(text,products)).toBe(text);
 });
}
for(const agent of [false,true]) {
 it(`PPP explicit combo retains spaced 7 up ${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('Quiero un combo arroz chino con medio pollo frito y gaseosa 7 up');
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({code:97,quantity:1});
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'7up'});
  await close(h,97);
 });
}

async function close(h: ReturnType<typeof harness>, productId: number) {
 Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const attributes=structuredClone(h.conv.sessionData.cart[0].attributes);
 await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items[0]).toMatchObject({productId});
 expect(h.service.ordersService.create.mock.calls[0][0].items[0].attributes).toEqual(attributes);
}
