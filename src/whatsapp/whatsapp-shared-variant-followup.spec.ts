/** Generalized follow-ups derived from the shared meal options in CHAT2510-05; checkout is synthetic. */
import {harness,products} from './whatsapp-accuracy.test-support';
const menus=[
 {name:'Bento Oriental',key:'Proteína',a:'Tofu',b:'Tempura',commonKey:'Sopa',old:'Miso',next:'Calabaza'},
 {name:'Pasta Primavera',key:'Salsa',a:'Pesto',b:'Pomodoro',commonKey:'Entrada',old:'Ensalada',next:'Crema'},
 {name:'Wrap Vegetal',key:'Proteína',a:'Tofu',b:'Garbanzos',commonKey:'Acompañamiento',old:'Arroz',next:'Quinua'},
];
for(const m of menus)for(const agent of [false,true])for(const split of [false,true]){
 it(`${m.name}/agent=${agent}/split=${split}: common nondefault then complete pair and DTO`,async()=>{
  const p={id:9601,code:61,name:m.name,price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:m.key,options:[m.a,m.b]},{attributeName:m.commonKey,options:[m.old,m.next]},{attributeName:'Bebida',options:['Cola','Agua']}]};
  const h=harness([p],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
  const row=(value:string,quantity:number)=>({productId:p.id,code:p.code,name:p.name,quantity,unitPrice:p.price,note:'Sin cebolla',attributes:[{attributeName:m.key,attributeValue:value},{attributeName:m.commonKey,attributeValue:m.old},{attributeName:'Bebida',attributeValue:'Cola'}]});
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,cart:split?[row(m.a,1),row(m.b,1)]:[row(m.a,2)]});
  await h.sendQueued(`De ${m.commonKey.toLowerCase()} serían los dos ${m.next}`);
  expect(h.conv.sessionData.cart.reduce((n,r)=>n+r.quantity,0)).toBe(2);
  expect(h.conv.sessionData.cart.every(r=>r.attributes?.some(a=>a.attributeName===m.commonKey&&a.attributeValue===m.next))).toBe(true);
  await h.sendQueued(`uno con ${m.b} y el otro con ${m.a}`);
  expect(h.conv.sessionData.cart.map(r=>r.quantity)).toEqual([1,1]);
  expect(h.conv.sessionData.cart.map(r=>r.attributes?.find(a=>a.attributeName===m.key)?.attributeValue)).toEqual([m.b,m.a]);
  expect(h.conv.sessionData.cart.every(r=>r.note==='Sin cebolla'&&r.attributes?.some(a=>a.attributeName===m.commonKey&&a.attributeValue===m.next))).toBe(true);
  expect(h.replies.at(-1)).toMatch(/repart/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const stable=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`uno con ${m.b} y el otro con ${m.a}`);expect(h.conv.sessionData.cart).toEqual(stable);
  await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toEqual(stable.map(r=>({productId:r.productId,attributes:r.attributes,note:r.note})));
 });
}

for(const m of menus)for(const agent of [false,true])for(const control of ['unknown','multiple owners','competing edit','payment link','wrong quantity','different notes','different untouched option']){
 it(`${m.name}/${agent}: ${control} clarifies without partial mutation`,async()=>{
  const product=(id:number,name:string)=>({id,code:id,name,price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:m.key,options:[m.a,m.b]},{attributeName:m.commonKey,options:[m.old,m.next]}]});
  const p=product(9601,m.name);const other=product(9602,'Otro '+m.name);
  const h=harness([p,other],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn();
  const row=(id:number,value:string)=>({productId:id,code:id,name:id===p.id?p.name:other.name,quantity:1,unitPrice:p.price,note:'Sin cebolla',attributes:[{attributeName:m.key,attributeValue:value},{attributeName:m.commonKey,attributeValue:m.old}]});
  h.conv.sessionData.cart=[row(p.id,m.a),row(p.id,m.b)];
  if(control==='multiple owners')h.conv.sessionData.cart[1]=row(other.id,m.b);
  if(control==='competing edit')h.conv.sessionData.pendingCartAttributeEdit={sourceText:'cambia opción',cartSignature:JSON.stringify(h.conv.sessionData.cart),candidates:[{cartIndex:0,name:m.name}]};
  if(control==='payment link')h.conv.sessionData.mpPreferenceId='test-payment';
  if(control==='wrong quantity')h.conv.sessionData.cart[0].quantity=2;
  if(control==='different notes')h.conv.sessionData.cart[1].note='Sin ajo';
  if(control==='different untouched option')h.conv.sessionData.cart[1].attributes![1].attributeValue=m.next;
  const before=structuredClone(h.conv.sessionData);
  await h.sendQueued(control.startsWith('different')?`uno con ${m.b} y el otro con ${m.a}`:`De ${m.commonKey} serían los dos ${control==='unknown'?'opcion desconocida':m.next}`);
  expect(h.conv.sessionData).toEqual(before);expect(h.replies.at(-1)).toMatch(/cu[aá]l|opci[oó]n|aclar|repart/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
for(const agent of [false,true])for(const split of [false,true])it(`source-derived soup plural with changed default ${agent}/${split}`,async()=>{
 const menu=structuredClone(products);const p=menu.find((p:any)=>p.id===22);p.attributes.find((a:any)=>a.attributeName==='Sopa').options=['Menudencias','Ajiaco','Mondongo'];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const row=(presa:string,quantity:number)=>({productId:p.id,code:p.code,name:p.name,quantity,unitPrice:p.price,note:'Sin cebolla',attributes:[{attributeName:'Presa',attributeValue:presa},{attributeName:'Sopa',attributeValue:'Menudencias'},{attributeName:'Bebida',attributeValue:'Colombiana'}]});
 Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,cart:split?[row('Pierna Pernil',1),row('Ala, pechuga',1)]:[row('Pierna Pernil',2)]});
 // Clause extracted from source; not a literal replay of the full compound message.
 await h.sendQueued('De sopa sería los dos ajiacos');
 expect(h.conv.sessionData.cart.every(r=>r.attributes?.some(a=>a.attributeName==='Sopa'&&a.attributeValue==='Ajiaco'))).toBe(true);
 await h.sendQueued('uno con Ala, pechuga y el otro con Pierna Pernil');
 await h.sendQueued('Y de tomar limonada por f');await h.sendQueued('Y me das un adicional de limonada');
 const meals=h.conv.sessionData.cart.filter(r=>r.productId===22);expect(meals.map(r=>r.quantity)).toEqual([1,1]);expect(meals.map(r=>r.attributes?.find(a=>a.attributeName==='Presa')?.attributeValue)).toEqual(['Ala, pechuga','Pierna Pernil']);
 expect(meals.every(r=>r.note==='Sin cebolla'&&r.attributes?.some(a=>a.attributeName==='Sopa'&&a.attributeValue==='Ajiaco')&&r.attributes?.some(a=>a.attributeName==='Bebida'&&a.attributeValue==='Limonada'))).toBe(true);
 await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(3);expect(dto.items.filter((r:any)=>r.productId===22)).toEqual(meals.map(r=>({productId:r.productId,attributes:r.attributes,note:r.note})));
});

for(const m of menus)for(const agent of [false,true])it(`${m.name}/${agent}: shared edit preserves unresolved split through confirmation`,async()=>{
 const p={id:9601,code:61,name:m.name,price:19000,availableNow:true,hasAttributes:true,attributes:[{attributeName:m.key,options:[m.a,m.b]},{attributeName:m.commonKey,options:[m.old,m.next]}]};
 const h=harness([p],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
 h.conv.sessionData.cart=[{productId:p.id,code:p.code,name:p.name,quantity:2,unitPrice:p.price,attributes:[{attributeName:m.key,attributeValue:m.a},{attributeName:m.commonKey,attributeValue:m.old}]}];
 await h.sendQueued(`un plato que sea ${m.b} y el otro opcion desconocida`);const pending=structuredClone(h.conv.sessionData.pendingUnitDistribution);expect(pending).toBeDefined();
 await h.sendQueued(`De ${m.commonKey} serían los dos ${m.next}`);expect(h.conv.sessionData.pendingUnitDistribution).toEqual(pending);expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:m.commonKey,attributeValue:m.next});expect(h.replies.at(-1)).toMatch(/falta aclarar/i);
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued(`uno con ${m.b} y el otro con ${m.a}`);expect(h.conv.sessionData.pendingUnitDistribution).toBeUndefined();expect(h.conv.sessionData.cart.every(r=>r.attributes?.some(a=>a.attributeName===m.commonKey&&a.attributeValue===m.next))).toBe(true);
});
