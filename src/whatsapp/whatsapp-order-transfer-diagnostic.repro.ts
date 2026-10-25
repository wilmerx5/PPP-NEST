/** Opt-in failing reproduction. Not part of the green regression inventory.
 * npx jest --testRegex='whatsapp-order-transfer-diagnostic\\.repro\\.ts$' --runInBand
 */
import {harness} from './whatsapp-accuracy.test-support';
import {readFileSync} from 'fs';
const real=JSON.parse(readFileSync('docs/whatsapp-open-cases-2510.json','utf8')).cases[0].messages[0] as string;
const payment='Cuánto sería para pagar por Nequi\nMe envía el número gracias';
const explicit='una sopa de menudencias y un ejecutivo con pollo broaster pierna pernil sopa menudencias bebida colombiana';
for(const agent of [false,true]) for(const [label,message] of [
 ['real',real],['real-without-payment',real.split('Cuánto sería')[0]],
 ['explicit',explicit],['explicit-with-payment',`${explicit}\n${payment}`],
]) it(`${label}, agent=${agent}`,async()=>{
 const h=harness(undefined,agent);
 await h.sendQueued(message);
 const cart=h.conv.sessionData.cart;
 expect(h.replies.join('\n')).not.toMatch(/Cotizaci[oó]n|Te los agrego/i);
 expect(cart).toHaveLength(2);
 expect(cart.find(line=>line.code===20)).toMatchObject({quantity:1});
 expect(cart.find(line=>line.code===18)).toMatchObject({quantity:1,attributes:expect.arrayContaining([
  {attributeName:'Sopa',attributeValue:'Menudencias'},
  {attributeName:'Presa',attributeValue:'Pierna Pernil'},
  {attributeName:'Bebida',attributeValue:'Colombiana'},
 ])});
 expect(cart.reduce((total,line)=>total+line.quantity,0)).toBe(2);
});
