import {harness} from './whatsapp-accuracy.test-support';
for (const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for (const agent of [false,true])
for (const optionText of ['con lulo en botella','con botella de lulo']) for (const quantity of [1,2,3]) for (const phrase of ['mejor solo','que sean','mejor que sean','en vez de cuatro quiero']) {
 test(`${name}/${agent}/${quantity}/${phrase}/${optionText}: replace quantity and flavor after partial allocation`,async()=>{
  const h=setup(name,agent);
  await h.sendQueued('quiero una Sopa Vegetal');await h.sendQueued(`quiero cuatro ${name}`);
  await h.sendQueued('dos con mango en vaso');
  expect(h.conv.sessionData.pendingAttribute?.distributionParts).toEqual(['2 con mango en vaso']);
  const reply=await h.sendQueued(`${phrase} ${quantity} ${optionText}`);
  expect(reply).toMatch(/Lulo/i);expect(reply).toMatch(/Botella/i);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  expect(h.cartRows().filter(row=>row.id===94961).reduce((n,row)=>n+row.qty,0)).toBe(quantity);
  expect(h.cartRows().find(row=>row.id===94962)?.qty).toBe(1);
  const cart=structuredClone(h.conv.sessionData.cart);
  expect(await h.sendQueued(`cuanto cuesta ${name}`)).toMatch(/9[.,]000/);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  await close(h,quantity);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items.filter((item:any)=>item.productId===94961&&item.attributes.some((a:any)=>a.attributeValue==='Lulo')&&item.attributes.some((a:any)=>a.attributeValue==='Botella'))).toHaveLength(quantity);
  expect(items.some((item:any)=>item.attributes?.some((a:any)=>a.attributeValue==='Mango'))).toBe(false);
 });
}
function setup(name:string,agent:boolean){
 const h=harness([
  {id:94961,code:81,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']},{attributeName:'Presentación',options:['Vaso','Botella']}]},
  {id:94962,code:82,name:'Sopa Vegetal',price:10000,availableNow:true,attributes:[]}
 ],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:496,dailyOrderNumber:496});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 return h;
}
async function close(h:ReturnType<typeof setup>,quantity:number){
 await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
 expect(h.replies.at(-1)).toContain((10000+quantity*9000).toLocaleString('es-CO'));
 expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(quantity+1);
}
