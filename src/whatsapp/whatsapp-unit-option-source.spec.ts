import { hasExplicitUnitOptionSource } from './whatsapp-unit-option-source';
import type { WhatsappCartItem } from './types/whatsapp-session.types';
const row=(value:string,productId=1):WhatsappCartItem=>({productId,code:productId,name:'Producto ficticio',unitPrice:100,quantity:4,attributes:[{attributeName:'Opción',attributeValue:value}]});
const edit={productId:1,cartLineIndex:0,affectedQuantity:2,attributes:[{attributeName:'Opción',attributeValue:'Picante'}]};
describe('Human source binding for separated variants',()=>{
 it.each(['De la línea 1 cambia dos','Fila #1, dos picantes','Del ítem 1 dos por favor','Número 1'])('accepts displayed source: %s',text=>expect(hasExplicitUnitOptionSource(text,[row('Suave'),row('Picante')],edit)).toBe(true));
 it.each(['Dos picantes','Repite el cambio','En la calle 1','De la línea 2 cambia dos','No de la línea 1','Deja los suaves, cambia los otros','Suave es bueno, pon dos picantes',''])('does not infer source: %s',text=>expect(hasExplicitUnitOptionSource(text,[row('Suave'),row('Picante')],edit)).toBe(false));
 it.each(['De los suaves cambia dos','Entre los suave, dos picantes'])('accepts unique current source: %s',text=>expect(hasExplicitUnitOptionSource(text,[row('Suave'),row('Picante')],edit)).toBe(true));
 it('does not treat destination as source',()=>expect(hasExplicitUnitOptionSource('Pon dos picantes',[row('Picante'),row('Suave')],edit)).toBe(false));
 it('does not use a shared option to select one row',()=>expect(hasExplicitUnitOptionSource('De los suaves dos picantes',[row('Suave'),row('Suave')],edit)).toBe(false));
 it('does not confuse another product with another variant',()=>expect(hasExplicitUnitOptionSource('Dos picantes',[row('Suave'),row('Suave',2)],edit)).toBe(true));
 it('rejects nonexistent source',()=>expect(hasExplicitUnitOptionSource('línea 3',[row('Suave')],{...edit,cartLineIndex:2})).toBe(false));
 it('normalizes accents and punctuation',()=>expect(hasExplicitUnitOptionSource('De GUANÁBANA, dos picantes',[row('Guanabana'),row('Mango')],edit)).toBe(true));
 it('does not accept substrings',()=>expect(hasExplicitUnitOptionSource('suavemente dos picantes',[row('Suave'),row('Picante')],edit)).toBe(false));
});
