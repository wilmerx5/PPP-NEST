import { parsePartialNote } from './whatsapp-partial-note';

describe('Partial exclusions with an unchanged remainder', () => {
  it.each([
    ['Uno sin cebolla y los otros dos normales',1,'sin cebolla',2],
    ['2 sin cilantro y los otros 3 normales',2,'sin cilantro',3],
    ['Una sin salsa y las demás normales',1,'sin salsa',undefined],
  ])('understands quantity groups: %s', (text, quantity, note, remainder) => {
    expect(parsePartialNote(String(text))).toEqual({quantity,note,remainder});
  });
  it.each([
    '¿Uno sin cebolla y los otros dos normales?',
    'Uno sin cebolla y los otros dos normales; agrega una bebida',
    'Uno sin cebolla y agrega dos normales',
    'Ninguno sin cebolla y los otros dos normales',
    'Uno sin cebolla si hay y los otros dos normales',
  ])('does not turn a question or additional instruction into an exclusion: %s', text => {
    expect(parsePartialNote(text)).toBeNull();
  });
});
