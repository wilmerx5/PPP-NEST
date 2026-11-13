import {harness} from './whatsapp-accuracy.test-support';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';
const savedFetch=global.fetch;
afterEach(()=>{global.fetch=savedFetch;jest.restoreAllMocks();});
async function start(agent:boolean,dish='Bowl Andino',quantity=1){
 const h=harness([
 {id:94801,code:81,name:dish,price:18000,availableNow:true,attributes:[]},
 {id:94802,code:82,name:'Wrap Vegetal',price:15000,availableNow:true,attributes:[]},
 {id:94803,code:83,name:'Jugo Natural',price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]},
 ],agent);
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:480,dailyOrderNumber:480});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
 jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
 global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[1,2].map(n=>({
 formatted_address:`Conjunto Los Pinos, Calle ${10+n} #80-20, Bogotá, Colombia`,types:['premise'],
 geometry:{location:{lat:4.63+n/1000,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]
 }))})});
 h.service.deliveryRouting=routing;
 await h.sendQueued(`quiero ${quantity} ${dish} y un Wrap Vegetal`);await h.sendQueued('nada más');
 await h.sendQueued('Conjunto Los Pinos torre 3 apto 402');expect(h.conv.sessionData.pendingDeliveryCandidates).toHaveLength(2);
 return h;
}
for(const agent of [false,true])for(const other of ['price','flavor'])test(`location ownership ${agent}/${other}`,async()=>{
 const h=await start(agent);
 await h.sendQueued(other==='price'?'qué precio tienen':'quiero un Jugo Natural');
 const before=structuredClone(h.conv.sessionData);
 const reply=await h.sendQueued('2');
 expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/dirección completa/);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued(other==='price'?'precio 2':'Sabor: Mango');
 expect(h.conv.sessionData.pendingDeliveryCandidates).toEqual(before.pendingDeliveryCandidates);
 await h.sendQueued(before.pendingDeliveryCandidates![1].address);
 expect(h.conv.sessionData.address).toContain('Calle 12');expect(h.conv.sessionData.address).toContain('402');
 expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();
 await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(other==='price'?2:3);
 expect(dto.address).toContain('Calle 12');expect(dto.address).toContain('402');
});
for(const dish of ['Bowl Andino','Arroz Con Pollo','Ensalada Campestre'])for(const agent of [false,true])
for(const short of ['1','2','el primero','la primera','el segundo','la segunda'])for(const other of ['price','flavor','both'])
for(const order of ['otherFirst','addressFirst'])for(const quantity of [1,2]){
 test(`${dish}/${agent}/${short}/${other}/${order}/${quantity}: disambiguate location without spending another list's answer`,async()=>{
  const h=await start(agent,dish,quantity);
  if(other!=='price')await h.sendQueued('quiero un Jugo Natural');
  if(other!=='flavor')await h.sendQueued('qué precio tienen');
  const before=structuredClone(h.conv.sessionData),fetches=(global.fetch as jest.Mock).mock.calls.length;
  const reply=await h.sendQueued(short);
  expect(h.conv.sessionData).toEqual(before);expect(reply).toMatch(/dirección completa/);
  expect((global.fetch as jest.Mock).mock.calls).toHaveLength(fetches);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const targetIndex=/2|segund/.test(short)?0:1;
  const target=before.pendingDeliveryCandidates![targetIndex];
  const resolveOther=async()=>{
   if(other!=='flavor'){
    const price=await h.sendQueued('precio 2');expect(price).toMatch(/15[.,]000/);
    expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
   }
   if(other!=='price')await h.sendQueued('Sabor: Lulo');
  };
  if(order==='otherFirst'){
   await resolveOther();expect(h.conv.sessionData.pendingDeliveryCandidates).toEqual(before.pendingDeliveryCandidates);
   await h.sendQueued(target.address);
  }else{
   await h.sendQueued(target.address);
   expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();
   expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await resolveOther();
  }
  expect(h.conv.sessionData.pendingDeliveryCandidates).toBeUndefined();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.address).toContain(`Calle ${11+targetIndex}`);
  expect(h.conv.sessionData.address).toContain('402');expect(h.conv.sessionData.deliveryLat).toBe(target.lat);
  expect(h.conv.sessionData.deliveryLng).toBe(target.lng);expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
  expect(h.conv.sessionData.cart.slice(0,2)).toEqual(before.cart);
  if(other!=='price')expect(h.cartRows()[2]).toMatchObject({id:94803,qty:1,attrs:['Sabor:Lulo']});
  await h.sendQueued('en efectivo');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toContain(`Calle ${11+targetIndex}`);expect(dto.address).toContain('402');
  expect(dto.items).toHaveLength(quantity+(other==='price'?1:2));
  expect(dto.items.filter((item:any)=>item.productId===94801)).toHaveLength(quantity);
 });
}
for(const agent of [false,true])for(const payment of ['1','2'])test(`bare number belongs to payment after address ${agent}/${payment}`,async()=>{
 const h=await start(agent);await h.sendQueued('qué precio tienen');
 const snapshot=structuredClone(h.conv.sessionData);await h.sendQueued(snapshot.pendingDeliveryCandidates![0].address);
 expect(h.conv.state).toBe('awaiting_payment');const cart=structuredClone(h.conv.sessionData.cart);
 const reply=await h.sendQueued(payment);
 expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(cart);
 expect(h.conv.sessionData.paymentMethod).toBe(payment==='1'?'cash':'transfer');expect(reply).toMatch(/confirmar/);
 expect(h.conv.sessionData.address).toContain('Calle 11');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});
