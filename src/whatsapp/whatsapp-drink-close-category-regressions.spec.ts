import { findByMenuConcept, resolveConceptBrowseForAgent } from './whatsapp-menu-concepts';
import { isNothingElseOrderIntent } from './whatsapp-intent';
import {harness} from './whatsapp-accuracy.test-support';
for(const enabled of [false,true]) describe(`Drink browse agent=${enabled}`,()=>{
 it.each(['Quiero algo De tomar','Quiero algo para tomar','Quiero una bebida'])('%s',async text=>{
  const h=harness(undefined,enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued(text);
  
  expect(h.conv.sessionData.cart).toHaveLength(0);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  expect(reply).not.toMatch(/no manejamos|no tenemos|no encontr[eé]/i);
  expect(reply).toMatch(/bebidas|gaseosa|limonada|jugos/i);
 });
});
for(const enabled of [false,true]) describe(`Checkout close agent=${enabled}`,()=>{
 function rig(){
  const menu=[{id:88001,code:88001,name:'Ceviche de camarón',price:28000,availableNow:true,attributes:[]},{id:88002,code:88002,name:'Cerveza nacional',price:8000,availableNow:true,attributes:[]}];
  const h=harness(menu,enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  Object.assign(h.conv.sessionData,{cart:menu.map(p=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1})),orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:67,dailyOrderNumber:67});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);return h;
 }
 it.each(['No maa','No más','no mas, cuanto es?'])('advances after %s',async text=>{
  const h=rig();const reply=await h.sendQueued(text);expect(h.conv.sessionData.cart).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.state).toBe('awaiting_address');expect(reply).toMatch(/direcci[oó]n/i);
 });
 it('Si attempts creation after final review',async()=>{
  const h=rig();Object.assign(h.conv.sessionData,{address:'Calle 10 #20-30',addressConfirmed:true,deliveryFeeCalculated:4000,paymentMethod:'cash'});
  await h.sendQueued('No más');expect(h.conv.state).toBe('awaiting_final_confirm');const reply=await h.sendQueued('Si');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 });
});

for (const enabled of [false]) {
  it(`meat browsing excludes desserts with agent=${enabled}`, async () => {
    const menu = [
      { id: 99001, name: 'Churrasco', categoryName: 'Carnes' },
      { id: 99002, name: 'Flan de caramelo', categoryName: 'Postres' },
      { id: 99003, name: 'Helado dos bolas', categoryName: 'Postres' },
      { id: 99004, name: 'Corte del chef', categoryName: 'Carnes a la parrilla' },
    ].map(p => ({ ...p, code: p.id, price: 10000, availableNow: true, attributes: [] }));
    const h = harness(menu, enabled);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    const reply = await h.sendQueued('tienes carne?');
    expect(reply).toMatch(/Churrasco/);
    expect(reply).not.toMatch(/Flan|Helado/);
    expect(h.conv.sessionData.cart).toHaveLength(0);
    expect(h.conv.sessionData.pendingMatch?.candidates.map(p => p.id)).toEqual(expect.arrayContaining([99001, 99004]));
    expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
  });
}

it('both concept search paths separate res from Postres', () => {
  const products = [
    { id: 1, name: 'Especial del chef', categoryName: 'Carnes a la parrilla', price: 1 },
    { id: 2, name: 'Dulce de la casa', categoryName: 'Postres', price: 1 },
    { id: 3, name: 'Corte diario', categoryName: 'Res', price: 1 },
  ].map(p => ({...p, code:p.id}));
  expect(findByMenuConcept('tienes carne', products)?.products.map(p => p.id)).toEqual([1, 3]);
  expect(resolveConceptBrowseForAgent('tienes carne', products)?.products.map(p => p.id)).toEqual([1, 3]);
});
it.each(['no maa cerveza', 'no mas cerveza', 'no maa, agrega limonada', 'no quiero mas arroz'])('does not close a partial rejection: %s', text => {
  expect(isNothingElseOrderIntent(text)).toBe(false);
});

it('browsing beverages preserves an existing meal and its notes', async () => {
  const h = harness(undefined, true);
  const cart = [{productId: 777, code: 777, name: 'Plato preparado', quantity: 2, unitPrice: 10000, note: 'Sin sal'}];
  h.conv.sessionData.cart = structuredClone(cart);
  const reply = await h.sendQueued('Quiero algo para tomar');
  expect(reply).toMatch(/bebidas|gaseosa|limonada/i);
  expect(h.conv.sessionData.cart).toEqual(cart);
});

for (const state of ['building_cart', 'awaiting_address', 'awaiting_final_confirm']) {
  it(`cart total clarification is never an address in ${state}`, async () => {
    const h = harness(undefined, true);
    const cart = [{productId: 777, code: 777, name: 'Plato preparado', quantity: 2, unitPrice: 10000}];
    h.conv.state = state;
    Object.assign(h.conv.sessionData, {cart, pendingPriceInquiry: {cartSignature: JSON.stringify(cart), state, productIds: [777]}});
    h.service.ordersService.create = jest.fn();
    const reply = await h.sendQueued('de todo lo que pedi');
    expect(reply).toMatch(/20[.,]000/);
    expect(reply).not.toMatch(/Direcci[oó]n anotada|fuera de cobertura/);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
it('closing with a total question requires review even with checkout details ready', async () => {
  const h = harness(undefined, true);
  h.conv.state = 'awaiting_final_confirm';
  Object.assign(h.conv.sessionData, {cart:[{productId:777,code:777,name:'Plato preparado',quantity:1,unitPrice:10000}],
    orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'cash'});
  h.service.ordersService.create = jest.fn();
  const reply = await h.sendQueued('no mas, cuanto es?');
  expect(reply).toMatch(/10[.,]000/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
