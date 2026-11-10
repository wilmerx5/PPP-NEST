import { harness, products } from './whatsapp-accuracy.test-support';
const families=[
 {name:'Sobrebarriga',request:'una sobrebarriga sudada',id:13,side:9,drink:42,rejected:7,menu:products},
 {name:'Bowl De Garbanzos',request:'un Bowl De Garbanzos',id:46201,side:46202,drink:46203,rejected:46204,menu:[
  {id:46201,code:11,name:'Bowl De Garbanzos',description:'Con ensalada, yuca y arroz',price:18000,availableNow:true,attributes:[]},
  {id:46202,code:12,name:'Porcion De Papa Francesa',price:7000,availableNow:true,attributes:[]},
  {id:46203,code:13,name:'Gaseosa 1.5L',price:7000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Ginger','Colombiana']}]},
  {id:46204,code:14,name:'Porcion De Yuca Frita',price:6000,availableNow:true,attributes:[]},
 ]},
];
families.push({...families[1],name:'Filete De Tofu',request:'un Filete De Tofu',menu:families[1].menu.map(p=>p.id===46201?{...p,name:'Filete De Tofu'}:p)});
for(const f of families)for(const agent of [false,true])for(const repeat of [false,true])for(const exclusion of ['sin ensalada','sin yuca','sin ensalada y sin yuca','sin ensalada ni yuca','sin yuca y sin ensalada','sin ensalada y sin yuca y sin cebolla'])for(const phase of ['empty','payment','final']){
 it(`${f.name} refuses included sides without selling them ${agent}/${repeat}/${exclusion}/${phase}`,async()=>{
  const extra={id:46209,code:19,name:'Crema De Tomate',price:8000,availableNow:true,attributes:[]};
  const prior={id:46208,code:18,name:'Arroz Blanco',price:6000,availableNow:true,attributes:[]};
  const h=harness([...f.menu,extra,prior],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});h.service.ordersService.create=jest.fn().mockResolvedValue({id:462,dailyOrderNumber:462});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  if(phase!=='empty'){await h.sendQueued('Un Arroz Blanco bien empacado');await h.sendQueued('nada mas');if(phase==='final')await h.sendQueued('contraentrega');expect(h.conv.state).toBe(phase==='final'?'awaiting_final_confirm':'awaiting_payment');}
  const previous=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`Me regalas ${f.request} ${exclusion} y me regalas una porción de francesa adicional y una ginger`);
  expect(h.conv.sessionData.cart.map(p=>[p.productId,p.quantity]).sort()).toEqual([[f.id,1],[f.side,1],[f.drink,1],...previous.map(p=>[p.productId,p.quantity])].sort());
  const assertExclusions=(note:string|undefined)=>{for(const ingredient of ['ensalada','yuca','cebolla'])if(exclusion.includes(ingredient)){expect(note).toMatch(new RegExp('sin.*'+ingredient,'i'));expect(note).not.toMatch(new RegExp('con '+ingredient,'i'));}};
  const meal=h.conv.sessionData.cart.find(p=>p.productId===f.id)!;assertExclusions(meal.note);
  expect(reply).not.toMatch(/no manejamos.*sin yuca|yuca.*alternativa|agrego.*yuca/i);expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
  if(repeat)await h.sendQueued(`la ${f.name} sin ${exclusion.includes('ensalada')?'ensalada':'yuca'} por favor`);
  await h.sendQueued('Una Crema De Tomate');
  expect(h.conv.sessionData.cart.filter(p=>p.productId===46208)).toEqual(previous);
  const saved=h.conv.sessionData.cart.find(p=>p.productId===f.id)!;assertExclusions(saved.note);
  for(const row of h.conv.sessionData.cart.filter(p=>p.productId!==f.id))expect(row.note||'').not.toMatch(/sin ensalada|sin yuca/i);
  await h.sendQueued('nada mas');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(p=>p.productId).sort()).toEqual([f.id,f.side,f.drink,46209,...previous.map(p=>p.productId)].sort());assertExclusions(dto.items.find(p=>p.productId===f.id).note);
 });
}
