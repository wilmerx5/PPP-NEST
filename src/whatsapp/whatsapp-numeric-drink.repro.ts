import { harness } from './whatsapp-accuracy.test-support';
import { writeFileSync } from 'fs';
for(const agent of [false,true]) for(const [i,text] of [
 'Buenas noches para pedir un arroz chino con medio pollo frito y gaseosa 7 up por favor',
 'Buenas noches para pedir un arroz chino con medio pollo frito y gaseosa 7up por favor',
 'Quiero un combo arroz chino con medio pollo frito y gaseosa 7 up',
 'Quiero un combo arroz chino con medio pollo frito y gaseosa 7up',
 'Quiero dos combos arroz chino con medio pollo frito y gaseosa 7 up',
 'Quiero dos combos arroz chino con medio pollo frito y gaseosa 7up',
].entries()) {
 it(`numeric drink ${agent}/${i}`,async()=>{
  const h=harness(undefined,agent);await h.sendQueued(text);
  writeFileSync(`/tmp/ppp-197-drink-${agent}-${i}.json`,JSON.stringify({cart:h.conv.sessionData.cart,replies:h.replies,state:h.conv.state},null,2));
  const expected=i>=4?2:1;
  expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(expected);
  expect(h.conv.sessionData.cart.every(line=>line.code===97)).toBe(true);
  expect(h.conv.sessionData.cart.every(line=>(line.attributes || []).some(attr=>/7\s*up/i.test(attr.attributeValue)))).toBe(true);
 });
}
