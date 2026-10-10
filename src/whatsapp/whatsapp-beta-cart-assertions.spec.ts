import { matchesExpectedCartLines } from '../../scripts/whatsapp-beta-cart-assertions';

describe('Rehearsal cart evidence', () => {
  it('cannot reuse one matching actual line to hide another incorrect line', () => {
    expect(matchesExpectedCartLines([{id:23,quantity:1,note:['sin ensalada']},{id:23,quantity:1,note:['sin ensalada']}],
      [{productId:23,quantity:1,note:'sin ensalada'},{productId:23,quantity:1,note:'sin cilantro'}])).toBe(false);
  });
  it('assigns generic and specific expected lines without depending on their order', () => {
    expect(matchesExpectedCartLines([{id:23,quantity:1},{id:23,quantity:1,note:['sin ensalada']}],
      [{productId:23,quantity:1,note:'sin ensalada'},{productId:23,quantity:1}])).toBe(true);
  });
  it('rejects a removed note that survives on the regular line', () => {
    expect(matchesExpectedCartLines([{id:23,quantity:1,forbidNote:['sin cilantro']}],
      [{productId:23,quantity:1,note:'Sin cilantro'}])).toBe(false);
  });
  it('distinguishes quantity and flavor on each line', () => {
    const expected=[{id:50,quantity:2,attrs:[{key:'Sabor',value:'Mango'}]},{id:50,quantity:1,attrs:[{key:'Sabor',value:'Lulo'}]}];
    expect(matchesExpectedCartLines(expected,[
      {productId:50,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]},
      {productId:50,quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Lulo'}]},
    ])).toBe(false);
  });
});
