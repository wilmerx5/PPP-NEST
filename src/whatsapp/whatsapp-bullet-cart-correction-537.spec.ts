import { harness, products } from './whatsapp-accuracy.test-support';
import { parseBulletCartCorrection } from './whatsapp-session-intents';

const menu = [
  { id: 97301, code: 1, name: 'Ramen De Miso', price: 24000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 97302, code: 2, name: 'Maki Vegetal', price: 19000, availableNow: true, hasAttributes: false, attributes: [] },
  { id: 97303, code: 3, name: 'Te De Jazmin', price: 5000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Endulzante', options: ['Miel', 'Sin azucar'] }] },
];
function cartLine(product: any, quantity: number, attributes: any[] = []) {
  return { productId: product.id, code: product.code, name: product.name, unitPrice: product.price, quantity, attributes };
}
const corrected = '-es dos ramen de miso\n-un maki vegetal\n-un te de jazmin sin azucar';
function seeded(catalog = menu) {
  const h = harness(catalog);
  h.conv.sessionData.cart = [cartLine(catalog[0], 4), cartLine(catalog[2], 2)];
  h.conv.sessionData.address = 'Calle 8 # 10-20';
  h.conv.sessionData.customerNotes = 'Porteria';
  h.conv.sessionData.contactPhone = '3000000001';
  return h;
}

describe('Complete bullet correction through the inbound router', () => {
  it.each([true, false])('sets final quantities and options with agent enabled %s', async enabled => {
    const h = seeded(); h.cfg.agentV1Enabled = enabled;
    const reply = await h.send(corrected);
    expect(h.cartRows()).toEqual([
      expect.objectContaining({ id: 97301, qty: 2 }),
      expect.objectContaining({ id: 97302, qty: 1 }),
      expect.objectContaining({ id: 97303, qty: 1, attrs: ['Endulzante:Sin azucar'] }),
    ]);
    expect(reply).toMatch(/dej[eé] solo eso/i);
    expect(reply).toContain('Ramen De Miso');
    expect(h.conv.sessionData).toMatchObject({address:'Calle 8 # 10-20',customerNotes:'Porteria',contactPhone:'3000000001'});
    expect(h.conv.customerName).toBe('Wilmer');
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    const first = structuredClone(h.conv.sessionData.cart);
    await h.send(corrected);
    expect(h.conv.sessionData.cart).toEqual(first);
  });
  it('preserves existing notes and options when only final quantities change', async () => {
    const h = seeded();
    h.conv.sessionData.cart[0].note = 'sin cebolla';
    h.conv.sessionData.cart[1].attributes = [{attributeName:'Endulzante',attributeValue:'Miel'}];
    await h.send('-es dos ramen de miso\n-un te de jazmin');
    expect(h.cartRows()).toEqual([
      expect.objectContaining({id:97301,qty:2,note:'sin cebolla'}),
      expect.objectContaining({id:97303,qty:1,attrs:['Endulzante:Miel']}),
    ]);
  });
  it('corrects before a pending product description interruption', async () => {
    const h = seeded();
    h.conv.state = 'awaiting_attribute';
    h.conv.sessionData.pendingAttribute = { ...cartLine(menu[2], 2), productId: menu[2].id, quantity: 2,
      price: menu[2].price, attributes: menu[2].attributes, selected: [] } as any;
    await h.send(corrected);
    expect(h.cartRows()).toHaveLength(3);
    expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
    expect(h.conv.state).toBe('building_cart');
  });
  it.each(['building_cart','awaiting_name','awaiting_address','awaiting_payment','awaiting_final_confirm'])('invalidates checkout after a complete correction in %s', async state => {
    const h = seeded(); h.conv.state = state;
    h.conv.sessionData.mpPreferenceId = 'old'; h.conv.sessionData.awaitingField = 'confirm';
    await h.send(corrected);
    expect(h.cartRows()[0].qty).toBe(2);
    expect(h.conv.sessionData.mpPreferenceId).toBeUndefined();
    expect(h.conv.sessionData.awaitingField).toBeUndefined();
    expect(h.conv.state).toBe('building_cart');
  });
  it.each(['un plato ausente', 'un te de jazmin con chocolate', '0 ramen de miso', '31 ramen de miso', '1.5 ramen de miso', '-1 ramen de miso'])('keeps the whole cart when a clause fails %s', async clause => {
    const h = seeded(); const initial = structuredClone(h.conv.sessionData.cart);
    const reply = await h.send(`-es un maki vegetal\n-${clause}`);
    expect(h.conv.sessionData.cart).toEqual(initial);
    expect(reply).toMatch(/lista completa|opciones|cantidades/i);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });
  it('does not partially apply a cart limit failure', async () => {
    const h = seeded(); (h.cfg as any).maxUnitsPerItem = 1;
    const initial = structuredClone(h.conv.sessionData.cart);
    await h.send(corrected);
    expect(h.conv.sessionData.cart).toEqual(initial);
  });
  it('honors ignoreBusinessHours for scheduled catalog products', async () => {
    const h = seeded(menu.map(product => ({...product,availableNow:false})));
    await h.send(corrected);
    expect(h.cartRows()[0]).toMatchObject({id:97301,qty:2});
    expect(h.cartRows()).toHaveLength(3);
  });
  it('keeps the whole cart when the restaurant is closed', async () => {
    const h = seeded(); h.cfg.ignoreBusinessHours = false;
    h.service.businessService.getStatus = async () => ({isOpen:false,message:'Cerrado',openTime:'09:00',closeTime:'21:00'});
    const initial = structuredClone(h.conv.sessionData.cart);
    await h.send(corrected);
    expect(h.conv.sessionData.cart).toEqual(initial);
  });
  it('preserves the payable cart', async () => {
    const h = seeded(); h.conv.state = 'awaiting_mp_payment'; h.conv.sessionData.mpPreferenceId = 'payable';
    const initial = structuredClone(h.conv.sessionData.cart);
    await h.send(corrected);
    expect(h.conv.sessionData.cart).toEqual(initial);
    expect(h.conv.sessionData.mpPreferenceId).toBe('payable');
  });
  it('clarifies the reported missing style before describing the fries', async () => {
    const h = harness(products);
    const fries = products.find(p => /francesa/i.test(p.name));
    const half = products.find(p => /1\/2.*broaster/i.test(p.name));
    const soda = products.find(p => /gaseosa.*1[.,]5/i.test(p.name));
    h.conv.sessionData.cart = [cartLine(fries,2),cartLine(half,1,[{attributeName:'Arepas',attributeValue:'Blancas'}]),cartLine(soda,1,[{attributeName:'Sabor',attributeValue:'Manzana'}])];
    const initial = structuredClone(h.conv.sessionData.cart);
    const reply = await h.send('-es medio broster\n-medio asado\n- una porcion de papas fritas\n- una gaseosa 1.5L colombiana');
    expect(h.conv.sessionData.cart).toEqual(initial);
    expect(reply).toMatch(/medio asado/i);
    expect(reply).toMatch(/1\/2 Pollo Frito/i);
    expect(reply).toMatch(/1\/2 Pollo Broaster/i);
    expect(reply).not.toMatch(/arroz chino|ingredientes/i);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });
  it.each(['-es medio broster\n- una porcion de papas fritas\n- una gaseosa 1.5L colombiana', '-es 1/2 broster\n- una porcion de papas fritas\n- una gaseosa 1.5L colombiana'])('uses final totals for the available reported list %s', async text => {
    const h = harness(products);
    const fries = products.find(p => /francesa/i.test(p.name));
    const half = products.find(p => /1\/2.*broaster/i.test(p.name));
    const soda = products.find(p => /gaseosa.*1[.,]5/i.test(p.name));
    h.conv.sessionData.cart = [cartLine(fries,2),cartLine(half,1,[{attributeName:'Arepas',attributeValue:'Blancas'}]),cartLine(soda,1,[{attributeName:'Sabor',attributeValue:'Manzana'}])];
    const reply = await h.send(text);
    expect(reply).toMatch(/dej[eé] solo eso/i);
    expect(h.cartRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({id:fries.id,qty:1}),expect.objectContaining({id:half.id,qty:1}),
      expect.objectContaining({id:soda.id,qty:1,attrs:expect.arrayContaining(['Sabor:Colombiana'])}),
    ]));
    expect(h.cartRows()).toHaveLength(3);
  });
  it.each(['-un ramen de miso\n-un maki vegetal', '-quiero un ramen de miso\n-un te de jazmin', '-es un ramen?\n-un maki', '-es un ramen\n-que trae el maki', '-es un ramen\n-precio del te'])('leaves purchases and questions with their normal handlers %s', text => {
    expect(parseBulletCartCorrection(text)).toBeNull();
  });
});
