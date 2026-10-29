import { harness } from './whatsapp-accuracy.test-support';

for(const dish of ['Bowl Vegetal','Pasta Del Huerto','Arroz Con Pollo'])
for(const enabled of [false,true]) describe(`Role interruptions ${dish} agent=${enabled}`,()=>{
 function rig(){
  const h=harness([{id:87003,code:87003,name:dish,price:18000,availableNow:true,attributes:[]},{id:87004,code:87004,name:'Agua Mineral',price:4000,availableNow:true,attributes:[]}],enabled);
  h.conv.customerName=null as never;h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  Object.assign(h.conv.sessionData,{cart:[{productId:87003,code:87003,name:dish,quantity:1,unitPrice:18000,note:'Sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:63,dailyOrderNumber:63});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  return h;
 }
 async function finish(h:ReturnType<typeof rig>){await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);return h.service.ordersService.create.mock.calls[0][0];}
 it.each([false,true])('keeps an address given before place clarification, unit=%s',async unit=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await h.sendQueued('Calle 10 #20-30');
  if(unit)await h.sendQueued('Apto 502');
  await h.sendQueued('es el conjunto');expect(h.conv.sessionData.address).toContain('20-30');expect(h.conv.sessionData.address).toContain('Los Cedros');if(unit)expect(h.conv.sessionData.address).toContain('502');
  await h.sendQueued('Natalia');const dto=await finish(h);expect(dto.customerName).toBe('Natalia');expect(dto.items[0].note).toBe('Sin cebolla');expect(JSON.stringify(dto)).toContain('Los Cedros');
 });
 it('pickup cancels the place/name doubt without turning the label into a name',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await h.sendQueued('lo recojo en el local');
  expect(h.conv.sessionData.orderType).toBe('pickup');expect(h.conv.sessionData.pendingRecipientOrPlace).toBeUndefined();expect(h.conv.customerName).toBeNull();
  await h.sendQueued('Natalia');const dto=await finish(h);expect(dto.customerName).toBe('Natalia');expect(h.conv.sessionData.pendingDeliveryPlace).toBeUndefined();
 });
 it('explicit recipient after adding another product resolves the role',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await h.sendQueued('Agrega un Agua Mineral');expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Los Cedros');expect(h.replies.at(-1)).toContain('Agua Mineral');await h.sendQueued('me llamo Natalia');
  expect(h.conv.customerName).toBe('Natalia');expect(h.conv.sessionData.pendingRecipientOrPlace).toBeUndefined();expect(h.conv.sessionData.cart).toHaveLength(2);
  await h.sendQueued('Calle 10 #20-30');const dto=await finish(h);expect(dto.items).toHaveLength(2);expect(dto.items[0].note).toBe('Sin cebolla');
 });
 it('replaces the fresh destination instead of resurrecting the previous street',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await h.sendQueued('Calle 10 #20-30');
  await h.sendQueued('Cambia la dirección a Calle 12 #30-40');await h.sendQueued('es el conjunto');
  expect(h.conv.sessionData.address).toContain('30-40');expect(h.conv.sessionData.address).not.toContain('20-30');
  expect(h.conv.sessionData.address).toContain('Los Cedros');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('a purchase question does not add or resolve the pending role',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('¿Agrega un Agua Mineral?');expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingRecipientOrPlace).toBe('Los Cedros');expect(h.conv.customerName).toBeNull();
 });
 it('a new location pin invalidates the remembered street',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await h.sendQueued('Calle 10 #20-30');
  await h.sendQueued('',{messageType:'location',latitude:4.62,longitude:-74.12});
  expect(h.conv.sessionData.pendingRecipientOrPlaceAddress).toBeUndefined();
  await h.sendQueued('es el conjunto');expect(h.conv.sessionData.address || '').not.toContain('20-30');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('does not reuse a street saved before the ambiguous label',async()=>{
  const h=rig();Object.assign(h.conv.sessionData,{address:'Calle 90 #10-20',addressConfirmed:true,deliveryFeeCalculated:9000});
  await h.sendQueued('Solo eso porfa\nLos Cedros');await h.sendQueued('es el conjunto');
  expect(h.conv.sessionData.address).toBeUndefined();expect(h.conv.sessionData.deliveryFeeCalculated).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it('question about the role preserves the newly supplied address without deciding',async()=>{
  const h=rig();await h.sendQueued('Solo eso porfa\nLos Cedros');await h.sendQueued('Calle 10 #20-30');const before=structuredClone(h.conv.sessionData);
  await h.sendQueued('¿es el conjunto?');expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBeNull();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
});
