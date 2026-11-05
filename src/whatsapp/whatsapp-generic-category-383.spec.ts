import { harness } from './whatsapp-accuracy.test-support';
const menu = [
  {id:38301, code:1, name:'Mini hamburguesa', categoryName:'Menú infantil', price:16000, availableNow:true, hasAttributes:false, attributes:[]},
  {id:38302, code:2, name:'Clásica', categoryName:'Hamburguesas', price:20000, availableNow:true, hasAttributes:false, attributes:[]},
  {id:38303, code:3, name:'Doble especial', categoryName:'Hamburguesas', price:26000, availableNow:true, hasAttributes:false, attributes:[]},
  {id:38304, code:4, name:'Nachos con queso', categoryName:'Entradas', price:12000, availableNow:true, hasAttributes:false, attributes:[]},
  {id:38305, code:5, name:'Arroz con pollo', categoryName:'Arroces', price:32000, availableNow:true, hasAttributes:false, attributes:[]},
  {id:38306, code:6, name:'Porción de papa francesa', categoryName:'Porciones', price:8000, availableNow:true, hasAttributes:false, attributes:[]},
];
for (const agent of [false,true]) {
 it(`generic category must not pick child item agent=${agent}`,async()=>{
  const h=harness(menu,agent);
  h.agent.runTurn.mockResolvedValue({reply:'Listo',actions:{addItems:[{productId:38301,quantity:1}]},toolCalls:[]} as never);
  const reply=await h.sendQueued('Una hamburguesa');
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(reply).toContain('Clásica');expect(reply).toContain('Doble especial');
  expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual(expect.arrayContaining([38302,38303]));
 });
 it(`availability is informative and not punctuation agent=${agent}`,async()=>{
  const h=harness(menu,agent);h.agent.runTurn.mockResolvedValue({reply:',',actions:{},toolCalls:[]} as never);
  const reply=await h.sendQueued('Hay nachos?');
  expect(reply).toMatch(/Nachos con queso/);expect(h.conv.sessionData.cart).toEqual([]);
 });
 it(`fries alias independent of rice agent=${agent}`,async()=>{
  const h=harness(menu,agent);
  const reply=await h.sendQueued('Quiero Un arroz con Pollo y unas papas fritas');
  expect(h.conv.sessionData.cart.map(p=>p.productId)).toEqual(expect.arrayContaining([38305,38306]));
  expect(reply).not.toMatch(/No pude añadir/);
 });
}
it('partial rejection explains the missing option and offers only the pending dish',async()=>{
 const h=harness(menu,true);
 h.agent.runTurn.mockResolvedValueOnce({reply:'Listo',actions:{addItems:[{productId:38305,quantity:1}]},toolCalls:['add_item'],purchaseAttempts:[{productId:38305,accepted:true},{productId:38306,accepted:false,reason:'dish_not_on_menu',uncoveredWords:['criollas']}]} as never);
 const reply=await h.sendQueued('Quiero un arroz con pollo y unas papas criollas');
 expect(h.conv.sessionData.cart.map(p=>p.productId)).toEqual([38305]);
 expect(reply).toMatch(/criollas/);expect(reply).toMatch(/Porción de papa francesa/);
 expect((reply || '').match(/\?/g)).toHaveLength(1);expect(reply).not.toMatch(/Algo m[aá]s/i);
 expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(38306);
 await h.sendQueued('sí');
 expect(h.conv.sessionData.cart.map(p=>p.productId).sort()).toEqual([38305,38306]);
 expect(h.conv.sessionData.cart.every(p=>p.quantity===1)).toBe(true);
});
for (const [singular,category] of [['hamburguesa','Hamburguesas'],['pizza','Pizzas'],['taco','Tacos']])
 for (const agent of [false,true]) for (const quantity of [1,2]) {
 it(`category journey ${category} quantity=${quantity} agent=${agent}`,async()=>{
  const catalog=[...menu.slice(4),
   {...menu[0],name:`Mini ${singular}`},
   {...menu[1],name:'Especial de la casa',categoryName:category},
   {...menu[2],name:'Doble artesanal',categoryName:category},
  ];
  const h=harness(catalog,agent);h.service.ordersService.create=jest.fn().mockResolvedValue({id:383,dailyOrderNumber:383});
  await h.sendQueued('Un arroz con pollo');
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(`${quantity===1?'Una':'Dos'} ${singular}${quantity===1?'':'s'}`);
  expect(reply).toContain('Especial de la casa');expect(reply).toContain('Doble artesanal');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([38302,38303]);
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart.find(p=>p.productId===38303)?.quantity).toBe(quantity);
  expect(h.conv.sessionData.cart.some(p=>p.productId===38301)).toBe(false);
  await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.filter(p=>p.productId===38303)).toHaveLength(quantity);
 });
}
for (const agent of [false,true]) {
 it(`explicit mini remains selectable agent=${agent}`,async()=>{
  const h=harness(menu,agent);await h.sendQueued('Una mini hamburguesa');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:38301,quantity:1})]);
 });
 for(const noise of [',','...','😶']) it(`punctuation fallback ${noise} agent=${agent}`,async()=>{
  const h=harness(menu,agent);await h.sendQueued('Un arroz con pollo');
  const before=structuredClone(h.conv.sessionData.cart);
  h.agent.runTurn.mockResolvedValue({reply:noise,actions:{},toolCalls:[]} as never);
  const reply=await h.sendQueued('Hay nachos?');
  expect(reply).toContain('Nachos con queso');expect(h.conv.sessionData.cart).toEqual(before);
 });
}
for (const count of [0,1]) for(const agent of [false,true]) it(`category respects availability count=${count} agent=${agent}`,async()=>{
 const catalog=menu.map(p=>({...p,availableNow:p.id===38302 ? count===1 : p.id===38303 ? false : true}));
 const h=harness(catalog,agent);h.cfg.ignoreBusinessHours=false;const reply=await h.sendQueued('Una hamburguesa');
 expect(h.conv.sessionData.cart).toEqual([]);
 expect(reply).not.toMatch(/Listo ✅/);
 if(count) expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([38302]);
 else expect(reply).toMatch(/no hay opciones disponibles/i);
});
it('tool rejection preserves successful dish and one durable alternative offer',async()=>{
 const h=harness(menu,true);
 const text='Quiero un arroz con pollo y unas papas criollas';
 h.agent.runTurn.mockResolvedValueOnce({reply:'Listo',actions:{addItems:[{productId:38305,quantity:1}]},toolCalls:['add_item'],purchaseAttempts:[{productId:38305,accepted:true},{productId:38306,accepted:false,reason:'dish_not_on_menu',uncoveredWords:['criollas']}]} as never);
 await h.service.tryHandleAgentV1({conv:h.conv,msg:{waId:'customer',phoneE164:h.conv.phoneE164,messageId:'offer383',messageType:'text',text,raw:{}},session:h.conv.sessionData,text,originalText:text,products:menu,cfg:h.cfg,status:{isOpen:true,message:'Abierto'},businessOpenForBot:true});
 const reply=h.replies.at(-1)||'';
 expect(reply).toMatch(/no incluye.*criollas/);expect(reply.match(/\?/g)).toHaveLength(1);
 expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(38306);
 await h.sendQueued('sí');
 expect(h.cartRows().map(p=>[p.id,p.qty])).toEqual([[38305,1],[38306,1]]);
});
for(const text of ['Quiero una hamburguesa','Dame una hamburguesa','Me das una hamburguesa','Quisiera dos hamburguesas'])
 for(const agent of [false,true]) it(`explicit category phrase ${text} agent=${agent}`,async()=>{
  const h=harness(menu,agent);
  const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(reply).toContain('Clásica');expect(reply).toContain('Doble especial');
 });
