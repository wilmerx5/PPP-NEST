import {harness,products} from './whatsapp-accuracy.test-support';
for(const agent of [false,true]){
 it(`reported explicit combo keeps food and included options agent=${agent}`,async()=>{
  const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued('reiniciar');await h.sendQueued('quiero un pollito frito en combo con gaseosa colombiana con las arepas fritas');
  expect(h.conv.sessionData.pendingMatch?.candidates.every(p=>/^Gaseosa/.test(p.name))).not.toBe(true);
  expect(h.conv.sessionData.cart).toHaveLength(1);const item=h.conv.sessionData.cart[0];expect(item.productId).toBe(99);expect(item.quantity).toBe(1);
  expect(item.attributes).toEqual(expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Colombiana'},{attributeName:'Arepas',attributeValue:'Fritas'}]));
  expect(h.replies.at(-1)).toMatch(/Combo De Pollo Frito/i);expect(h.replies.at(-1)).not.toMatch(/en cu[aá]l lo quieres/i);
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});const before=structuredClone(item);
  await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual([{productId:99,attributes:before.attributes,note:before.note}]);
 });
 it(`category index belongs to last displayed rice list agent=${agent}`,async()=>{
  const menu=products.map((p:any)=>({...p,categoryName:/^Porcion/i.test(p.name)?'Porciones':/arroz/i.test(p.name)?'Arroces':/jugo|limonada/i.test(p.name)?'Jugos':/^Gaseosa/i.test(p.name)?'Bebidas':'Pollo'}));
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
  // Seed the overview actually displayed in the supplied transcript; inference is simulated.
  const categories=['Pollo','Platos a la carta','Bandejas con pollo','Arroces','Comidas Rapidas','Bebidas','Sopas','Porciones'];
  h.conv.sessionData.pendingCategoryBrowse={categories};
  h.agent.runTurn.mockResolvedValue({reply:'📋 Arroces: 1. Arroz Con Pollo. Escribe el número.',actions:{},toolCalls:['search_menu']});
  await h.sendQueued(String(categories!.indexOf('Arroces')+1));
  const offered=h.conv.sessionData.pendingMatch?.candidates;expect(offered?.[0].id).toBe(23);expect(h.replies.at(-1)).toMatch(/Arroces/);
  await h.sendQueued('1');expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].productId).toBe(23);expect(h.conv.sessionData.pendingCategoryBrowse).toBeUndefined();expect(h.replies.at(-1)).toMatch(/Arroz Con Pollo/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}

for(const food of ['Pollo','Pescado','Tofu'])for(const agent of [false,true])for(const scenario of ['combo','two combos','standalone drink','question'])it(`${food}/${agent}/${scenario}: flavor cannot discard a combo family`,async()=>{
 const combo=(id:number,style:string)=>({id,code:id,name:`Combo De ${food} ${style}`,description:'Con bebida y arepas',price:30000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Naranja']},{attributeName:'Arepas',options:['Blancas','Fritas']}]});
 const drink=(id:number,size:string)=>({id,code:id,name:`Gaseosa ${size}`,price:5000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Colombiana','Naranja']}]});
 const menu=[combo(9701,'Frito'),combo(9702,'Broaster'),drink(9703,'250ml'),drink(9704,'400ml')];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 if(scenario==='question'){
  await h.sendQueued(`¿Tienen combo de ${food} frito con gaseosa colombiana?`);expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
 }
 if(scenario==='standalone drink'){
  await h.sendQueued('quiero una gaseosa 250ml colombiana');expect(h.conv.sessionData.cart.map(r=>r.productId)).toEqual([9703]);expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Sabor',attributeValue:'Colombiana'});return;
 }
 const quantity=scenario==='two combos'?2:1;
 await h.sendQueued(`quiero ${quantity===2?'dos':'un'} ${food.toLowerCase()} frito en combo con gaseosa colombiana con las arepas fritas`);
 expect(h.conv.sessionData.cart).toHaveLength(1);const item=h.conv.sessionData.cart[0];expect(item).toMatchObject({productId:9701,quantity});expect(item.attributes).toEqual(expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Colombiana'},{attributeName:'Arepas',attributeValue:'Fritas'}]));expect(h.replies.at(-1)).toContain(menu[0].name);
 Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});const before=structuredClone(item);await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual(Array.from({length:quantity},()=>({productId:9701,attributes:before.attributes,note:before.note})));
});

for(const agent of [false,true])it(`juice alone retains base choice agent=${agent}`,async()=>{
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('quiero un jugo de lulo');expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([50,51]);await h.sendQueued('1');expect(h.conv.sessionData.cart.map(r=>r.productId)).toEqual([50]);expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Sabor',attributeValue:'Lulo'});
});

for(const agent of [false,true])it(`unqualified combo keeps existing selection entry agent=${agent}`,async()=>{
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.agent.runTurn.mockResolvedValue({reply:'Dime el plato o el código',actions:{},toolCalls:[]});
 await h.sendQueued('Me regalas un combo');expect(h.conv.sessionData.cart).toEqual([]);if(agent){expect(h.agent.runTurn).toHaveBeenCalled();return;}await h.sendQueued('De broster');await h.sendQueued('Coca. Cola');await h.sendQueued('Y arepas fritas');
 expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99,quantity:1});expect(h.conv.sessionData.cart[0].attributes).toEqual(expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Coca Cola'},{attributeName:'Arepas',attributeValue:'Fritas'}]));
});
