import {harness} from './whatsapp-accuracy.test-support';
for(const agent of [false,true]){
 it(`portería before name and street, agent=${agent}`,async()=>{
  const h=harness(undefined,agent);
  h.conv.customerName=null as any;h.conv.state='awaiting_name';
  Object.assign(h.conv.sessionData,{cart:[{productId:6,code:6,name:'1/4 Pollo Broaster',quantity:1,unitPrice:16000,attributes:[]}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,notesCollected:true});
  await h.sendQueued('Para la portería nuevo sol');
  expect(h.replies.join('\n')).not.toMatch(/Primero necesito/);
  await h.sendQueued('Katherin González');
  await h.sendQueued('Calle 6b # 80g 95');
  expect(h.conv.customerName).toBe('Katherin González');
  expect(h.conv.sessionData.address).toMatch(/nuevo sol/i);
  expect(h.conv.sessionData.customerNotes).toMatch(/porter/i);
 });
 it(`pin reference while final confirm, agent=${agent}`,async()=>{
  const h=harness(undefined,agent);
  h.conv.state='awaiting_final_confirm';
  Object.assign(h.conv.sessionData,{cart:[{productId:23,code:23,name:'Arroz Con Pollo',quantity:1,unitPrice:32000,attributes:[]}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,notesCollected:true,paymentMethod:'contraentrega',address:'Ubicación compartida — https://maps.google.com/?q=4.62,-74.14',addressConfirmed:true,deliveryLat:4.62,deliveryLng:-74.14,deliveryFeeCalculated:5000});
  await h.sendQueued('Puedes poner en la direcciones esta porfa');
  expect(h.replies.at(-1)).toMatch(/cu[aá]l|escribe|indica|referencia/i);
  await h.sendQueued('Clandestino 1972 Rooftop');
  expect(h.conv.sessionData.address).toContain('Clandestino 1972 Rooftop');
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(5000);
  expect(h.conv.state).toBe('awaiting_final_confirm');
 });
}

// Independent probes: a failed earlier response must not hide later failures.
for (const agent of [false, true]) {
  it(`direct named reference after pin, agent=${agent}`, async () => {
    const h = harness(undefined, agent);
    h.conv.state = 'awaiting_final_confirm';
    Object.assign(h.conv.sessionData, {
      cart: [{productId:23,code:23,name:'Arroz Con Pollo',quantity:1,unitPrice:32000,attributes:[]}],
      orderType:'delivery', fulfillmentChosen:true, phoneConfirmed:true, notesCollected:true,
      paymentMethod:'contraentrega', address:'Ubicación compartida — https://maps.google.com/?q=4.62,-74.14',
      addressConfirmed:true, deliveryLat:4.62, deliveryLng:-74.14, deliveryFeeCalculated:5000,
    });
    await h.sendQueued('Clandestino 1972 Rooftop');
    expect(h.conv.sessionData.address).toContain('Clandestino 1972 Rooftop');
    expect(h.conv.sessionData.deliveryFeeCalculated).toBe(5000);
    expect(h.conv.state).toBe('awaiting_final_confirm');
  });
  it(`total inquiry after closing shopping, agent=${agent}`, async () => {
    const h = harness(undefined, agent);
    Object.assign(h.conv.sessionData, {
      cart:[{productId:23,code:23,name:'Arroz Con Pollo',quantity:1,unitPrice:32000,attributes:[]},
            {productId:20,code:20,name:'Sopa De Menudencias',quantity:1,unitPrice:12000,attributes:[]}],
      orderType:'delivery', fulfillmentChosen:true, phoneConfirmed:true, notesCollected:true,
    });
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('No señor, así está bien');
    await h.sendQueued('Cuánto sería');
    expect(h.replies.at(-1)).toContain('44.000');
    expect(h.replies.at(-1)).not.toMatch(/cu[aá]l producto/i);
    expect(h.conv.sessionData.cart).toEqual(cart);
  });
}
