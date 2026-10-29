import {isCompoundExclusionNote,parsePartialNote} from './whatsapp-partial-note';
import {kitchenNotesConflict} from './whatsapp-cart-note';
const notes=['sin cebolla ni tomate','sin sal ni pimienta','sin salsa de tomate ni mayonesa','sin cebolla ni tomate ni lechuga'];
it.each(notes)('recognizes a bounded shared exclusion: %s',note=>{
 expect(isCompoundExclusionNote(note)).toBe(true);
 expect(parsePartialNote(`una ${note}`)).toMatchObject({quantity:1,note,implied:true});
});
it.each([
 'sin cebolla ni agrega agua','sin cebolla ni agregar agua','sin cebolla ni pagar',
 'sin cebolla ni dos tomates','sin cebolla ni tomate si hay','sin cebolla ni tomate pero con salsa',
 'sin cebolla ni tomate ni sal ni pimienta','sin cebolla ni tomate adicional',
 'sin cebolla ni otra sin tomate','sin cebolla ni tomate; quita agua','sin cebolla ni tomate?',
 'sin cebolla ni con tomate',
])('does not absorb another action or condition: %s',note=>{
 expect(isCompoundExclusionNote(note)).toBe(false);
 expect(parsePartialNote(`una ${note}`)).toBeNull();
});
for(const [note,ingredient] of [['sin cebolla ni tomate','tomate'],['sin sal ni pimienta','pimienta'],['sin salsa de tomate ni mayonesa','mayonesa'],['sin cebolla ni tomate ni lechuga','lechuga']])
for(const inclusion of [`con ${ingredient}`,`${ingredient} aparte`])for(const reverse of [false,true])
it(`detects omitted sin for ${note} / ${inclusion}, reverse=${reverse}`,()=>{
 expect(kitchenNotesConflict(reverse?note:inclusion,reverse?inclusion:note)).toBe(true);
});
it.each([
 ['sin cebolla ni tomate','con salsa de tomate'],['sin sal ni pimienta','salsa aparte'],
 ['sin salsa de tomate ni mayonesa','con tomate'],['sin cebolla ni tomate ni lechuga','bien empacado'],
])('keeps complete ingredient phrases distinct: %s / %s',(note,other)=>expect(kitchenNotesConflict(note,other)).toBe(false));
