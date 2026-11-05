import { harness } from './whatsapp-accuracy.test-support';

for (const agent of [false,true]) for (const family of ['Pollo','Bowl']) for (const phrase of ['cancela el','no quiero el']) {
 it(`cancel active combo preserves queued purchase ${agent}/${family}/${phrase}`, async()=>{
  const menu=[
   {id:39701,code:1,name:'Sopa De Verduras',price:9000,availableNow:true,hasAttributes:false,attributes:[]},
   {id:39702,code:2,name:`Combo ${family} Frito`,price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Colombiana']}]},
   {id:39703,code:3,name:`Combo ${family} Asado`,price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Colombiana']}]},
   {id:39704,code:4,name:'Jugo Natural En Agua',price:5000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
  ];
  const h=harness(menu,agent);
  const original={productId:39701,code:1,name:menu[0].name,unitPrice:9000,quantity:1,note:'Bien caliente'};
  h.conv.sessionData.cart=[structuredClone(original)];h.conv.state='awaiting_attribute';
  h.conv.sessionData.pendingAttribute={productId:39702,code:2,name:menu[1].name,price:25000,quantity:2,attributes:menu[1].attributes,selected:[],sourceText:`dos ${menu[1].name}`};
  h.conv.sessionData.pendingMultiOrder={confident:[],ambiguous:[],unresolved:[],needsAttributes:[
   {productId:39702,code:2,price:25000,name:menu[1].name,segment:`dos ${menu[1].name}`},
   {productId:39703,code:3,price:27000,name:menu[2].name,segment:`tres ${menu[2].name} sin cebolla`},
   {productId:39704,code:4,price:5000,name:menu[3].name,segment:'un Jugo Natural En Agua'},
  ]};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:397,dailyOrderNumber:397});
  const pending=structuredClone(h.conv.sessionData.pendingAttribute);
  const reply=await h.sendQueued(`${phrase} ${menu[2].name}`);
  expect(h.conv.sessionData.cart.find(line=>line.productId===39701)).toEqual(original);
  expect(h.conv.sessionData.cart).toEqual([original]);
  expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
  expect(h.conv.sessionData.pendingMultiOrder?.needsAttributes.map(item=>item.productId)).toEqual([39702,39704]);
  await h.sendQueued('Limonada');
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(39704);
  expect(reply).toContain(menu[2].name);
  expect(reply).not.toMatch(/pedido.*cancelado|armamos otro/i);
  await h.sendQueued('Mango');
  expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
  expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
  expect(h.conv.sessionData.cart).toHaveLength(3);
  expect(h.conv.sessionData.cart.find(line=>line.productId===39701)).toEqual(original);
  expect(h.conv.sessionData.cart.find(line=>line.productId===39702)).toMatchObject({quantity:2});
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);expect(items.filter(item=>item.productId===39702)).toHaveLength(2);
  expect(items.some(item=>item.productId===39703)).toBe(false);
 });
}
for (const agent of [false,true]) for (const guard of ['question','quoted','cart-collision','duplicate','last','whole-order']) {
 it(`named queue cancellation guard ${agent}/${guard}`,async()=>{
  const menu=[
   {id:39711,code:11,name:'Sopa De Verduras',price:9000,availableNow:true,hasAttributes:false,attributes:[]},
   {id:39712,code:12,name:'Combo Pollo Frito',price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Colombiana']}]},
   {id:39713,code:13,name:'Combo Pollo Asado',price:27000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Colombiana']}]},
   {id:39714,code:14,name:'Jugo Natural En Agua',price:5000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
  ];
  const h=harness(menu,agent);
  const original={productId:39711,code:11,name:menu[0].name,quantity:1,unitPrice:9000,note:'Bien caliente'};
  h.conv.sessionData.cart=[structuredClone(original)];h.conv.state='awaiting_attribute';
  h.conv.sessionData.pendingAttribute={productId:39712,code:12,price:25000,name:menu[1].name,quantity:2,attributes:menu[1].attributes,selected:[],sourceText:'dos Combo Pollo Frito'};
  const rows=menu.slice(1).map((item,i)=>({productId:item.id,code:item.code,price:item.price,name:item.name,segment:`${i===0?'dos':'un'} ${item.name}`}));
  if (guard==='duplicate') rows.push({...rows[1]});
  h.conv.sessionData.pendingMultiOrder={confident:[],ambiguous:[],unresolved:[],needsAttributes:rows};
  if (guard==='cart-collision') h.conv.sessionData.cart.push({productId:39713,code:13,name:menu[2].name,quantity:1,unitPrice:27000,note:'Sin cebolla'});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:397,dailyOrderNumber:397});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const before=structuredClone(h.conv.sessionData);
  const phrase=guard==='question'?'¿Cancela el Combo Pollo Asado?':guard==='quoted'? '"cancela el Combo Pollo Asado"':guard==='last'?'quita el Jugo Natural En Agua':guard==='whole-order'?'Quiero cancelar el pedido':'cancela el Combo Pollo Asado';
  const reply=await h.sendQueued(phrase);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if (guard==='whole-order') {
   expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();return;
  }
  expect(h.conv.sessionData.cart).toEqual(before.cart);
  expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
  if (guard==='last') {
   expect(h.conv.sessionData.pendingMultiOrder?.needsAttributes.map(item=>item.productId)).toEqual([39712,39713]);
  } else {
   expect(h.conv.sessionData.pendingMultiOrder).toEqual(before.pendingMultiOrder);
   if (guard==='duplicate') expect(reply).toMatch(/varias compras pendientes/i);
   if (guard==='question'||guard==='quoted') expect(reply).toMatch(/conservé las selecciones/i);
   if (guard==='cart-collision') {
    expect(reply).toMatch(/tanto en el carrito/i);
    await h.sendQueued('cancela la compra pendiente de Combo Pollo Asado');
    expect(h.conv.sessionData.cart).toEqual(before.cart);
    expect(h.conv.sessionData.pendingMultiOrder?.needsAttributes.map(item=>item.productId)).toEqual([39712,39714]);
    await h.sendQueued('Limonada');await h.sendQueued('Mango');await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items=h.service.ordersService.create.mock.calls[0][0].items;
    expect(items).toHaveLength(5);expect(items.filter(item=>item.productId===39713)).toHaveLength(1);
   }
  }
 });
}
