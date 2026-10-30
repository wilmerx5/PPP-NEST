import { cartTotalFollowupIntent, isGenericDrinkBrowseIntent } from './whatsapp-intent';
import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  ['Arroz con verduras', 'Agua mineral'],
  ['Pizza del huerto', 'Té frío'],
];
function setup(names: string[], enabled: boolean, state = 'building_cart') {
  const menu = names.map((name, i) => ({id: 85001 + i, code: 85001 + i, name,
    price: i ? 4000 : 12000, availableNow: true, attributes: []}));
  const h = harness(menu, enabled);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest.fn();
  h.conv.state = state;
  Object.assign(h.conv.sessionData, {
    cart: menu.map(p => ({productId:p.id, code:p.code, name:p.name, quantity:1, unitPrice:p.price})),
    orderType:'delivery', fulfillmentChosen:true, phoneConfirmed:true,
    contactPhone:h.conv.phoneE164, notesCollected:true,
  });
  return h;
}
for (const names of menus) for (const enabled of [false, true]) {
  describe(`${names[0]} agent=${enabled}`, () => {
    for (const state of ['building_cart', 'awaiting_address']) {
      it.each(['cuánto es?', 'cuánto llevo?', 'cuánto te debo?', 'cuánto vale todo?'])('%s reads total in ' + state, async text => {
        const h = setup(names, enabled, state);
        const before = structuredClone(h.conv.sessionData.cart);
        const reply = await h.sendQueued(text);
        expect(reply).toMatch(/16[.,]000/);
        expect(reply).toMatch(/provisional|domicilio pendiente/i);
        expect(reply).not.toMatch(/cuál producto|direcci[oó]n anotada/i);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.address).toBeFalsy();
        expect(h.conv.state).toBe(state);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
    it.each(['todo el pedido', 'el total', 'de todo'])('clarifies price using %s', async text => {
      const h = setup(names, enabled, 'awaiting_address');
      h.conv.sessionData.pendingPriceInquiry = {cartSignature:JSON.stringify(h.conv.sessionData.cart),state:h.conv.state,productIds:[85001,85002]};
      const reply = await h.sendQueued(text);
      expect(reply).toMatch(/16[.,]000/);
      expect(reply).toMatch(/direcci[oó]n/i);
      expect(h.conv.sessionData.address).toBeFalsy();
      expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    it.each(['no más, cuánto te debo?', 'solo eso veci, cuánto llevo?', 'no mas, cuanto es todo lo que pedi', 'solo eso, cuanto vale todo lo que he pedido', 'no mas cuanto cuesta todo lo que llevo'])('closes with %s', async text => {
      const h = setup(names, enabled);
      const reply = await h.sendQueued(text);
      expect(reply).toMatch(/16[.,]000/);
      expect(reply).toMatch(/direcci[oó]n/i);
      expect(h.conv.state).toBe('awaiting_address');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  });
}

for (const enabled of [false, true]) {
  it.each(['qué hay para tomar?', 'qué tienes de beber?', 'me regalas algo de tomar', 'algo de beber porfa'])('browses drinks: %s agent=' + enabled, async text => {
    const menu = [
      {id:86001, name:'Té de durazno', categoryName:'Bebidas'},
      {id:86002, name:'Agua con gas', categoryName:'Bebidas'},
      {id:86003, name:'Plato del día', categoryName:'Almuerzos'},
    ].map(p => ({...p,code:p.id,price:5000,availableNow:true,attributes:[]}));
    const h = harness(menu, enabled);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    const reply = await h.sendQueued(text);
    expect(reply).toMatch(/Té de durazno/);
    expect(reply).toMatch(/Agua con gas/);
    expect(reply).not.toMatch(/Plato del día|no manejamos/i);
    expect(h.conv.sessionData.cart).toHaveLength(0);
    expect(h.conv.sessionData.pendingMatch?.candidates.map(p => p.id)).toEqual([86001,86002]);
  });
}

it.each(['quiero dos bebidas', 'quiero una bebida sin hielo', 'me regalas una limonada', 'quiero algo de tomar y una pizza', 'no quiero algo de tomar'])('keeps specific/mixed requests outside generic browsing: %s', text => {
  expect(isGenericDrinkBrowseIntent(text)).toBe(false);
});
it.each(['no mas, cuanto cuesta el arroz', 'no mas cerveza', 'el total es 16000', 'de todo sin cebolla', 'total calle 10', 'solo eso, cuanto tarda el domicilio', 'no mas cuanto es todo lo que pedi sin cebolla', 'no mas cuanto cuesta todo el arroz'])('does not close or consume a specific request: %s', text => {
  expect(cartTotalFollowupIntent(text, true)).toBeNull();
});
it('bare todo needs the product-price clarification context', () => {
  expect(cartTotalFollowupIntent('todo')).toBeNull();
  expect(cartTotalFollowupIntent('todo', true)).toBe('reference');
});
it('asking a named product price preserves the pending address', async () => {
  const h = setup(menus[0], true, 'awaiting_address');
  const reply = await h.sendQueued('cuanto cuesta el agua mineral?');
  expect(reply).toMatch(/4[.,]000/);
  expect(reply).toMatch(/Agua mineral/);
  expect(h.conv.state).toBe('awaiting_address');
  expect(h.conv.sessionData.address).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
it('a total question cannot confirm a ready order', async () => {
  const h = setup(menus[0], true, 'awaiting_final_confirm');
  Object.assign(h.conv.sessionData, {orderType:'pickup',paymentMethod:'cash'});
  const reply = await h.sendQueued('no más, cuánto te debo?');
  expect(reply).toMatch(/16[.,]000/);
  expect(h.conv.state).toBe('awaiting_final_confirm');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
it('a concrete drink is added instead of opening the beverage category', async () => {
  const h = setup(menus[0], false);
  h.conv.sessionData.cart = [];
  const reply = await h.sendQueued('me regalas un agua mineral');
  expect(reply).toMatch(/Agua mineral/);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:85002,quantity:1})]);
});
