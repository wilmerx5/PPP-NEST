import {parsePartialNote} from './whatsapp-partial-note';
it.each(['sin cebolla y sin tomate','sin sal y sin pimienta','sin salsa de tomate y sin mayonesa','sin cebolla y sin tomate y sin lechuga'])('accepts repeated exclusions as one unit note: %s',note=>{
 expect(parsePartialNote(`una ${note}`)).toMatchObject({quantity:1,note,implied:true});
});
it.each([
 'una sin cebolla y otra sin tomate','una sin cebolla y agrega agua','una sin cebolla y con tomate',
 'una sin cebolla y sin pagar','una sin cebolla y sin agregar agua','una sin cebolla y sin dos tomates',
 'una sin cebolla y sin tomate si hay','una sin cebolla y sin tomate pero con salsa',
 'una sin cebolla y sin tomate y sin sal y sin pimienta','¿una sin cebolla y sin tomate?',
 'una sin cebolla y sin tomate adicional','una sin cebolla y sin tomate; quita el agua',
])('does not absorb another action, unit, condition or question: %s',text=>expect(parsePartialNote(text)).toBeNull());
