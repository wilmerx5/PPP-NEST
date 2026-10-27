import { harness } from './whatsapp-accuracy.test-support';
import { writeFileSync } from 'fs';

const edits = [
 {key:'name',text:'A nombre de Laura García'},
 {key:'payment',text:'A nombre de Laura García, pago contraentrega'},
 {key:'question',text:'A nombre de Laura García. ¿Cuánto cuesta el domicilio?'},
];
for(const product of ['Arroz Con Pollo','Pizza Margarita','Bowl Vegetal']) for(const agent of [false,true]) for(const edit of edits) {
 it(`final confirmation recipient ${product}/${agent}/${edit.key}`,async()=>{
  const h=harness([{id:42,code:42,name:product,price:20000,availableNow:true,attributes:[]}],agent);
  h.conv.customerName='';
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:0.6,source:'google_directions',customer:{lat:4.63,lng:-74.15}})};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:997,dailyOrderNumber:97});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  const profile={profileName:'Katherine Agudelo'};
  try {
   await h.sendQueued(`Me das un ${product} para Calle 10 #81A-20`,profile);
   expect(h.conv.customerName).toBe('Katherine Agudelo');
   await h.sendQueued('contraentrega',profile);
   expect(h.replies.at(-1)).toMatch(/confirmar/i);
   const cart=structuredClone(h.conv.sessionData.cart);
   await h.sendQueued(edit.text,profile);
   expect(h.conv.customerName).toBe('Laura García');
   expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.replies.at(-1)).not.toMatch(/no entend|nombre real|algo más/i);
   if(edit.key==='payment') expect(h.conv.sessionData.paymentMethod).toBe('cash');
   if(edit.key.startsWith('question')) {
    expect(h.replies.at(-1)).toMatch(/domicilio[^\n]*2[.,]000/i);
    expect(h.replies.at(-1)).toMatch(/confirmar/i);
   }
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   expect(h.conv.sessionData.paymentMethod).toBe('cash');
   expect(h.conv.state).toBe('awaiting_final_confirm');
   expect(h.conv.sessionData.address).toBe('Calle 10 #81A-20');
   expect(h.replies.slice(-2).join('\n')).toContain('Laura García');
   expect(h.replies.at(-1)).toMatch(/confirmar/i);
   await h.sendQueued('confirmar',profile);
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.customerName).toBe('Laura García');expect(dto.items).toHaveLength(1);expect(dto.items[0].productId).toBe(42);
   expect(dto.deliveryFee).toBe(2000);
   expect(h.conv.state).toBe('completed');
  }finally{writeFileSync(`/tmp/ppp-233-${product}-${agent}-${edit.key}.json`,JSON.stringify({replies:h.replies,session:h.conv.sessionData,name:h.conv.customerName,state:h.conv.state},null,2));}
 });
}
