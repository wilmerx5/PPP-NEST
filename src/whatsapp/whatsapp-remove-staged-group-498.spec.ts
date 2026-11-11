import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const assigned of [1,2]) for(const keepOther of [false,true])
for(const phrase of ['quita los de mango','retira los de mango']) {
 test(`${name}/${agent}/${assigned}/${keepOther}/${phrase}: remove staged flavor while keeping unresolved units`,async()=>{
  const h=setup(name,agent);
  await h.sendQueued('quiero una Sopa Vegetal');await h.sendQueued(`quiero ${assigned+2+(keepOther?1:0)} ${name}`);
  await h.sendQueued(`${assigned} con mango en vaso`);
  if(keepOther) await h.sendQueued('1 con lulo en vaso');
  const cart=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(phrase);
  expect(reply).toMatch(/retir|quit/i);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(keepOther?3:2);
  expect(h.conv.sessionData.pendingAttribute?.distributionParts||[]).toEqual(keepOther?['1 con lulo en vaso']:[]);
  await h.sendQueued(keepOther?'los otros con lulo en botella':'con lulo en botella');
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  await close(h,keepOther?3:2);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items.some((item:any)=>item.attributes?.some((a:any)=>a.attributeValue==='Mango'))).toBe(false);
  expect(items.filter((item:any)=>item.productId===94981&&item.attributes.some((a:any)=>a.attributeValue==='Vaso'))).toHaveLength(keepOther?1:0);
  expect(items.filter((item:any)=>item.productId===94981&&item.attributes.some((a:any)=>a.attributeValue==='Lulo')&&item.attributes.some((a:any)=>a.attributeValue==='Botella'))).toHaveLength(2);
 });
}
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true]) {
 test(`${name}/${agent}: ambiguous cart flavor needs explicit pending replacement`,async()=>{
  const h=setup(name,agent);
  await h.sendQueued('quiero una Sopa Vegetal');
  await h.sendQueued(`quiero un ${name} con mango en vaso`);
  await h.sendQueued(`quiero cuatro ${name}`);await h.sendQueued('dos con mango en vaso');
  const cart=structuredClone(h.conv.sessionData.cart),pending=structuredClone(h.conv.sessionData.pendingAttribute);
  expect(await h.sendQueued('quita los de mango')).toMatch(/carrito.*compra pendiente/i);
  expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
  await h.sendQueued('mejor solo 2 con lulo en botella');
  await close(h,3);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items.filter((item:any)=>item.productId===94981&&item.attributes.some((a:any)=>a.attributeValue==='Mango'))).toHaveLength(1);
  expect(items.filter((item:any)=>item.productId===94981&&item.attributes.some((a:any)=>a.attributeValue==='Lulo'))).toHaveLength(2);
 });
}
function setup(name:string,agent:boolean){
 const h=harness([
  {id:94981,code:81,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']},{attributeName:'Presentación',options:['Vaso','Botella']}]},
  {id:94982,code:82,name:'Sopa Vegetal',price:10000,availableNow:true,attributes:[]}
 ],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:498,dailyOrderNumber:498});
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
