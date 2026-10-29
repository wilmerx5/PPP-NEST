import { cartTotalFollowupIntent } from './whatsapp-intent';
import { harness } from './whatsapp-accuracy.test-support';
const menus = [
 {family:'Ejecutivo Con Pollo',protein:'Pollo',key:'Presa',choice:'Pechuga'},
 {family:'Bandeja Con Tofu',protein:'Tofu',key:'Corte',choice:'Filete'},
 {family:'Plato Con Pescado',protein:'Pescado',key:'Corte',choice:'Lomo'},
];
function setup(m:typeof menus[number],agent:boolean,state:string,quantity:number,index=0){
 const attrs=[{attributeName:m.key,options:[m.choice,'Cubos']},{attributeName:'Bebida',options:['Limonada','Cola']}];
 const menu=[{id:89501,code:89501,name:m.family+' Frito',price:24000,hasAttributes:true,availableNow:true,attributes:attrs},{id:89502,code:89502,name:m.family+' Broaster',price:25000,hasAttributes:true,availableNow:true,attributes:attrs}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn();h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const line={productId:89501,code:89501,name:menu[0].name,quantity,unitPrice:24000,note:'Sin sal; bebida bajita de azúcar',attributes:[{attributeName:m.key,attributeValue:m.choice},{attributeName:'Bebida',attributeValue:'Limonada'}]};
 const other={...structuredClone(line),quantity:1,note:'Salsa aparte',attributes:[{attributeName:m.key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}]};
 h.conv.sessionData.cart=index?[other,line]:[line,other];h.conv.state=state;
 return {h,menu,line};
}

// A mixed request with unresolved product options must preserve both operations.
// Recovery is explicit: add + select an option, then separately request removal.
for (const m of menus) for (const agent of [false, true])
for (const quantity of [1, 2]) for (const answer of ['number', 'name', 'invalid'])
for (const askTotal of [false, true]) {
 it(`mixed option recovery ${m.family} agent=${agent} quantity=${quantity} answer=${answer} total=${askTotal}`, async () => {
  const {h, menu} = setup(m, agent, 'building_cart', 3);
  const target = {
   id: 89503, code: 89503,
   name: ({Pollo: 'Jugo Tropical', Tofu: 'Batido Natural', Pescado: 'Smoothie Frutal'} as Record<string,string>)[m.protein],
   price: 7000, hasAttributes: true, availableNow: true,
   attributes: [{attributeName: 'Sabor', options: ['Mango', 'Fresa']}],
  };
  menu.push(target);
  const before = structuredClone(h.conv.sessionData.cart);
  const reply = await h.sendQueued(`quita uno de los de ${m.choice} y agrega ${quantity} ${target.name}`);
  expect(reply).toMatch(/opciones|elección/i);
  expect(reply).toMatch(/pedido sigue igual/i);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();

  await h.sendQueued(`agrega ${quantity} ${target.name}`);
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(target.id);
  expect(h.conv.sessionData.cart).toEqual(before);
  if (askTotal) {
   const totalReply = await h.sendQueued(answer === 'number' ? 'cuánto va todo' : answer === 'name' ? 'en cuánto va todo' : 'cuánto va el pedido hasta ahora');
   expect(totalReply).toMatch(/96[.,]000/);
   expect(h.service.aiService.generateTurn).not.toHaveBeenCalled();
   expect(h.conv.sessionData.cart).toEqual(before);
   expect(h.conv.sessionData.pendingAttribute?.productId).toBe(target.id);
  }
  if (answer === 'invalid') {
   await h.sendQueued('Maracuya');
   expect(h.conv.sessionData.cart).toEqual(before);
   expect(h.conv.sessionData.pendingAttribute?.productId).toBe(target.id);
  }
  await h.sendQueued(answer === 'number' ? '2' : 'Fresa');
  const added = {productId: target.id, code: target.code, name: target.name,
   quantity, unitPrice: target.price, attributes: [{attributeName:'Sabor',attributeValue:'Fresa'}]};
  expect(h.conv.sessionData.cart).toEqual([...before, added]);
  expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
  const removedReply = await h.sendQueued(`quita uno de los de ${m.choice}`);
  expect(h.conv.sessionData.cart).toEqual([{...before[0],quantity:2},before[1],added]);
  expect(removedReply).toMatch(/quit|retir/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

it.each(['cuánto va todo si agrego sopa', 'en cuánto va el arroz', 'cuánto va a tardar todo', 'cuánto va todo sin la bebida', 'no quiero saber cuánto va todo', 'cuánto va todo y agrega uno', 'cuánto va todo para diez personas', 'cuánto va todo mañana'])('does not consume conditional or specific question: %s', text => {
 expect(cartTotalFollowupIntent(text)).toBeNull();
});
