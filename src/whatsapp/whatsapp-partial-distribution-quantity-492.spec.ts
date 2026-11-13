import {harness} from './whatsapp-accuracy.test-support';

for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const assigned of [1,2]) for(const quantity of [assigned+1,assigned+3]) for(const correction of ['mejor que sean','cambia la cantidad a','mejor solo']) {
 test(`${name}/${agent}/${assigned}/${quantity}/${correction}: preserve assigned flavor when pending total changes`,async()=>{
  const h=harness([
   {id:94921,code:81,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
   {id:94922,code:82,name:'Sopa Vegetal',price:10000,availableNow:true,attributes:[]}
  ],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:492,dailyOrderNumber:492});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('quiero una Sopa Vegetal');await h.sendQueued(`quiero ${assigned+2} ${name}`);
  const cart=structuredClone(h.conv.sessionData.cart);
  expect(await h.sendQueued(`${assigned===1?'uno':'dos'} con mango`)).toMatch(/Faltan 2 unidades/);
  const parts=structuredClone(h.conv.sessionData.pendingAttribute?.distributionParts);
  expect(parts).toEqual([`${assigned} con mango`]);expect(h.conv.sessionData.cart).toEqual(cart);
  const reply=await h.sendQueued(`${correction} ${({2:'dos',3:'tres',4:'cuatro',5:'cinco'} as Record<number,string>)[quantity]}`);
  expect(reply).toContain(`${quantity} unidades`);
  expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(quantity);
  expect(h.conv.sessionData.pendingAttribute?.distributionParts).toEqual(parts);
  expect(h.conv.sessionData.cart).toEqual(cart);
  const pending=structuredClone(h.conv.sessionData.pendingAttribute);
  expect(await h.sendQueued(`cuánto cuesta ${name}`)).toMatch(/9[.,]000/);
  expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
  await h.sendQueued('los otros con mora');
  expect(h.conv.sessionData.pendingAttribute).toEqual(pending);expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const complete=await h.sendQueued('los otros con lulo');
  expect(complete).toMatch(/Mango/i);expect(complete).toMatch(/Lulo/i);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  const desserts=h.cartRows().filter(row=>row.id===94921);
  expect(desserts.find(row=>row.attrs.includes('Sabor:Mango'))?.qty).toBe(assigned);
  expect(desserts.find(row=>row.attrs.includes('Sabor:Lulo'))?.qty).toBe(quantity-assigned);
  expect(h.cartRows().find(row=>row.id===94922)?.qty).toBe(1);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.replies.at(-1)).toContain((10000+9000*quantity).toLocaleString('es-CO'));
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(quantity+1);
  for(const [flavor,count] of [['Mango',assigned],['Lulo',quantity-assigned]] as const) expect(items.filter((item:any)=>item.productId===94921&&item.attributes.some((a:any)=>a.attributeName==='Sabor'&&a.attributeValue===flavor))).toHaveLength(count);
 });
}
