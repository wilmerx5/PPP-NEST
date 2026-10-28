import {harness,products} from './whatsapp-accuracy.test-support';
for(const [dish,absent] of [['Bowl Andino','Brownie'],['Pasta Primavera','Flan'],['Ramen De Miso','Mochi']])for(const mode of ['absent','available','unmentioned']){
 it(`${dish}/${mode}: explain a verified conditional omission without inventing an absence`,async()=>{
  const menu=[{id:8841,code:8841,name:dish,price:20000,availableNow:true,attributes:[]},...(mode==='available'?[{id:8842,code:8842,name:absent,price:5000,availableNow:true,attributes:[]}]:[])];
  const h=harness(menu as never,true);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.agentService.runTurn.mockResolvedValue({reply:`Listo, agregué el plato. El ${absent} no lo agregué ni lo reemplacé.`,actions:{addItems:[{productId:8841,quantity:1}]},toolCalls:['add_item'],purchaseAttempts:[{productId:8841,accepted:true}]});
  await h.sendQueued(`Quiero un ${dish}`+(mode==='unmentioned'?'.':`. Si no venden ${absent}, no lo reemplaces.`));
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:8841,quantity:1})]);
  if(mode==='absent')expect(h.replies.join('\n')).toMatch(new RegExp(`No agregué ni reemplacé.*${absent}`,'i'));
  else expect(h.replies.join('\n')).not.toMatch(/No agregué ni reemplacé/i);
  expect(h.conv.state).toBe('building_cart');
 });
}
it('retains the actual Luna conditional purchase acknowledgement with its real cart',async()=>{
 const h=harness(products,true);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.agentService.runTurn.mockResolvedValue({reply:'Listo, agregué el dúo de tacos con Coca Cola Zero y dos sopas de ajiaco sin arroz. El flan no lo agregué ni lo reemplacé.',actions:{addItems:[{productId:71,quantity:1,attributes:[{attributeName:'Bebida',attributeValue:'Coca Cola Zero'}]},{productId:38,quantity:2,note:'Sin arroz'}]},toolCalls:['resolve_multi_order','search_menu','add_item','add_item'],purchaseAttempts:[{productId:71,accepted:true},{productId:38,accepted:true}]});
 await h.sendQueued('Buenas, para hoy me mandas un dúo de tacos con Coca Cola Zero y dos sopas de ajiaco sin arroz. Si no venden flan, no lo reemplaces.');
 expect(h.conv.sessionData.cart.map(l=>[l.productId,l.quantity])).toEqual([[71,1],[38,2]]);
 expect(h.replies.join('\n')).toMatch(/flan/i);expect(h.replies.join('\n')).toMatch(/Sin arroz/i);
});
