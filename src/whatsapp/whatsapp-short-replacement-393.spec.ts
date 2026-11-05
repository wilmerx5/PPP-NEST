import { harness } from './whatsapp-accuracy.test-support';
for(const agent of [false,true])for(const other of [false,true])for(const phrase of ['Mejor','Mejor quiero','Cámbialo por'])it(`switch pending combo preserves replacement ${agent}/${other}/${phrase}`,async()=>{
 const food=other?'Hamburguesa':'Pollo';
 const menu=[`${food} Frito`,`Combo ${food} Frito`,`Combo ${food} Broaster`].map((name,i)=>({id:39301+i,code:1+i,name,price:20000+i*5000,availableNow:true,hasAttributes:i>0,attributes:i>0?[{attributeName:'Bebida',options:['Limonada','Colombiana']}]:[]}));
 const h=harness(menu,agent);
 const original={productId:39301,code:1,name:menu[0].name,unitPrice:20000,quantity:2,note:'Sin cebolla'};
 h.conv.sessionData.cart=[original];h.conv.state='awaiting_attribute';
 h.conv.sessionData.pendingAttribute={productId:39302,code:2,price:25000,name:menu[1].name,attributes:menu[1].attributes,selected:[],quantity:2,sourceText:`cambia a ${menu[1].name}`,replacement:{originalLine:structuredClone(original)}};
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:393,dailyOrderNumber:393});
 const reply=await h.sendQueued(`${phrase} broaster`);
 if(h.conv.sessionData.pendingAttribute)await h.sendQueued('Limonada');
 expect(h.conv.sessionData.cart).toHaveLength(1);
 expect(h.conv.sessionData.cart[0]).toMatchObject({productId:39303,quantity:2,note:expect.stringMatching(/sin cebolla/i)});
 expect(reply).not.toMatch(/no entend|no pude/i);
 expect(reply).toContain(menu[2].name);
 await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);
 for(const item of items){expect(item.productId).toBe(39303);expect(item.note).toMatch(/sin cebolla/i);}
});
for(const agent of [false,true])for(const guard of ['selected','cancel','withdrawn','question','stale','note','explicit'])it(`pending switch guard ${agent}/${guard}`,async()=>{
 const menu=['Pollo Frito','Combo Pollo Frito','Combo Pollo Broaster'].map((name,i)=>({id:39311+i,code:11+i,name,price:20000+i*5000,availableNow:!(guard==='withdrawn'&&i===2),hasAttributes:i>0,attributes:i>0?[{attributeName:'Bebida',options:['Limonada','Colombiana']}]:[]}));
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 const original={productId:39311,code:11,name:menu[0].name,unitPrice:20000,quantity:2,note:'Sin cebolla'};
 h.conv.sessionData.cart=[structuredClone(original)];h.conv.state='awaiting_attribute';
 h.conv.sessionData.pendingAttribute={productId:39312,code:12,price:25000,name:menu[1].name,attributes:menu[1].attributes,selected:guard==='selected'?[{attributeName:'Bebida',attributeValue:'Colombiana'}]:[],quantity:2,sourceText:'cambia a combo',requireExplicitOptions:guard==='explicit',answerNote:guard==='note'?'Bebida sin hielo':undefined,replacement:{originalLine:structuredClone(original)}};
 if(guard==='stale')h.conv.sessionData.cart[0].quantity=1;
 const before=structuredClone(h.conv.sessionData.cart);h.service.ordersService.create=jest.fn();
 const reply=await h.sendQueued(guard==='question'?'¿Mejor broaster?':'Mejor broaster');
 if(guard==='withdrawn'||guard==='question'){expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(39312);}
 else if(guard==='cancel'){await h.sendQueued('cancela ese cambio');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();}
 else {
  if(guard==='explicit')expect(h.conv.sessionData.pendingAttribute?.requireExplicitOptions).toBe(true);
  if(h.conv.sessionData.pendingAttribute)await h.sendQueued('Limonada');
  if(guard==='stale')expect(h.conv.sessionData.cart).toEqual(before);
  else {expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:39313,quantity:2,note:expect.stringMatching(/sin cebolla/i)});
   if(guard==='selected')expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Colombiana'});
   if(guard==='note')expect(h.conv.sessionData.cart[0].note).toMatch(/sin hielo/i);
  }
 }
 if(guard==='withdrawn')expect(reply).toMatch(/no está disponible/i);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for (const agent of [false, true]) for (const scenario of ['ambiguous', 'missing', 'repeat', 'asado']) {
 it(`short preparation guard ${agent}/${scenario}`, async () => {
  const menu = ['Bowl Frito', 'Combo Bowl Frito', scenario === 'asado' ? 'Combo Bowl Asado' : 'Combo Bowl Broaster'].map((name, i) => ({
   id: 39321 + i, code: 21 + i, name, price: 20000 + i * 5000, availableNow: true,
   hasAttributes: i > 0, attributes: i > 0 ? [{ attributeName: 'Bebida', options: ['Limonada', 'Colombiana'] }] : [],
  }));
  if (scenario === 'ambiguous') menu.push({...menu[2],id:39324,code:24});
  if (scenario === 'missing') menu[2].name = 'Combo Hamburguesa Broaster';
  const h = harness(menu, agent);
  const original = { productId:39321,code:21,name:menu[0].name,unitPrice:20000,quantity:1,note:'Sin cebolla' };
  h.conv.sessionData.cart = [structuredClone(original)]; h.conv.state = 'awaiting_attribute';
  h.conv.sessionData.pendingAttribute = { productId:39322,code:22,price:25000,name:menu[1].name,attributes:menu[1].attributes,selected:[],quantity:1,sourceText:'cambia a combo',replacement:{originalLine:structuredClone(original)} };
  const reply = await h.sendQueued(scenario==='asado' ? 'mejor asado' : scenario==='repeat' ? 'mejor frito' : 'mejor broaster');
  expect(h.conv.sessionData.cart).toEqual([original]);
  expect(h.conv.state).toBe('awaiting_attribute');
  expect(h.conv.sessionData.pendingAttribute?.productId).toBe(scenario==='asado' ? 39323 : 39322);
  if (scenario==='ambiguous') expect(reply).toMatch(/varias opciones.*nombre completo/is);
  else if (scenario==='missing') expect(reply).toMatch(/no encontré esa preparación/i);
  else expect(reply).toMatch(/bebida/i);
  expect(reply).not.toMatch(/algo más/i);
 });
}
