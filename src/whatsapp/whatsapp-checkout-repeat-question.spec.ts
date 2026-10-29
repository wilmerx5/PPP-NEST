import {harness} from './whatsapp-accuracy.test-support';
for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Con Pollo'])
for(const agent of [false,true]) describe(`Repeat checkout question ${dish} agent=${agent}`,()=>{
 function rig(state='building_cart'){
  const h=harness([{id:87301,code:87301,name:dish,price:18000,availableNow:true,attributes:state==='awaiting_attribute'?[{attributeName:'Bebida',options:['Limonada','Agua']}]:[]}],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.conv.state=state;h.conv.customerName=state==='awaiting_name'?null as never:'Natalia';
  Object.assign(h.conv.sessionData,{cart:[{productId:87301,name:dish,quantity:1,unitPrice:18000,note:'Con sobres de salsa de tomate'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  if(state==='awaiting_final_confirm')Object.assign(h.conv.sessionData,{address:'Calle 10 #20-30',addressConfirmed:true,deliveryFeeCalculated:2000,paymentMethod:'cash'});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:66,dailyOrderNumber:66});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);return h;
 }
 for(const [state,next] of [['building_cart',/algo más|solo eso/i],['awaiting_name',/nombre/i],['awaiting_address',/dirección/i],['awaiting_final_confirm',/confirmar/i]] as const)
 it.each(['Dime ?','No entendi','Como asi veci'])(`${state}: repeats context for %s without changing order`,async text=>{
  const h=rig(state);const before=structuredClone(h.conv.sessionData);const name=h.conv.customerName;const reply=await h.sendQueued(text);
  expect(reply).toContain(dish);expect(reply).toMatch(/salsa de tomate/i);expect(reply).toMatch(next);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe(name);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('repeats the unresolved name/place distinction',async()=>{
  const h=rig('awaiting_name');h.conv.sessionData.pendingRecipientOrPlace='Los Cedros';const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('Dime?');expect(reply).toMatch(/Los Cedros.*nombre.*(?:barrio|conjunto)/s);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBeNull();
 });
 it('repeats a pending option without choosing it',async()=>{
  const h=rig('awaiting_attribute');h.conv.sessionData.pendingAttribute={productId:87301,name:dish,code:87301,quantity:1,price:18000,attributes:[{attributeName:'Bebida',options:['Limonada','Agua']}],selected:[]};
  const before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('No entendi');expect(reply).toMatch(/Bebida|Limonada|Agua/i);expect(h.conv.sessionData).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('keeps a specific price question on its ordinary route',async()=>{
  const h=rig();const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued(`Dime cuánto cuesta ${dish}`);expect(reply?.replace(/[.,]/g,'')).toContain('18000');expect(reply).not.toContain('Te explico: esto');expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(['completed','closed'])('repeat handler cannot reopen %s',async state=>{
  const h=rig(state);const before=structuredClone(h.conv.sessionData);expect(await h.service.tryRepeatCheckoutQuestion(h.conv,'customer',h.conv.sessionData,'Dime?',h.cfg)).toBe(false);expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(h.replies).toHaveLength(0);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('continues from the repeat into an explicitly confirmed order',async()=>{
  const h=rig();await h.sendQueued('Dime?');expect(h.conv.state).toBe('building_cart');await h.sendQueued('solo eso porfa');await h.sendQueued('Calle 10 #20-30');await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(1);expect(dto.items[0].note).toContain('salsa de tomate');expect(dto.customerName).toBe('Natalia');
 });
});
