import {harness} from './whatsapp-accuracy.test-support';

// chat.txt, 14:00: repeating a destination bought four unrelated meals.
// Synthetic catalogues deliberately include code 4; address numbers are never purchases.
for (const dish of ['Bowl Vegetal','Pizza De Hongos','Ramen De Miso'])
for (const agent of [false,true])
for (const destination of ['Para conjunto Los Olivos torre 4 apto 404']) {
 it(`${dish}: repeated numeric destination preserves order, agent=${agent}: ${destination}`,async()=>{
  const h=harness([
   {id:98701,code:87,name:dish,price:23000,availableNow:true,attributes:[]},
   {id:98702,code:4,name:'Bandeja Especial',price:18000,availableNow:true,attributes:[]},
  ],agent);
  Object.assign(h.conv.sessionData,{cart:[{productId:98701,code:87,name:dish,quantity:2,unitPrice:23000,attributes:[],note:'sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Calle 10 #20-30',addressConfirmed:true,deliveryFeeCalculated:2000});
  h.conv.customerName='Laura García';h.conv.state='awaiting_payment';
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const cart=structuredClone(h.conv.sessionData.cart);
  for(let repeat=0;repeat<2;repeat++){
   const start=h.replies.length;
   await h.sendQueued(destination);
   expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.replies.slice(start).join('\n')).not.toMatch(/agregu[eé]|Bandeja Especial/i);
   expect(h.conv.sessionData.address).not.toContain('20-30');
   expect(h.conv.sessionData.address).toMatch(/4/);
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
  }
  await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_final_confirm');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toEqual(Array.from({length:2},()=>expect.objectContaining({productId:98701,note:'sin cebolla'})));
  expect(dto.address).toMatch(/4/);expect(dto.address).not.toContain('20-30');
  expect(dto.customerName).toBe('Laura García');
  expect(dto.deliveryFee).toBe(2000);
 });
}
