import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const assigned of [1,2]) for(const interruption of ['repeat','price','confirm'])
for(const invalid of ['mora en botella','lulo en jarra','mora en jarra']) {
 test(`${name}/${agent}/${assigned}/${interruption}/${invalid}: invalid remaining options do not corrupt staged allocation`,async()=>{
  const h=setup(name,agent);
  await h.sendQueued('quiero una Sopa Vegetal');await h.sendQueued(`quiero ${assigned+2} ${name}`);
  await h.sendQueued(`${assigned} con mango en vaso`);
  const cart=structuredClone(h.conv.sessionData.cart);
  expect(h.conv.sessionData.pendingAttribute?.distributionParts).toEqual([`${assigned} con mango en vaso`]);
  const reply=await h.sendQueued(`los otros con ${invalid}`);
  expect(reply).toMatch(/opci[oó]n|disponible|elige|prefieres|sabor|presentaci[oó]n/i);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(assigned+2);
  await h.sendQueued(interruption==='repeat'?`los otros con ${invalid}`:interruption==='price'?`cuanto cuesta ${name}`:'confirmar');
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(assigned+2);
  await h.sendQueued('los otros con lulo en botella');
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  expect(h.cartRows().find(row=>row.id===94972)?.qty).toBe(1);
  await close(h,assigned+2);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  for(const [flavor,presentation] of [['Mango','Vaso'],['Lulo','Botella']]){
   expect(items.filter((item:any)=>item.productId===94971&&item.attributes.some((a:any)=>a.attributeValue===flavor)&&item.attributes.some((a:any)=>a.attributeValue===presentation))).toHaveLength(flavor==='Mango'?assigned:2);
  }
 });
}
function setup(name:string,agent:boolean){
 const h=harness([
  {id:94971,code:81,name,price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']},{attributeName:'Presentación',options:['Vaso','Botella']}]},
  {id:94972,code:82,name:'Sopa Vegetal',price:10000,availableNow:true,attributes:[]}
 ],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:497,dailyOrderNumber:497});
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
