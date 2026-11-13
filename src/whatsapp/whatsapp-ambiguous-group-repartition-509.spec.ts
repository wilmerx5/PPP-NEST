import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const removal of ['quita 1 de los de mango','retira uno de los de mango'])
for(const repartition of [
 'los quiero 1 con mango en vaso y 1 con mango en botella y 2 con lulo en botella',
 'los quiero 2 con mango en botella y 2 con lulo en botella',
 'los quiero 4 con lulo en botella',
]) {
 test(`${name}/${agent}/${removal}/${repartition}: full repartition recovers ambiguous removal`,async()=>{
  const h=setup(name,agent);
  await h.sendQueued('quiero una Sopa Vegetal');await h.sendQueued(`quiero cuatro ${name}`);
  await h.sendQueued('1 con mango en vaso');await h.sendQueued('1 con mango en botella');
  const before=structuredClone(h.conv.sessionData);
  expect(await h.sendQueued(removal)).toMatch(/grupo elegido|reparto completo/i);
  expect(h.conv.sessionData).toEqual(before);
  expect(await h.sendQueued(`cuanto cuesta ${name}`)).toMatch(/9[.,]000/);
  expect(h.conv.sessionData.pendingAttribute).toEqual(before.pendingAttribute);
  expect(h.conv.sessionData.cart).toEqual(before.cart);
  await h.sendQueued(repartition);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  await close(h,4);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  const mango=repartition.includes('4 con lulo')?0:2;
  expect(items.filter((item:any)=>item.productId===95071&&item.attributes.some((a:any)=>a.attributeValue==='Mango'))).toHaveLength(mango);
  expect(items.filter((item:any)=>item.productId===95071&&item.attributes.some((a:any)=>a.attributeValue==='Lulo'))).toHaveLength(4-mango);
  expect(items.filter((item:any)=>item.productId===95071&&item.attributes.some((a:any)=>a.attributeValue==='Vaso'))).toHaveLength(repartition.includes('1 con mango en vaso')?1:0);
 });
}
function setup(name:string,agent:boolean){
 const h=harness([
  {id:95071,code:81,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']},{attributeName:'Presentación',options:['Vaso','Botella']}]},
  {id:95072,code:82,name:'Sopa Vegetal',price:10000,availableNow:true,attributes:[]}
 ],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:507,dailyOrderNumber:507});
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
