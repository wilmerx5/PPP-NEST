import {harness} from './whatsapp-accuracy.test-support';
import {writeFileSync} from 'fs';
for(const family of ['Arroz Chino','Bowl Vegetal','Pasta Artesanal']) for(const agent of [false,true]) it(`combo plus address and recovery ${family}/${agent}`,async()=>{
 const menu=[
  {id:97,code:97,name:`Combo ${family} Con Medio Pollo`,price:54000,description:'Arroz chino con medio pollo y bebida de 1.5L',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Uva']},{attributeName:'Pollo',options:['Frito','Broaster']}]},
  {id:85,code:85,name:`Combo ${family} Con Costillas De Cerdo`,price:56000,description:'Arroz chino con costillas y bebida de 1.5L',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Uva']}]}
 ];
 const h=harness(menu,agent);h.conv.customerName='';let located=false;
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async()=>located?{ok:true,fee:2000,distanceKm:0.5,source:'google_directions',customer:{lat:4.63,lng:-74.15}}:{ok:false,reason:'address_ambiguous',message:'No pude identificar con seguridad esa dirección. ¿Me compartes la ubicación de WhatsApp?'})};
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:997,dailyOrderNumber:97});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 try{
  await h.sendQueued(`Hola veci como estas porfavor me da un combo de ${family} con gaseosa uva gracias para la calle 6 a # 79a 61`);
  expect(h.conv.sessionData.cart).toHaveLength(0);
  expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
  expect(h.replies.join('\n')).toMatch(/costillas/i);
  expect(h.replies.join('\n')).toMatch(/medio pollo/i);
  expect(h.replies.join('\n')).not.toMatch(/no tenemos/i);
  expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
  await h.sendQueued('1');
  await h.sendQueued('Frito');
  expect(h.conv.sessionData.cart).toHaveLength(1);
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Uva'});
  await h.sendQueued('Katherine Agudelo');
  expect(h.conv.customerName).toBe('Katherine Agudelo');
  expect(h.conv.sessionData.address).toMatch(/79a 61/i);
  expect(h.replies.at(-1)).toMatch(/ubicaci[oó]n/i);
  expect(h.replies.at(-1)).toMatch(/provisional; domicilio pendiente/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  located=true;
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  await h.sendQueued('Calle 6A #79A-61');
  expect(h.replies.at(-1)).toMatch(/c[oó]mo pagas|m[eé]todo de pago/i);
  await h.sendQueued('contraentrega');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.customerName).toBe('Katherine Agudelo');
  expect(dto.items).toHaveLength(1);expect(dto.items[0].productId).toBe(97);
  expect(dto.items[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Uva'});
  expect(dto.items[0].attributes).toContainEqual({attributeName:'Pollo',attributeValue:'Frito'});
  expect(h.conv.state).toBe('completed');
 }finally{writeFileSync(`/tmp/ppp-228-katherine-${family}-${agent}.json`,JSON.stringify({session:h.conv.sessionData,replies:h.replies,state:h.conv.state},null,2));}
});

it('a combo family with an additional dish keeps that dish in the multi-order flow',async()=>{
 const menu=[
  {id:97,code:97,name:'Combo Arroz Chino Con Medio Pollo',price:54000,availableNow:true,description:'Con bebida',attributes:[]},
  {id:85,code:85,name:'Combo Arroz Chino Con Costillas',price:56000,availableNow:true,description:'Con bebida',attributes:[]},
  {id:42,code:42,name:'Limonada Natural',price:5000,availableNow:true,attributes:[]},
 ];
 const h=harness(menu,false);
 await h.sendQueued('Me das un combo de arroz chino con gaseosa y una limonada natural');
 expect(h.conv.sessionData.cart.some((line:any)=>line.productId===42)).toBe(true);
});
