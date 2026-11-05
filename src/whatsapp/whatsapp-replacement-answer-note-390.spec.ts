import { harness } from './whatsapp-accuracy.test-support';
for (const other of [false,true]) for (const agent of [false,true]) for(const numeric of [false,true]) for(const quantity of [1,2]) {
 it(`replacement option answer retains notes ${other}/${agent}/${numeric}/${quantity}`,async()=>{
  const name=other?'Hamburguesa Vegetal':'Pollo Frito';
  const menu=[{id:39001,code:1,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]},
   {id:39002,code:2,name:`Combo ${name}`,price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Colombiana']}]}];
  const h=harness(menu,agent);
  const original={productId:39001,code:1,name,unitPrice:20000,quantity,note:'Sin cebolla'};
  h.conv.sessionData.cart=[original];
  h.conv.state='awaiting_attribute';
  h.conv.sessionData.pendingAttribute={productId:39002,code:2,price:25000,attributes:menu[1].attributes,name:menu[1].name,quantity,selected:[],sourceText:`cambia a ${menu[1].name}`,replacement:{originalLine:structuredClone(original)}};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:390,dailyOrderNumber:390});
  const reply=await h.sendQueued(numeric?'1 sin azúcar':'Limonada sin azúcar');
  expect(reply).not.toMatch(/no pude|no entend/i);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0]).toMatchObject({productId:39002,quantity});
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Limonada'});
  expect(h.conv.sessionData.cart[0].note).toMatch(/sin cebolla/i);
  expect(h.conv.sessionData.cart[0].note).toMatch(/sin az[uú]car/i);
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(quantity);
  for(const item of items){expect(item.productId).toBe(39002);expect(item.note).toMatch(/sin az[uú]car/i);expect(item.note).toMatch(/sin cebolla/i);}
 });
}
for(const agent of [false,true])for(const guard of ['stale','withdrawn','question','duplicate'])it(`replacement note guard ${agent}/${guard}`,async()=>{
 const menu=[{id:39011,code:11,name:'Bowl Vegetal',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:39012,code:12,name:'Combo Bowl Vegetal',price:25000,availableNow:guard!=='withdrawn',hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Colombiana']}]}];
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 const original={productId:39011,code:11,name:menu[0].name,unitPrice:20000,quantity:1,note:guard==='duplicate'?'Sin azúcar':'Sin cebolla'};
 h.conv.sessionData.cart=[structuredClone(original)];h.conv.state='awaiting_attribute';
 h.conv.sessionData.pendingAttribute={productId:39012,code:12,price:25000,name:menu[1].name,attributes:menu[1].attributes,selected:[],quantity:1,sourceText:'cambia a combo',replacement:{originalLine:original}};
 if(guard==='stale')h.conv.sessionData.cart[0].quantity=2;
 const before=structuredClone(h.conv.sessionData.cart);
 h.service.ordersService.create=jest.fn();
 const reply=await h.sendQueued(guard==='question'?'¿La limonada viene sin azúcar?':'Limonada sin azúcar');
 if(guard==='duplicate'){
  expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].productId).toBe(39012);
  expect(h.conv.sessionData.cart[0].note?.match(/sin az[uú]car/gi)).toHaveLength(1);
 }else {expect(h.conv.sessionData.cart).toEqual(before);expect(reply).not.toMatch(/Listo ✅.*Combo Bowl Vegetal/);}
 if(guard==='withdrawn')expect(reply).toMatch(/no está disponible/i);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
