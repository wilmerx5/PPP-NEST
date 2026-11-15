import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';
import { splitDeliveryAddressParts } from './whatsapp-address-parts';

const call = (name: string, args: unknown) => ({ id: `call-${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const answer = (content: string | null, calls?: unknown[]) => new Response(JSON.stringify({ choices: [{ message: { content, tool_calls: calls } }] }), { status: 200 });
const menus = ['Pollo Broaster', 'Tofu Asado'].map((name, index) => [
  { id: 54601, code: 4, name, price: 46000, availableNow: true, attributes: [] },
  { id: 54602, code: 98, name: `Combo De ${name}`, comboBaseProductId: 54601, price: 55000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Bebida', options: ['Colombiana', 'Manzana', '7up'] }] },
  { id: 54603, code: 42, name: 'Gaseosa 1.5L', price: 8000, availableNow: true, hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options: ['Colombiana', 'Manzana', '7up'] }] },
  { id: 54604, code: 9, name: index ? 'Bowl Central' : 'Bandeja Pronto', price: 18000, availableNow: true, attributes: [] },
]);
function setup(menu = menus[0]) {
  const h = harness(menu, true);
  h.conv.sessionData = { cart: [{ productId: 54601, code: 4, name: menu[0].name, quantity: 1, unitPrice: 46000, attributes: [] }], orderType: 'delivery' };
  h.service.settingsService.semanticRoutingEnabled = () => true;
  h.service.conversationService.reopenForNewOrder = jest.fn(async () => { await h.service.conversationService.resetOrderSession(h.conv, 'building_cart'); return h.conv; });
  h.service.conversationService.getRecentMessageTexts = jest.fn().mockResolvedValue([]);
  h.service.conversationService.saveSemanticSession = jest.fn(async (_conv, expected, next, state) => {
    if (h.conv.state !== expected.state || JSON.stringify(h.conv.sessionData) !== JSON.stringify(expected.session)) return false;
    h.conv.sessionData = structuredClone(next); h.conv.state = state; return true;
  });
  h.service.agentService = new WhatsappAgentService({ getEffectiveConfig: async () => ({ openaiApiKey: 'synthetic-key', openaiModel: 'gpt-4o-mini',
    systemPrompt: '', aiTemperature: 0.2, localContext: {}, paymentMethods: DEFAULT_PAYMENT_METHODS }) } as never, new WhatsappCatalogService({} as never));
  return h;
}
beforeEach(() => jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Unexpected network in free regression')));
afterEach(() => jest.restoreAllMocks());

for (const menu of menus) it(`only one in combo replaces after an intervening price question ${menu[0].name}`, async () => {
  const h = setup(menu); const network = jest.spyOn(global, 'fetch');
  const inquiry = 'Que precio tiene';
  network.mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text: inquiry, role: 'inquiry', productIds: [54601] }] })]))
    .mockResolvedValueOnce(answer('Vale $46.000'));
  await h.sendQueued(inquiry);
  const text = 'Dame solo uno en combo con manzana Postobón';
  network.mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text, role: 'purchase', productIds: [54602] }] })]))
    .mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text, role: 'edit', productIds: [54601, 54602] }] })]))
    .mockResolvedValueOnce(answer(null, [call('replace_item', { sourceText: text, productId: 54601, cartLineIndex: 0,
      newProductId: 54602, targetText: 'combo con manzana', quantity: 1, attributes: [{ attributeName: 'Bebida', attributeValue: 'Manzana' }] })]))
    .mockResolvedValueOnce(answer('Listo'));
  const reply = await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 54602, quantity: 1,
    attributes: [{ attributeName: 'Bebida', attributeValue: 'Manzana' }] })]);
  expect(reply).not.toMatch(/aclaras|101.000/i);
  Object.assign(h.conv.sessionData, { fulfillmentChosen: true, phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true });
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 546, dailyOrderNumber: 546 });
  await h.sendQueued('No señor');
  await h.sendQueued('Calle 7b #78c-79 apto 302');
  await h.sendQueued('contraentrega');
  expect(await h.sendQueued('confirmar')).toMatch(/registrado/i);
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
});

for (const menu of menus) it(`an explicit additional combo preserves the existing base ${menu[0].name}`, async () => {
  const h = setup(menu); const text = `Agrega otro ${menu[1].name} aparte con Manzana`;
  jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text, role: 'purchase', productIds: [54602] }] })]))
    .mockResolvedValueOnce(answer(null, [call('add_item', { sourceText: text, productId: 54602, quantity: 1,
      attributes: [{ attributeName: 'Bebida', attributeValue: 'Manzana' }] })]))
    .mockResolvedValueOnce(answer('Listo'));
  await h.sendQueued(text);
  expect(h.conv.sessionData.cart.map(line => line.productId)).toEqual([54601, 54602]);
});

for (const state of ['building_cart', 'awaiting_address', 'awaiting_payment', 'awaiting_final_confirm']) {
  it(`complete phone uses the checkout protocol in ${state}`, async () => {
    const h = setup(); h.conv.state = state;
    const reply = await h.sendQueued('314 2528804');
    expect(h.conv.sessionData.contactPhone?.replace(/\D/g, '')).toMatch(/3142528804$/);
    expect(reply).not.toMatch(/aclaras|no entend/i);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(h.conv.sessionData.cart).toHaveLength(1);
  });
}

for (const menu of menus) for (const text of ['cuanto seria', 'cuanto es el total']) it(`total question preserves the cart ${menu[0].name}/${text}`, async () => {
  const h = setup(menu); const reply = await h.sendQueued(text);
  expect(reply).toContain('46.000'); expect(reply).not.toMatch(/aclaras/i);
  expect(global.fetch).not.toHaveBeenCalled(); expect(h.conv.sessionData.cart).toHaveLength(1);
});

it('repeated interpretation keeps frozen roles and cannot add a new target', async () => {
  const h = setup(); const text = 'Que trae el plato';
  jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text, role: 'inquiry', productIds: [] }] })]))
    .mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text, role: 'inquiry', productIds: [54601] }] })]))
    .mockResolvedValueOnce(answer('La ficha del plato'));
  expect(await h.sendQueued(text)).not.toMatch(/aclaras/i);
  expect(h.conv.sessionData.cart).toHaveLength(1);
});

it('keeps a colon-labelled house outside the geocoding query', () => {
  expect(splitDeliveryAddressParts('Rincón de los Ángeles, casa: 7')).toEqual({ base: 'Rincón de los Ángeles', details: 'casa: 7' });
});

it('keeps a fractional drink measurement as one requested volume', () => {
  const catalog = new WhatsappCatalogService({} as never);
  expect(catalog.extractRequestedDrinkVolumeMl('una gaseosa fria litro y cuarto')).toBe(1250);
});

for (const menu of menus) it(`an access reference cannot add a catalogue item ${menu[0].name}`, async () => {
  const h = setup(menu); h.conv.state = 'awaiting_payment';
  Object.assign(h.conv.sessionData, { address: 'Transversal 78C #6D-48', addressConfirmed: true,
    deliveryLat: 4.6, deliveryLng: -74.1, deliveryFeeCalculated: 2000, deliveryDistanceKm: 1, fulfillmentChosen: true });
  const reply = await h.sendQueued('Rincón de los Ángeles, casa: 7');
  expect(h.conv.sessionData.cart.map(line => line.productId)).toEqual([54601]);
  expect(h.conv.sessionData.address).toMatch(/casa:? 7/i);
  expect(reply).not.toMatch(/aclaras|Bandeja|Bowl/i);
  expect(global.fetch).not.toHaveBeenCalled();
});

it('a cash instruction after confirmation stays on that order and a new purchase starts clean', async () => {
  const h=setup();h.conv.state='completed';h.conv.sessionData={cart:[],orderType:'delivery'};
  const receipt={dailyOrderNumber:93,createdAt:new Date()};
  h.service.conversationService.getLastOrderConfirmation=jest.fn().mockResolvedValue(receipt);
  h.service.ordersService.getWhatsappOrderForNotes=jest.fn().mockResolvedValue({id:93,dailyOrderNumber:93,orderStatus:'cooking'});
  h.service.ordersService.setWhatsappCashChange=jest.fn().mockResolvedValue({orderId:93,dailyOrderNumber:93,note:'Cambio para pago: Pago con un billete de 100mil'});
  expect(await h.sendQueued('Pago con un billete de 100mil')).toMatch(/guardé.*100mil.*#93/i);
  expect(h.conv.state).toBe('completed');expect(h.conv.sessionData.cashChangeFor).toBeUndefined();
  expect(h.service.ordersService.setWhatsappCashChange).toHaveBeenCalledWith(93,1,'Pago con un billete de 100mil');
  const text='Quiero un Pollo Broaster';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[54601]}]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{sourceText:text,productId:54601,quantity:1})]))
    .mockResolvedValueOnce(answer('Listo'));
  await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cashChangeFor).toBeUndefined();
});

it('an owned confirmed order is found despite a different delivery contact',async()=>{
  const h=setup();h.conv.state='completed';h.conv.sessionData={cart:[],orderType:'delivery'};
  h.service.conversationService.getLastOrderConfirmation=jest.fn().mockResolvedValue({dailyOrderNumber:93,createdAt:new Date()});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([{id:29,dailyOrderNumber:29,orderStatus:'cooking'}]);
  h.service.ordersService.getWhatsappOrderForNotes=jest.fn().mockResolvedValue({id:93,dailyOrderNumber:93,orderStatus:'cooking'});
  expect(await h.sendQueued('Como va mi pedido #93')).toMatch(/#93[\s\S]*preparación/i);
  expect(h.conv.state).toBe('completed');expect(h.conv.sessionData.cart).toHaveLength(0);
});

it('an internal unit written before a place name stays out of the map query',()=>{
  expect(splitDeliveryAddressParts('Torre 4 907 altavista')).toEqual({base:'altavista',details:'Torre 4 apto 907'});
});

it('fractional drink clarification reaches checkout with one beverage and no chicken portion',async()=>{
  const menu=[...menus[0],{id:54605,code:27,name:'Gaseosa 2.5L',price:9000,availableNow:true,hasAttributes:true,
    attributes:[{attributeName:'Sabor',options:['Colombiana','Manzana','7up']}]}];
  const h=setup(menu);const text='y una gaseosa fria litro y cuarto';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[54603,54605]}]})]))
    .mockResolvedValueOnce(answer(null,[call('offer_products',{sourceText:text,productIds:[54605,54603],quantity:1})]))
    .mockResolvedValueOnce(answer('¿Cuál tamaño prefieres?'));
  const first=await h.sendQueued(text);
  expect(first).toMatch(/1.5L|2.5L/);expect(first).not.toMatch(/cuarto.*pollo/i);
  await h.sendQueued('2');await h.sendQueued('Colombiana');
  expect(h.conv.sessionData.cart.filter(line=>line.productId===54603)).toHaveLength(1);
  expect(h.conv.sessionData.cart.find(line=>line.productId===54603)?.quantity).toBe(1);
  expect(h.conv.sessionData.cart).toHaveLength(2);
  await h.sendQueued('No señor');
  expect(h.conv.state).toBe('awaiting_address');
});

it('a note keeps its edit intent when the model repeats interpretation after reading the cart',async()=>{
  const h=setup();const text='El plato con mucha miel por favor';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'edit',productIds:[54601]}]})]))
    .mockResolvedValueOnce(answer(null,[call('get_cart',{sourceText:text})]))
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'edit',productIds:[]}]})]))
    .mockResolvedValueOnce(answer(null,[call('update_item',{sourceText:text,productId:54601,cartLineIndex:0,note:'Con mucha miel'})]))
    .mockResolvedValueOnce(answer('Listo'));
  const reply=await h.sendQueued(text);
  expect(reply).not.toMatch(/aclaras/i);expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0].note).toMatch(/miel/i);
});

it('selecting a place preserves internal details written before its name',async()=>{
  const h=setup();h.conv.state='awaiting_address';
  Object.assign(h.conv.sessionData,{address:'Torre 4 907 altavista',pendingDeliveryCandidates:[{address:'Carrera 80G #6-19',lat:4.6,lng:-74.1,distanceKm:1,fee:2000}]});
  h.service.deliveryRouting.quoteDeliveryFee=jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,customer:{lat:4.6,lng:-74.1}});
  await h.sendQueued('1');
  expect(h.conv.sessionData.address).toMatch(/apto 907/i);expect(h.conv.sessionData.address).toMatch(/torre 4/i);
  expect(h.conv.sessionData.cart).toHaveLength(1);
});

it('an elliptical price follow-up cannot turn into additional purchases',async()=>{
  const h=setup();const text='Y pollo y medio con gaseos';
  h.service.conversationService.getRecentMessageTexts.mockResolvedValue(['Cliente: Que precio tiene','Bot: El pollo cuesta $46.000']);
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[54601]}]})]))
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'inquiry',productIds:[54601]}]})]))
    .mockResolvedValueOnce(answer('El precio depende del tamaño de la bebida. ¿Qué tamaño prefieres?'));
  const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(text);
  expect(reply).not.toMatch(/aclaras qué quieres/i);expect(h.conv.sessionData.cart).toEqual(before);
});

it('a failed interpretation of a kitchen preference asks for its host',async()=>{
  const h=setup();h.service.agentService={runTurn:jest.fn().mockResolvedValue({error:'semantic_contract_rejected',actions:{},toolCalls:[]})};
  const reply=await h.sendQueued('Por favor muchas miel');
  expect(reply).toMatch(/cuál producto.*miel/i);expect(reply).not.toMatch(/qué quieres pedir/i);
  expect(h.conv.sessionData.cart).toHaveLength(1);
});

for(const name of ['Bagre','Pescado de Río']) it(`a full preparation request uses its own catalogue option ${name}`,async()=>{
  const p={id:54610,code:10,name,price:32000,availableNow:true,hasAttributes:true,
    attributes:[{attributeName:'Preparación',options:['Frito','En Salsa']}]};
  const h=setup([...menus[0],p]);h.conv.sessionData.cart=[];const text=`Me puedes vender un ${name} en salsa por favor`;
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[54610]}]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{sourceText:text,productId:54610,quantity:1,attributes:[{attributeName:'Preparación',attributeValue:'En Salsa'}]})]))
    .mockResolvedValueOnce(answer('Listo'));
  const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:54610,quantity:1,attributes:[{attributeName:'Preparación',attributeValue:'En Salsa'}]})]);
  expect(reply).not.toMatch(/no tenemos|aclaras/i);
});

it('an unscoped abundance note waits for a host and never lands on another dish',async()=>{
  const h=setup();h.conv.sessionData.cart.push({productId:54604,code:9,name:'Bandeja Pronto',quantity:1,unitPrice:18000,attributes:[]});
  const first=await h.sendQueued('Por favor muchas miel');
  expect(first).toMatch(/cuáles productos.*miel/i);expect(h.conv.sessionData.cart.every(line=>!line.note)).toBe(true);
  await h.sendQueued('1');
  expect(h.conv.sessionData.cart[0].note).toMatch(/miel/i);expect(h.conv.sessionData.cart[1].note).toBeUndefined();
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(global.fetch).not.toHaveBeenCalled();
});

for(const state of ['completed','closed']) it(`a new full purchase with price and address uses semantics after ${state}`,async()=>{
  const product={id:54620,code:36,name:'Arroz Chino Con Medio Pollo',description:'Arroz con medio pollo y papas a la francesa.',price:48000,
    availableNow:true,hasAttributes:true,attributes:[{attributeName:'Pollo',options:['Frito','Broaster']}]};
  const h=setup([...menus[0],product]);h.conv.state=state;h.conv.sessionData={cart:[],orderType:'delivery'};
  const purchase='Buenas tardes! por favor me gustaria un arroz chino con medio pollo';
  const inquiry='me dicen cuanto es';const address='Carrera 78d #14a-22 visión de Colombia';
  const text=`${purchase}, ${inquiry}?? ${address} y gracias!!`;
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text:purchase,role:'purchase',productIds:[54620]},
      {text:inquiry,role:'inquiry',productIds:[54620]},{text:address,role:'checkout',productIds:[]},{text:'y gracias',role:'conversation',productIds:[]} ]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{sourceText:purchase,productId:54620,quantity:1,attributes:[{attributeName:'Pollo',attributeValue:'Frito'}]}),
      call('set_address',{sourceText:address,address})]))
    .mockResolvedValueOnce(answer('El arroz vale $48.000 más domicilio.'));
  const reply=await h.sendQueued(text);
  expect(reply).not.toMatch(/no te ofrecemos|aclaras/i);expect(reply).toContain('48.000');
  expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].productId).toBe(54620);
  expect(h.conv.sessionData.address).toMatch(/78d/i);
  expect(await h.sendQueued('300 2948706')).not.toMatch(/aclaras/i);
  expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toMatch(/3002948706$/);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:546,dailyOrderNumber:546});
  await h.sendQueued('contraentrega');expect(await h.sendQueued('confirmar')).toMatch(/registrado/i);
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});

it('a new audio transcript with preparation and a previous-delivery complaint stays a new purchase',async()=>{
  const fish={id:54630,code:30,name:'Mojarra',price:32000,description:'Mojarra acompañada de papas a la francesa y ensalada.',availableNow:true,attributes:[]};
  const h=setup([...menus[0],fish]);h.conv.state='completed';h.conv.sessionData={cart:[],orderType:'delivery'};
  const text='Muchas gracias, buenas tardes. Es para pedir una mojarrita, la más grande que tengan, pero me das papas saladas y si tienen ensalada pico de gallo, mejor en lugar de la vinagreta. Les recomiendo porque siempre llega el pedido distinto.';
  const note='Solicita mojarra grande; papa salada en vez de francesa. Si hay pico de gallo, en vez de vinagreta.';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[54630]}]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{sourceText:text,productId:54630,quantity:1,note})]))
    .mockResolvedValueOnce(answer('Listo'));
  const reply=await h.sendQueued(text);
  expect(reply).not.toMatch(/revisar la cobertura|aclaras/i);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:54630,quantity:1,note:expect.stringContaining('vinagreta')})]);
});

it('a long model note must be summarized before any part of the update is persisted',async()=>{
  const h=setup();const text='El plato sin salsas ni ají picante y con papa salada en vez de francesa';
  const long='El cliente pide revisar cuidadosamente la preparación y las recomendaciones para su pedido. '.repeat(3)+'Sin salsas ni ají picante; papa salada en vez de francesa.';
  const summary='Sin salsas ni ají picante; papa salada en vez de francesa.';
  const network=jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'edit',productIds:[54601]}]})]))
    .mockResolvedValueOnce(answer(null,[call('update_item',{sourceText:text,productId:54601,cartLineIndex:0,note:long})]))
    .mockResolvedValueOnce(answer(null,[call('update_item',{sourceText:text,productId:54601,cartLineIndex:0,note:summary})]))
    .mockResolvedValueOnce(answer('Listo'));
  await h.sendQueued(text);
  expect(network).toHaveBeenCalledTimes(4);expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0].note).toBe(summary);
});

it('repeating an applied note preserves its result without another model call',async()=>{
  const h=setup();const text='El plato sin salsas ni ají picante';
  const network=jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'edit',productIds:[54601]}]})]))
    .mockResolvedValueOnce(answer(null,[call('update_item',{sourceText:text,productId:54601,cartLineIndex:0,note:'Sin salsas ni ají picante'})]))
    .mockResolvedValueOnce(answer('Listo'));
  await h.sendQueued(text);const before=structuredClone(h.conv.sessionData.cart);
  expect(await h.sendQueued(text)).not.toMatch(/aclaras/i);
  expect(network).toHaveBeenCalledTimes(3);expect(h.conv.sessionData.cart).toEqual(before);
});
