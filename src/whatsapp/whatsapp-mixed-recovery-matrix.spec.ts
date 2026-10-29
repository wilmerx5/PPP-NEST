import {harness} from './whatsapp-accuracy.test-support';

const catalogs=[
 {name:'Ejecutivo Con Pollo Frito',key:'Presa',choice:'Pechuga',addition:'Agua Mineral'},
 {name:'Bandeja Con Tofu',key:'Corte',choice:'Filete',addition:'Papas Rusticas'},
 {name:'Plato Con Pescado',key:'Corte',choice:'Lomo',addition:'Te Frio'},
];
const faults=['unknown target','insufficient','negative removal','decimal addition','zero addition','unknown source','condition','third action'];

// Synthetic multi-turn matrix, not 384 distinct real customer conversations.
for(const catalog of catalogs) for(const agent of [false,true])
for(const payment of ['efectivo','transferencia']) for(const remaining of [0,2])
for(const merge of [false,true]) for(const fault of faults) {
 it(`atomic recovery ${catalog.name} ${agent} ${payment} left=${remaining} merge=${merge} ${fault}`,async()=>{
  const menu=[
   {id:97301,code:97301,name:catalog.name,price:24000,availableNow:true,hasAttributes:true,
    attributes:[{attributeName:catalog.key,options:[catalog.choice,'Cubos']},{attributeName:'Bebida',options:['Limonada','Cola']}]},
   {id:97302,code:97302,name:catalog.addition,price:7000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  const h=harness(menu,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:298,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const source={productId:97301,code:97301,name:catalog.name,quantity:2+remaining,unitPrice:24000,
   note:'Sin sal; bebida bajita de azúcar',attributes:[{attributeName:catalog.key,attributeValue:catalog.choice},{attributeName:'Bebida',attributeValue:'Limonada'}]};
  const sibling={...structuredClone(source),quantity:1,note:'Salsa aparte',attributes:[{attributeName:catalog.key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}]};
  const addition={productId:97302,code:97302,name:catalog.addition,quantity:1,unitPrice:7000,attributes:[]};
  const original=[source,sibling,...(merge?[addition]:[])];
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,cart:structuredClone(original)});
  const count=fault==='insufficient'?'cinco':fault==='negative removal'?'-1':'dos';
  const add=fault==='decimal addition'?'1.5':fault==='zero addition'?'0':'tres';
  const reference=fault==='unknown source'?'opcion inexistente':catalog.choice+(fault==='condition'?' si hay sopa':'');
  const target=fault==='unknown target'?'producto inexistente':catalog.addition+(fault==='third action'?' y cambia el otro':'');
  const rejected=await h.sendQueued(`quita ${count} de los de ${reference} y agrega ${add} ${target}`);
  expect(rejected).toMatch(/pedido sigue igual/i);
  expect(h.conv.sessionData.cart).toEqual(original);
  expect(h.conv.state).toBe('building_cart');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();

  // The current contract requests the complete corrected instruction, not a short clarification.
  const accepted=await h.sendQueued(`quita dos de los de ${catalog.choice} y agrega tres ${catalog.addition}`);
  const expected=[...(remaining?[{...source,quantity:remaining}]:[]),sibling,{...addition,quantity:3+(merge?1:0)}];
  expect(h.conv.sessionData.cart).toEqual(expected);
  expect(accepted).toMatch(/quité.*agregué/);
  expect(h.conv.state).toBe('building_cart');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('no más, recojo en el local');
  expect(h.conv.state).toBe('awaiting_payment');
  await h.sendQueued(payment);
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.conv.sessionData.cart).toEqual(expected);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const receipt=await h.sendQueued('confirmar');
  expect(h.conv.state).toBe('completed');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  const units=expected.flatMap(line=>Array.from({length:line.quantity},()=>({productId:line.productId,attributes:line.attributes,...('note' in line?{note:line.note}:{})})));
  expect(items).toHaveLength(remaining+4+(merge?1:0));
  expect(items).toEqual(units.map(unit=>expect.objectContaining(unit)));
  for(const item of items.filter(item=>item.productId===97302)) expect(item.note||'').toBe('');
  expect(receipt).toContain(catalog.name);
  expect(receipt).toContain(catalog.addition);
  expect(receipt).toContain('Salsa aparte');
  if(remaining) expect(receipt).toContain(source.note);
  else expect(receipt).not.toContain(source.note);
  const total=(remaining+1)*24000+(3+(merge?1:0))*7000;
  expect(receipt).toContain(total.toLocaleString('es-CO'));
 });
}
