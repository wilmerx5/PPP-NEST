/** Anonymized real-chat diagnostics; execute explicitly, not part of the green suite. */
import { harness, products } from './whatsapp-accuracy.test-support';
import { writeFileSync } from 'fs';
for(const agent of [false,true]) {
 const save=(h:ReturnType<typeof harness>,key:string)=>writeFileSync(`/tmp/ppp-194-chat-${key}-${agent}.json`,JSON.stringify({replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,session:h.conv.sessionData},null,2));
 it(`7 up is a flavor, not seven portions ${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('Buenas noches para pedir un arroz chino con medio pollo frito y gaseosa 7 up por favor');
  save(h,'7up');
  expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(1);
  expect(h.conv.sessionData.cart[0].code).toBe(97);
  expect(h.conv.sessionData.cart[0].attributes).toEqual(expect.arrayContaining([expect.objectContaining({attributeValue:expect.stringMatching(/7\s*up/i)})]));
 });
 it(`no va A ni B removes standalone extras, preserves combo ${agent}`,async()=>{
  const h=harness(undefined,agent);
  const wanted=['Combo De Pollo Frito','Gaseosa 400ml','Porcion De Arepas'];
  const chosen=wanted.map(name=>products.find((p:any)=>p.name.toLowerCase()===name.toLowerCase()));
  if(chosen.some(p=>!p))throw new Error('Missing fixture product');
  h.conv.state='awaiting_payment';
  h.conv.sessionData.cart=chosen.map(p=>({productId:p.id,code:p.code,name:p.name,quantity:1,unitPrice:p.price,attributes:[]}));
  await h.sendQueued('no va la gaseosa de 400 ml ni la porcion de arepas');
  save(h,'negation');
  expect(h.conv.sessionData.cart.map(line=>line.productId)).toEqual([chosen[0].id]);
  expect(h.replies.join('\n')).not.toMatch(/agregu[eé]|Listo ✅.*Porcion De Arepas/i);
 });
 it(`greeting requesting delivery is not a destination ${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('Para que porfa para 1 domicilio');
  save(h,'destination');
  expect(h.conv.sessionData.address).toBeFalsy();
  expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
  expect(h.conv.sessionData.cart).toEqual([]);
 });
 it(`two soups retain shared heat and distinct sides ${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('Me regala dos sopas grandes de menudencias bien caliente una con porción de arroz y la otra arepita');
  save(h,'soups');
  expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(2);
  expect(h.conv.sessionData.cart.every(line=>line.code===20)).toBe(true);
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart.every(line=>/caliente/i.test(line.note||''))).toBe(true);
  expect(h.conv.sessionData.cart.some(line=>/arepa|arepita/i.test(line.note||''))).toBe(true);
 });
}
