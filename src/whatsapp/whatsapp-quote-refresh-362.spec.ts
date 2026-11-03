import {harness} from './whatsapp-accuracy.test-support';
async function setup(name:string,agent:boolean,quantity:number){
 const menu=[{id:98301,code:831,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]}];
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:362,dailyOrderNumber:362});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 await h.sendQueued(`Cuánto valen ${quantity} ${name}?`);
 expect(h.conv.sessionData.pendingAddOffer).toMatchObject({productId:98301,quantity,price:20000});
 return {h,menu};
}
for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])for(const quantity of [1,2]){
 for(const price of [18000,23000])for(const accept of [false,true])it(`quote price changes ${name} ${agent} ${quantity} ${price} ${accept}`,async()=>{
  const {h,menu}=await setup(name,agent,quantity);h.service.catalogService.getMenuProducts.mockResolvedValue([{...menu[0],price}]);
  const reply=await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);expect(reply).toMatch(/precio.*cambi|cambi.*precio/i);expect(reply).toContain(price===18000?'18.000':'23.000');
  expect(h.conv.sessionData.pendingAddOffer).toMatchObject({quantity,price});expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('Me pasas el menú porfa');expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued(accept?'sí':'no');expect(h.conv.sessionData.cart).toHaveLength(accept?1:0);
  if(accept){expect(h.conv.sessionData.cart[0]).toMatchObject({quantity,unitPrice:price});await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(quantity);}
 });
 for(const removed of [false,true])it(`quoted dish disappears ${name} ${agent} ${quantity} ${removed}`,async()=>{
  const {h,menu}=await setup(name,agent,quantity);h.service.catalogService.getMenuProducts.mockResolvedValue(removed?[]:[{...menu[0],availableNow:false}]);
  const reply=await h.sendQueued('sí');expect(reply).toMatch(/no.*disponible|no.*carta/i);expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`unchanged quote accepted once ${name} ${agent} ${quantity}`,async()=>{
  const {h}=await setup(name,agent,quantity);await h.sendQueued('sí');expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({quantity,unitPrice:20000});expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
 });
}
for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])for(const unavailable of [false,true])it(`catalog changes again after requote ${name} ${agent} ${unavailable}`,async()=>{
 const {h,menu}=await setup(name,agent,2);h.service.catalogService.getMenuProducts.mockResolvedValue([{...menu[0],price:23000}]);await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);
 h.service.catalogService.getMenuProducts.mockResolvedValue([{...menu[0],price:26000,availableNow:!unavailable}]);
 const reply=await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(unavailable)expect(reply).toMatch(/no.*disponible/i);
 else{expect(reply).toContain('26.000');expect(h.conv.sessionData.pendingAddOffer).toMatchObject({quantity:2,price:26000});await h.sendQueued('sí');expect(h.conv.sessionData.cart[0]).toMatchObject({quantity:2,unitPrice:26000});}
});
for(const name of ['Arroz Con Pollo','Pasta Vegetal'])for(const agent of [false,true])for(const answer of ['2','agrega los dos'])it(`quantity reply preserves price review ${name} ${agent} ${answer}`,async()=>{
 const {h,menu}=await setup(name,agent,1);h.service.catalogService.getMenuProducts.mockResolvedValue([{...menu[0],price:23000}]);
 const reply=await h.sendQueued(answer);expect(reply).toContain('23.000');expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAddOffer).toMatchObject({quantity:2,price:23000});
 await h.sendQueued('sí');expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({quantity:2,unitPrice:23000});
});
