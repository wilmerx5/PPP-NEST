import {harness} from './whatsapp-accuracy.test-support';
for(const enabled of [false,true]) describe(`Drink browse agent=${enabled}`,()=>{
 it.each(['Quiero algo De tomar','Quiero algo para tomar','Qué bebidas tienes','Quiero una bebida'])('%s',async text=>{
  const h=harness(undefined,enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
  const reply=await h.sendQueued(text);
  console.log(JSON.stringify({text,agent:enabled,reply,cart:h.conv.sessionData.cart,category:h.conv.sessionData.pendingCategoryBrowse}));
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
 it.each(['No maa','No más'])('advances after %s',async text=>{
  const h=rig();const reply=await h.sendQueued(text);console.log(JSON.stringify({text,agent:enabled,reply,state:h.conv.state,cartLength:h.conv.sessionData.cart.length}));expect(h.conv.sessionData.cart).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.state).toBe('awaiting_address');expect(reply).toMatch(/direcci[oó]n/i);
 });
 it('Si attempts creation after final review',async()=>{
  const h=rig();Object.assign(h.conv.sessionData,{address:'Calle 10 #20-30',addressConfirmed:true,deliveryFeeCalculated:4000,paymentMethod:'cash'});
  await h.sendQueued('No más');expect(h.conv.state).toBe('awaiting_final_confirm');const reply=await h.sendQueued('Si');console.log(JSON.stringify({text:'Si after final review',agent:enabled,reply,state:h.conv.state,createCalls:h.service.ordersService.create.mock.calls.length}));expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 });
});
