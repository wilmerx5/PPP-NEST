import {dialogueProductReferences} from './whatsapp-dialogue-context';
import type {WhatsappSessionData} from './types/whatsapp-session.types';

const line=(productId:number)=>({productId,name:`Producto ${productId}`,code:productId,quantity:1,unitPrice:1000});
describe('Referencias de diálogo sin adivinar candidatos',()=>{
 it('agrupa variantes de la misma identidad sin elegir entre platos distintos',()=>{
  expect(dialogueProductReferences({orderType:'pickup',cart:[line(1),line(1),line(2)]})).toEqual([1,2]);
 });
 it('una compra pendiente prevalece sobre el producto consultado antes',()=>{
  const session:WhatsappSessionData={orderType:'pickup',cart:[line(1)],productFocus:{productId:1,name:'Producto 1'},pendingAttribute:{productId:2,name:'Producto 2',code:2,price:1000,quantity:3,attributes:[],selected:[]}};
  const before=structuredClone(session);expect(dialogueProductReferences(session)).toEqual([2]);expect(session).toEqual(before);
 });
 it('una lista pendiente conserva todos sus candidatos pese al foco anterior',()=>{
  expect(dialogueProductReferences({orderType:'pickup',cart:[],productFocus:{productId:1,name:'Producto 1'},pendingMatch:{query:'platos',candidates:[{id:2,name:'Producto 2',code:2,price:1000},{id:3,name:'Producto 3',code:3,price:1000}]}})).toEqual([2,3]);
 });
 it('una oferta múltiple no se convierte en oferta del primer producto',()=>{
  expect(dialogueProductReferences({orderType:'pickup',cart:[line(1)],pendingAddOffer:{productId:2,name:'Producto 2',code:2,price:1000,quantity:1,productIds:[2,3]}})).toEqual([2,3]);
 });
 it('un pedido múltiple conserva necesidades distintas y no usa solo el primero',()=>{
  expect(dialogueProductReferences({orderType:'pickup',cart:[],pendingMultiOrder:{confident:[{productId:1,name:'Producto 1',code:1,price:1000,segment:'uno'}],ambiguous:[{segment:'dos',candidates:[{id:2,name:'Producto 2',code:2,price:1000},{id:3,name:'Producto 3',code:3,price:1000}]}],needsAttributes:[],unresolved:[]}})).toEqual([2,3,1]);
 });
 it('sin referencia devuelve vacío y no inventa un producto',()=>{expect(dialogueProductReferences({orderType:'pickup',cart:[]})).toEqual([]);});
});
