import { harness } from './whatsapp-accuracy.test-support';
for(const agent of [false,true])for(const other of [false,true])for(const phrase of ['Mejor quiero el','Mejor el','Cámbialo por el'])it(`switch pending combo preserves replacement ${agent}/${other}/${phrase}`,async()=>{
 const food=other?'Bowl Vegetal':'Pollo';
 const destination=other?'Combo Wrap Vegetal':'Combo Hamburguesa';
 const menu=[`${food} Frito`,`Combo ${food} Frito`,destination].map((name,i)=>({id:39501+i,code:1+i,name,price:20000+i*5000,availableNow:true,hasAttributes:i>0,attributes:i>0?[{attributeName:'Bebida',options:['Limonada','Colombiana']}]:[]}));
 const h=harness(menu,agent);
 const original={productId:39501,code:1,name:menu[0].name,unitPrice:20000,quantity:2,note:'Sin cebolla'};
 h.conv.sessionData.cart=[original];h.conv.state='awaiting_attribute';
 h.conv.sessionData.pendingAttribute={productId:39502,code:2,price:25000,name:menu[1].name,attributes:menu[1].attributes,selected:[],quantity:2,sourceText:`cambia a ${menu[1].name}`,replacement:{originalLine:structuredClone(original)}};
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:395,dailyOrderNumber:395});
 const reply=await h.sendQueued(`${phrase} ${menu[2].name}`);
 if(h.conv.sessionData.pendingAttribute)await h.sendQueued('Limonada');
 expect(h.conv.sessionData.cart).toHaveLength(1);
 expect(h.conv.sessionData.cart[0]).toMatchObject({productId:39503,quantity:2,note:expect.stringMatching(/sin cebolla/i)});
 expect(reply).not.toMatch(/no entend|no pude/i);
 expect(reply).toContain(menu[2].name);
 await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);
 for(const item of items){expect(item.productId).toBe(39503);expect(item.note).toMatch(/sin cebolla/i);}
});
for(const agent of [false,true])for(const guard of ['selected','cancel','withdrawn','question','stale','note','explicit'])it(`pending switch guard ${agent}/${guard}`,async()=>{
 const menu=['Pollo Frito','Combo Pollo Frito','Combo Hamburguesa'].map((name,i)=>({id:39511+i,code:11+i,name,price:20000+i*5000,availableNow:!(guard==='withdrawn'&&i===2),hasAttributes:i>0,attributes:i>0?[{attributeName:'Bebida',options:['Limonada','Colombiana']}]:[]}));
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 const original={productId:39511,code:11,name:menu[0].name,unitPrice:20000,quantity:2,note:'Sin cebolla'};
 h.conv.sessionData.cart=[structuredClone(original)];h.conv.state='awaiting_attribute';
 h.conv.sessionData.pendingAttribute={productId:39512,code:12,price:25000,name:menu[1].name,attributes:menu[1].attributes,selected:guard==='selected'?[{attributeName:'Bebida',attributeValue:'Colombiana'}]:[],quantity:2,sourceText:'cambia a combo',requireExplicitOptions:guard==='explicit',answerNote:guard==='note'?'Bebida sin hielo':undefined,replacement:{originalLine:structuredClone(original)}};
 if(guard==='stale')h.conv.sessionData.cart[0].quantity=1;
 const before=structuredClone(h.conv.sessionData.cart);h.service.ordersService.create=jest.fn();
 const reply=await h.sendQueued(guard==='question'?'¿Mejor quiero el Combo Hamburguesa?':'Mejor quiero el Combo Hamburguesa');
 if(guard==='withdrawn'||guard==='question'){expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(39512);}
 else if(guard==='cancel'){await h.sendQueued('cancela ese cambio');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();}
 else {
  if(guard==='explicit')expect(h.conv.sessionData.pendingAttribute?.requireExplicitOptions).toBe(true);
  if(h.conv.sessionData.pendingAttribute)await h.sendQueued('Limonada');
  if(guard==='stale')expect(h.conv.sessionData.cart).toEqual(before);
  else {expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:39513,quantity:2,note:expect.stringMatching(/sin cebolla/i)});
   if(guard==='selected')expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Colombiana'});
   if(guard==='note')expect(h.conv.sessionData.cart[0].note).toMatch(/sin hielo/i);
  }
 }
 if(guard==='withdrawn')expect(reply).toMatch(/no está disponible/i);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for (const agent of [false, true]) for (const variant of ['incompatible', 'different-attribute', 'no-attributes']) {
 it(`cross-family conversion keeps unrelated cart line ${agent}/${variant}`, async () => {
  const attrs = variant === 'no-attributes' ? [] : variant === 'different-attribute'
   ? [{attributeName:'Tamaño', options:['Grande','Pequeño']}]
   : [{attributeName:'Bebida', options:['Limonada']}];
  const menu = [
   {id:39521,code:21,name:'Pollo Frito',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
   {id:39522,code:22,name:'Combo Pollo Frito',price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Limonada']}]},
   {id:39523,code:23,name:'Combo Wrap Vegetal',price:30000,availableNow:true,hasAttributes:attrs.length>0,attributes:attrs},
   {id:39524,code:24,name:'Sopa De Verduras',price:9000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  const h = harness(menu,agent);
  const original = {productId:39521,code:21,name:menu[0].name,unitPrice:20000,quantity:2,note:'Sin cebolla'};
  const extra = {productId:39524,code:24,name:menu[3].name,unitPrice:9000,quantity:1,note:'Bien caliente'};
  h.conv.sessionData.cart = [structuredClone(original),structuredClone(extra)]; h.conv.state='awaiting_attribute';
  h.conv.sessionData.pendingAttribute = {productId:39522,code:22,price:25000,name:menu[1].name,attributes:menu[1].attributes,selected:[{attributeName:'Bebida',attributeValue:'Colombiana'}],quantity:2,sourceText:'cambia a combo',replacement:{originalLine:structuredClone(original)}};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:395,dailyOrderNumber:395});
  const reply=await h.sendQueued('Cámbialo por el Combo Wrap Vegetal');
  expect(reply).toContain(menu[2].name);
  if (variant!=='no-attributes') {
   expect(h.conv.sessionData.cart).toEqual([original,extra]);
   expect(h.conv.sessionData.pendingAttribute?.selected).toEqual([]);
   expect(reply).toMatch(variant==='different-attribute' ? /Tamaño/i : /Bebida/i);
   await h.sendQueued(variant==='different-attribute' ? 'Grande' : 'Limonada');
  }
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart.find(line=>line.productId===39524)).toEqual(extra);
  const changed=h.conv.sessionData.cart.find(line=>line.productId===39523);
  expect(changed).toMatchObject({quantity:2,note:expect.stringMatching(/sin cebolla/i)});
  expect(changed?.attributes || []).not.toContainEqual({attributeName:'Bebida',attributeValue:'Colombiana'});
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(3);
  expect(items.filter(item=>item.productId===39523)).toHaveLength(2);
  expect(items.filter(item=>item.productId===39524)).toHaveLength(1);
 });
}
