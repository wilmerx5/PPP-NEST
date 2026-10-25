/** Open diagnostic cases from chat.txt. Run explicitly; failures are NOT green regressions.
 * npx jest --testRegex='whatsapp-chat-2510-audit\\.repro\\.ts$' --runInBand
 * Catalogue/model/persistence are mocked; sequential turns do not prove burst transport.
 */
import {harness, products} from './whatsapp-accuracy.test-support';

for (const agent of [false,true]) {
 it(`courtesy does not require selecting a unique dish, agent=${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('Un arroz con pollo si es tan amable');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({code:23,quantity:1})]);
  expect(h.replies.join('\n')).not.toMatch(/Necesito aclarar|Escribe 1 para agregarlo/i);
 });
 it(`explicit additional rice is not a rice combo, agent=${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('Me regalas un ajiaco y una porción adicional de arroz');
  expect(h.conv.sessionData.cart.map(x=>x.code).sort()).toEqual([10,38]);
  expect(h.conv.sessionData.cart.every(x=>x.quantity===1)).toBe(true);
  expect(h.replies.join('\n')).not.toMatch(/cuál te gusta|cu[aá]l prefieres/i);
 });
 it(`bandeja is a container for explicitly named rice, agent=${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('Una bandeja de arroz con pollo, sin yuca y arto ají');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({code:23,quantity:1,note:expect.stringMatching(/aj[ií]/i)})]);
  expect(h.replies.join('\n')).not.toMatch(/Bandeja Con Pollo/);
 });
 it(`selecting option 1 retains requested two portions, agent=${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('Mira necesito por favor dos arroz con pollo en lugar de ensalada yuca');
  if(!h.conv.sessionData.cart.length)await h.sendQueued('1');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({code:23,quantity:2,note:expect.stringMatching(/yuca/i)})]);
 });
 it(`no quiero removes four portions instead of keeping them, agent=${agent}`,async()=>{
  const h=harness(undefined,agent);
  const rice=products.find(p=>p.code===23);
  const tray=products.find(p=>p.name==='Bandeja Pronto');
  expect(tray).toBeDefined();
  h.conv.sessionData.cart=[{productId:rice.id,code:rice.code,name:rice.name,quantity:2,unitPrice:rice.price,attributes:[]},
   {productId:tray.id,code:tray.code,name:tray.name,quantity:4,unitPrice:tray.price,attributes:[]}];
  await h.sendQueued('no quieor las 4 bandejas p`ronto');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({code:23,quantity:2})]);
  expect(h.replies.join('\n')).not.toMatch(/Conservo Bandeja/);
 });
 it(`existing executive preparation changes without extra unit, agent=${agent}`,async()=>{
  const h=harness(undefined,agent);
  await h.sendQueued('un ejecutivo con pollo frito');
  expect(h.conv.sessionData.cart).toHaveLength(1);
  await h.sendQueued('El ejecutivo con pollo brooster');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({code:18,quantity:1})]);
 });
}
