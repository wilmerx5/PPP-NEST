import { harness } from './whatsapp-accuracy.test-support';
import type { WhatsappProductCandidate } from './types/whatsapp-session.types';

function menu(): WhatsappProductCandidate[] {
  const attributes = [
    { attributeName: 'Arepas', options: ['Blancas', 'Fritas'] },
    { attributeName: 'Bebida', options: ['Manzana', 'Colombiana'] },
  ];
  return [
    {
      id: 701,
      code: 11,
      name: '1 Pollo Frito',
      price: 20000,
      availableNow: true,
      comboBaseProductId: null,
      hasAttributes: true,
      attributes,
    },
    {
      id: 702,
      code: 12,
      name: '1 Pollo Broaster',
      price: 23000,
      availableNow: true,
      comboBaseProductId: null,
      hasAttributes: true,
      attributes,
    },
    {
      id: 703,
      code: 13,
      name: 'Combo De Pollo Frito',
      price: 27000,
      availableNow: true,
      comboBaseProductId: 701,
      hasAttributes: true,
      attributes,
    },
    {
      id: 704,
      code: 14,
      name: 'Combo De Pollo Broaster',
      price: 31000,
      availableNow: true,
      comboBaseProductId: 702,
      hasAttributes: true,
      attributes,
    },
    {
      id: 705,
      code: 15,
      name: 'Mojarra Frita',
      price: 18000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 706,
      code: 16,
      name: 'Mojarra Asada',
      price: 22000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 707,
      code: 17,
      name: '1/2 Pollo Frito',
      price: 14000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 708,
      code: 18,
      name: '1/2 Pollo Broaster',
      price: 16000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 712,
      code: 21,
      name: '1/4 Pollo Frito',
      price: 9000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 713,
      code: 22,
      name: '1/4 Pollo Broaster',
      price: 11000,
      availableNow: true,
      hasAttributes: true,
      attributes,
    },
    {
      id: 714,
      code: 23,
      name: 'Arroz Chino Con Medio Pollo',
      price: 40000,
      availableNow: true,
      hasAttributes: true,
      attributes: [
        ...attributes,
        { attributeName: 'Pollo', options: ['Frito', 'Broaster'] },
      ],
    },
    {
      id: 709,
      code: 19,
      name: 'Sopa Casera',
      price: 5000,
      availableNow: true,
      attributes: [],
    },
  ];
}
function setup(
  sourceId: number,
  quantity = 1,
  agent = false,
  products = menu(),
) {
  const h = harness(products, agent);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 516, dailyOrderNumber: 516 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  const source = products.find((product) => product.id === sourceId)!;
  Object.assign(h.conv.sessionData, {
    orderType: 'pickup',
    fulfillmentChosen: true,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
  });
  h.conv.sessionData.cart = [
    {
      productId: source.id,
      code: source.code,
      name: source.name,
      unitPrice: source.price,
      quantity,
      attributes: [
        { attributeName: 'Arepas', attributeValue: 'Fritas' },
        { attributeName: 'Bebida', attributeValue: 'Manzana' },
      ],
      note: 'Sin sal',
    },
    {
      productId: 709,
      code: 19,
      name: 'Sopa Casera',
      unitPrice: 5000,
      quantity: 1,
      note: 'Bien caliente',
    },
  ];
  h.conv.sessionData.productFocus = { productId: source.id, name: source.name };
  return h;
}

for (const [sourceId,targetId,owner,style] of [[701,702,'pollo','broaster'],[705,706,'mojarra','asada']] as const) {
 for(const agent of [false,true]) for(const state of ['building_cart','awaiting_final_confirm']) {
  test(`mixed replacement purchase ${owner} ${agent} ${state}`,async()=>{
   const products=menu();products.push({id:710,code:20,name:'Agua Mineral',price:3000,availableNow:true,attributes:[]});
   const h=setup(sourceId,2,agent,products);h.conv.state=state;
   const before=structuredClone(h.conv.sessionData.cart);
   const reply=await h.sendQueued(`cambia el ${owner} a ${style} y agrega dos Agua Mineral`);
   expect(h.conv.sessionData.cart.find(line=>line.productId===targetId)).toMatchObject({quantity:2,note:'Sin sal',attributes:before[0].attributes});
   expect(h.conv.sessionData.cart.some(line=>line.productId===sourceId)).toBe(false);
   expect(h.conv.sessionData.cart.find(line=>line.productId===710)).toMatchObject({quantity:2});
   expect(h.conv.sessionData.cart.find(line=>line.productId===709)).toEqual(before[1]);
   expect(reply).toMatch(/cambi[eé]/i);expect(reply).toMatch(/agregu[eé]/i);
   expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
 }
}

function withWater(source=701,agent=false,state='building_cart') {
 const products=menu();products.push({id:710,code:20,name:'Agua Mineral',price:3000,availableNow:true,attributes:[]});
 const h=setup(source,2,agent,products);h.conv.state=state;return {h,products};
}
for(const [sourceId,targetId,owner,style] of [[701,702,'pollo','broaster'],[702,701,'pollo','frito'],[705,706,'mojarra','asada'],[706,705,'mojarra','frita']] as const)
 for(const agent of [false,true]) for(const state of ['building_cart','awaiting_final_confirm'])
  for(const form of ['named','pronoun','bare']) {
   test(`mixed journey ${sourceId}/${targetId} ${agent} ${state} ${form}`,async()=>{
    const {h}=withWater(sourceId,agent,state);const before=structuredClone(h.conv.sessionData.cart);
    const change=form==='pronoun'?`cámbialo por ${style}`:`cámbiame el ${owner} por ${style}`;
    const buy=form==='bare'?'y dos Agua Mineral':'y además ponme dos Agua Mineral';
    const reply=await h.sendQueued(`${change} ${buy}`);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:targetId,quantity:2,note:'Sin sal',attributes:before[0].attributes}),before[1],expect.objectContaining({productId:710,quantity:2})]);
    expect(reply).toMatch(/cambi[eé].*agregu[eé]/i);expect(h.conv.state).toBe(state);
    const after=structuredClone(h.conv.sessionData.cart);await h.sendQueued('por favor');expect(h.conv.sessionData.cart).toEqual(after);
    await h.sendQueued('nada más');await h.sendQueued('efectivo');await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const items=h.service.ordersService.create.mock.calls[0][0].items;
    expect(items.map((item:{productId:number})=>item.productId).sort()).toEqual([targetId,targetId,709,710,710].sort());
   });
  }
for(const agent of [false,true])for(const scenario of ['unknown source','ambiguous source','unknown replacement','unavailable replacement','duplicate replacement','unknown purchase','unavailable purchase','duplicate purchase','zero purchase','line limit','amount limit','pending selection','payment link','question','conditional','third action']) {
 test(`mixed safety ${agent} ${scenario}`,async()=>{
  const {h,products}=withWater(701,agent);let owner='pollo',destination='broaster',purchase='dos Agua Mineral';
  if(scenario==='unknown source')owner='pescado';
  if(scenario==='ambiguous source')h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[0]),note:'Otra persona'});
  if(scenario==='unknown replacement')destination='estofado';
  if(scenario==='unavailable replacement')products.find(p=>p.id===702)!.availableNow=false;
  if(scenario==='duplicate replacement')products.push({...products.find(p=>p.id===702)!,id:717,code:27});
  if(scenario==='unknown purchase')purchase='dos Cosa Inexistente';
  if(scenario==='unavailable purchase')products.find(p=>p.id===710)!.availableNow=false;
  if(scenario==='duplicate purchase')products.push({...products.find(p=>p.id===710)!,id:718,code:28});
  if(scenario==='zero purchase')purchase='0 Agua Mineral';
  if(scenario==='line limit')Object.assign(h.cfg,{maxCartLines:2});
  if(scenario==='amount limit')Object.assign(h.cfg,{maxOrderAmount:52000});
  if(scenario==='pending selection')h.conv.sessionData.pendingMatch={query:'otra cosa',candidates:[products[0]],intent:'order'};
  if(scenario==='payment link')h.conv.sessionData.mpPreferenceId='synthetic-only';
  if(scenario==='conditional')destination+=' si hay';
  if(scenario==='third action')purchase+=' y quita la sopa';
  const before=structuredClone(h.conv.sessionData.cart);let text=`cambia el ${owner} a ${destination} y agrega ${purchase}`;
  if(scenario==='question')text='¿'+text+'?';
  const reply=await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/igual/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
function withPendingOptions(agent=false) {
 const {h,products}=withWater(701,agent);
 products.push({id:711,code:21,name:'Jugo Natural En Agua',price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Guanabana']}]});
 products.push({id:715,code:25,name:'Helado Artesanal',price:9000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Vainilla','Chocolate']}]});
 return {h,products};
}
for(const agent of [false,true]) {
 test(`two option stages commit only after both choices ${agent}`,async()=>{
  const {h}=withPendingOptions(agent);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('cambia el pollo por el Jugo Natural En Agua y agrega dos Helado Artesanal');
  expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/Jugo Natural En Agua/);expect(reply).not.toMatch(/Algo más/i);
  const second=await h.sendQueued('2');expect(second).toMatch(/Helado Artesanal/);expect(second).not.toMatch(/Algo más/i);expect(h.conv.sessionData.cart).toEqual(before);
  const third=await h.sendQueued('Chocolate');expect(third).toMatch(/cambi[eé].*agregu[eé]/i);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:711,quantity:2,note:'Sin sal',attributes:[{attributeName:'Sabor',attributeValue:'Guanabana'}]}),before[1],expect.objectContaining({productId:715,quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Chocolate'}]})]);
  expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();
  await h.sendQueued('nada más');await h.sendQueued('efectivo');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(5);
 });
 for(const scenario of ['cancel','decline','confirm','question','courtesy','expired','cart changed','price changed','attributes changed','unavailable','whole cancel']) {
  test(`pending mixed choices ${agent} ${scenario}`,async()=>{
   const {h,products}=withPendingOptions(agent);await h.sendQueued('cambia el pollo a broaster y agrega dos Jugo Natural En Agua');
   expect(h.conv.sessionData.pendingCartReplacement?.mixedPurchase).toBeDefined();
   if(scenario==='expired')h.conv.sessionData.pendingCartReplacement!.mixedPurchase!.createdAt-=11*60*1000;
   if(scenario==='cart changed')h.conv.sessionData.cart[0].quantity=3;
   if(scenario==='price changed')products.find(p=>p.id===711)!.price+=1000;
   if(scenario==='attributes changed')products.find(p=>p.id===711)!.attributes![0].options=['Mango','Fresa'];
   if(scenario==='unavailable')products.find(p=>p.id===711)!.availableNow=false;
   const before=structuredClone(h.conv.sessionData.cart);
   const text=scenario==='cancel'?'cancela ese cambio':scenario==='decline'?'no gracias':scenario==='confirm'?'confirmar':scenario==='question'?'¿Mango?':scenario==='courtesy'?'por favor':scenario==='whole cancel'?'Por favor cancelar pedido':'1';
   const reply=await h.sendQueued(text);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if(scenario==='whole cancel'){expect(h.conv.sessionData.cart).toEqual([]);expect(reply).toMatch(/cancelado/i);}
   else {expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/igual/);}
  });
 }
}
for(const text of ['cambia el pollo a combo frito y agrega dos Agua Mineral','cambia el pollo por la Mojarra Asada y agrega dos Agua Mineral']) {
 test(`configured combo or full destination with new purchase ${text}`,async()=>{
  const {h}=withWater();await h.sendQueued(text);const targetId=text.includes('combo')?703:706;
  expect(h.conv.sessionData.cart.find(line=>line.productId===targetId)).toMatchObject({quantity:2,note:'Sin sal'});
  expect(h.conv.sessionData.cart.find(line=>line.productId===710)).toMatchObject({quantity:2});expect(h.conv.sessionData.cart.some(line=>line.productId===701)).toBe(false);
 });
}
test('an existing new-purchase line gains the requested units',async()=>{
 const {h}=withWater();h.conv.sessionData.cart.push({productId:710,name:'Agua Mineral',code:20,quantity:2,unitPrice:3000,attributes:[]});
 await h.sendQueued('cambia el pollo a broaster y agrega dos Agua Mineral');expect(h.conv.sessionData.cart.find(line=>line.productId===710)!.quantity).toBe(4);
});

for(const agent of [false,true])for(const text of [
 'agrega dos Agua Mineral y cambia el pollo a broaster',
 'ponme dos Agua Mineral sin hielo y cámbialo por broaster',
 'cambia el pollo a broaster y agrega dos Agua Mineral sin hielo',
 'cambia el pollo a broaster y agrega dos Agua Mineral sin hielo y sin azucar',
])test(`clause order and independent note ${agent} ${text}`,async()=>{
 const {h}=withWater(701,agent);const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);
 expect(h.conv.sessionData.cart.find(line=>line.productId===702)).toMatchObject({quantity:2,note:'Sin sal'});
 expect(h.conv.sessionData.cart.find(line=>line.productId===710)).toMatchObject({quantity:2,...(text.includes('sin hielo')?{note:expect.stringContaining('sin hielo')}:{})});
 expect(h.conv.sessionData.cart.find(line=>line.productId===709)).toEqual(before[1]);
});
for(const agent of [false,true])for(const suffix of ['Mango','Sabor Guanabana','con Mango','sin azucar'])test(`explicit new-purchase option or note ${agent} ${suffix}`,async()=>{
 const {h}=withPendingOptions(agent);await h.sendQueued(`cambia el pollo a broaster y agrega dos Jugo Natural En Agua ${suffix}`);
 if(suffix==='sin azucar'){
  expect(h.conv.sessionData.cart.some(line=>line.productId===701)).toBe(true);
  await h.sendQueued('Guanabana');
 }
 expect(h.conv.sessionData.cart.find(line=>line.productId===711)).toMatchObject({quantity:2,attributes:[{attributeName:'Sabor',attributeValue:suffix.includes('Mango')?'Mango':'Guanabana'}],...(suffix==='sin azucar'?{note:'sin azucar'}:{})});
 expect(h.conv.sessionData.cart.find(line=>line.productId===702)).toMatchObject({quantity:2,note:'Sin sal'});
});
for(const text of ['cambia uno de los de fritas a broaster y agrega dos Agua Mineral','cambia el pollo a broaster y agrega dos Agua Mineral sin hielo y cancela pedido'])test(`unsupported subset or third action retains both ${text}`,async()=>{
 const {h}=withWater();const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);
});
for(const agent of [false,true])for(const state of ['awaiting_name','awaiting_phone','awaiting_address','awaiting_payment'])test(`mixed cart edit retains checkout stage ${agent} ${state}`,async()=>{
 const {h}=withWater(701,agent,state);const name=h.conv.customerName;const address=h.conv.sessionData.address;
 await h.sendQueued('agrega dos Agua Mineral y cambia el pollo a broaster');
 expect(h.conv.sessionData.cart.find(line=>line.productId===702)).toMatchObject({quantity:2,note:'Sin sal'});
 expect(h.conv.sessionData.cart.find(line=>line.productId===710)).toMatchObject({quantity:2});
 expect(h.conv.customerName).toBe(name);expect(h.conv.sessionData.address).toBe(address);expect(h.conv.state).toBe(state);
});
for(const [source,target] of [[703,701],[704,702]] as const)for(const agent of [false,true])for(const destination of ['pollo sin combo','pollo normal'])test(`combo to normal with new purchase ${source} ${agent} ${destination}`,async()=>{
 const {h}=withWater(source,agent);await h.sendQueued(`cambia el combo a ${destination} y agrega dos Agua Mineral`);
 expect(h.conv.sessionData.cart.some(line=>line.productId===source)).toBe(false);
 expect(h.conv.sessionData.cart.find(line=>line.productId===target)).toMatchObject({quantity:2,note:'Sin sal'});
 expect(h.conv.sessionData.cart.find(line=>line.productId===710)).toMatchObject({quantity:2});
});
for(const agent of [false,true])for(const style of ['frito','broaster'])test(`attribute preparation and purchase ${agent} ${style}`,async()=>{
 const {h}=withWater(714,agent);h.conv.sessionData.cart[0].attributes!.push({attributeName:'Pollo',attributeValue:style==='frito'?'Broaster':'Frito'});
 await h.sendQueued(`cambia el arroz chino con medio pollo a ${style} y agrega dos Agua Mineral`);
 expect(h.conv.sessionData.cart.find(line=>line.productId===714)).toMatchObject({quantity:2,note:'Sin sal',attributes:expect.arrayContaining([{attributeName:'Pollo',attributeValue:style==='frito'?'Frito':'Broaster'}])});
 expect(h.conv.sessionData.cart.some(line=>line.productId===701||line.productId===702)).toBe(false);expect(h.conv.sessionData.cart.find(line=>line.productId===710)).toMatchObject({quantity:2});
});
for(const [source,target,owner,destination] of [[707,708,'medio frito','medio broaster'],[708,707,'medio broaster','medio frito'],[712,713,'cuarto frito','cuarto broaster'],[713,712,'cuarto broaster','cuarto frito']] as const)for(const agent of [false,true])test(`portion alias with new purchase ${source} ${agent}`,async()=>{
 const {h}=withWater(source,agent);await h.sendQueued(`cambia el ${owner} por ${destination} y agrega dos Agua Mineral`);
 expect(h.conv.sessionData.cart.find(line=>line.productId===target)).toMatchObject({quantity:2,note:'Sin sal'});
 expect(h.conv.sessionData.cart.some(line=>line.productId===source)).toBe(false);expect(h.conv.sessionData.cart.find(line=>line.productId===710)).toMatchObject({quantity:2});
});
