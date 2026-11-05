import { harness } from './whatsapp-accuracy.test-support';

for (const agent of [false,true]) for (const family of ['Pollo','Bowl']) for (const phrase of ['cancela ese combo','no quiero ese combo']) {
 it(`cancel active combo preserves queued purchase ${agent}/${family}/${phrase}`, async()=>{
  const menu=[
   {id:39601,code:1,name:'Sopa De Verduras',price:9000,availableNow:true,hasAttributes:false,attributes:[]},
   {id:39602,code:2,name:`Combo ${family} Frito`,price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Colombiana']}]},
   {id:39603,code:3,name:`Combo ${family} Asado`,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Colombiana']}]},
   {id:39604,code:4,name:'Jugo Natural En Agua',price:5000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
  ];
  const h=harness(menu,agent);
  const original={productId:39601,code:1,name:menu[0].name,unitPrice:9000,quantity:1,note:'Bien caliente'};
  h.conv.sessionData.cart=[structuredClone(original)];h.conv.state='awaiting_attribute';
  h.conv.sessionData.pendingAttribute={productId:39602,code:2,name:menu[1].name,price:25000,quantity:2,attributes:menu[1].attributes,selected:[],sourceText:`dos ${menu[1].name}`};
  h.conv.sessionData.pendingMultiOrder={confident:[],ambiguous:[],unresolved:[],needsAttributes:[
   {productId:39602,code:2,price:25000,name:menu[1].name,segment:`dos ${menu[1].name}`},
   {productId:39603,code:3,price:27000,name:menu[2].name,segment:`tres ${menu[2].name} sin cebolla`},
   {productId:39604,code:4,price:5000,name:menu[3].name,segment:'un Jugo Natural En Agua'},
  ]};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:396,dailyOrderNumber:396});
  const reply=await h.sendQueued(phrase);
  expect(h.conv.sessionData.cart.find(line=>line.productId===39601)).toEqual(original);
  expect(h.conv.sessionData.cart.some(line=>line.productId===39602)).toBe(false);
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(39604);
  expect(reply).toContain(menu[3].name);
  expect(reply).not.toMatch(/pedido.*cancelado|armamos otro/i);
  await h.sendQueued('Mango');
  expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
  expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
  expect(h.conv.sessionData.cart).toHaveLength(3);
  expect(h.conv.sessionData.cart.find(line=>line.productId===39601)).toEqual(original);
  expect(h.conv.sessionData.cart.find(line=>line.productId===39603)).toMatchObject({quantity:3,note:expect.stringMatching(/sin cebolla/i)});
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(5);expect(items.filter(item=>item.productId===39603)).toHaveLength(3);
  expect(items.some(item=>item.productId===39602)).toBe(false);
 });
}
for (const agent of [false,true]) for (const guard of ['replacement','whole-order','question']) {
 it(`combo cancellation scope ${agent}/${guard}`,async()=>{
  const menu=[
   {id:39611,code:11,name:'Pollo Frito',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
   {id:39612,code:12,name:'Combo Pollo Frito',price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Colombiana']}]},
  ];
  const h=harness(menu,agent);
  const original={productId:39611,code:11,name:menu[0].name,unitPrice:20000,quantity:2,note:'Sin cebolla'};
  h.conv.sessionData.cart=[structuredClone(original)];h.conv.state='awaiting_attribute';
  h.conv.sessionData.pendingAttribute={productId:39612,code:12,price:25000,name:menu[1].name,attributes:menu[1].attributes,selected:[],quantity:2,sourceText:'cambia a combo',replacement:{originalLine:structuredClone(original)}};
  h.service.ordersService.create=jest.fn();
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const pending=structuredClone(h.conv.sessionData.pendingAttribute);
  const reply=await h.sendQueued(guard==='whole-order'?'Quiero cancelar el pedido':guard==='question'?'¿Cancela ese combo?':'cancela ese combo');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if (guard==='whole-order') {
   expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
  } else {
   expect(h.conv.sessionData.cart).toEqual([original]);
   if (guard==='question') expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
   else {expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(reply).toMatch(/conservo el producto original/i);}
  }
 });
}
