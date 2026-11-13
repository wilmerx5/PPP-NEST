import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Helado Artesanal','Paleta Frutal','Sorbete Natural']) for(const agent of [false,true])
for(const keep of [0,1]) for(const [remove,spoken] of [[1,'un'],[1,'uno'],[1,'una'],[2,'dos'],[3,'tres']] as const) for(const verb of ['quita','retira']) {
 test(`${name}/${agent}/${keep}/${remove}/${spoken}/${verb}: remove only specified staged units`,async()=>{
  const h=setup(name,agent);
  await h.sendQueued('quiero una Sopa Vegetal');await h.sendQueued(`quiero ${remove+keep+2} ${name}`);
  await h.sendQueued(`${remove+keep} con mango en vaso`);
  const cart=structuredClone(h.conv.sessionData.cart);
  expect(await h.sendQueued(`${verb} ${spoken} de los de mango`)).toMatch(/Retiré/i);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(keep+2);
  expect(h.conv.sessionData.pendingAttribute?.distributionParts||[]).toEqual(keep?['1 con mango en vaso']:[]);
  const pending=structuredClone(h.conv.sessionData.pendingAttribute);
  expect(await h.sendQueued(`cuanto cuesta ${name}`)).toMatch(/9[.,]000/);
  expect(h.conv.sessionData.pendingAttribute).toEqual(pending);
  expect(h.conv.sessionData.cart).toEqual(cart);
  await h.sendQueued(keep?'los otros con lulo en botella':'con lulo en botella');await close(h,keep+2);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items.filter((item:any)=>item.productId===95071&&item.attributes.some((a:any)=>a.attributeValue==='Mango'))).toHaveLength(keep);
  expect(items.filter((item:any)=>item.productId===95071&&item.attributes.some((a:any)=>a.attributeValue==='Lulo'))).toHaveLength(2);
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
