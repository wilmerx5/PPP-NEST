import { isExplicitSavedAddressReference } from './whatsapp-session-intents';
import { splitAddressKitchenNote } from './whatsapp-address-parts';

describe('Explicit saved destination versus acknowledgements', () => {
  it.each(['Mejor a la misma de antes', 'a la misma dirección', 'Prefiero la anterior', 'la dirección anterior', 'Para la de siempre', 'Esa misma', 'la misma direction por favor', 'Entonces a la misma'])('accepts %s', text => {
    expect(isExplicitSavedAddressReference(text)).toBe(true);
  });
  it.each(['Sí', 'Perfecto', 'no a la misma', 'la misma bebida', '¿cuál era la dirección anterior?', 'Mejor a Calle 10 #20-30'])('does not reuse for %s', text => {
    expect(isExplicitSavedAddressReference(text)).toBe(false);
  });
});

describe('Separate street from a bounded kitchen note', () => {
  it.each([
    ['Calle 10 #20-30, los dos sin cebolla', 2, false],
    ['Carrera 22 #45-60; ambas sin salsa por favor', 2, false],
    ['Tv 78C #6D-48, todos sin arroz', undefined, true],
    ['Diagonal 3 #83-02, sin cilantro', undefined, false],
    ['Calle 10 #20-30, las 3 sin sal', 3, false],
  ])('separates %s', (text, count, all) => {
    const result = splitAddressKitchenNote(text as string);
    expect(result).toEqual(expect.objectContaining({ count, all, note: expect.stringMatching(/^sin /) }));
    expect(result!.address).not.toMatch(/sin |por favor/);
  });
  it.each(['Calle 10 #20-30, agrega dos ensaladas', 'Calle 10 #20-30, sin cebolla y agrega dos jugos', 'Quiero dos ravioles, sin cebolla', 'Calle 10 #20-30, torre 2 apartamento 301', 'Calle 10 #20-30, sin cebolla si no cuesta más'])('does not absorb an extra or ambiguous request: %s', text => {
    expect(splitAddressKitchenNote(text)).toBeNull();
  });
});
