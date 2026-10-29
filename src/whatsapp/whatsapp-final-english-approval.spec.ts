import {harness} from './whatsapp-accuracy.test-support';
const names=['Baby beef','Bowl de garbanzos','Ravioles de ricota'];
function setup(name:string,agent:boolean,payment:string,type:string){
 const p={id:89701,code:89701,name,price:40000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Término',options:['Azul','Medio']}]};
 const h=harness([p],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{cart:[{productId:p.id,code:p.code,name,quantity:1,unitPrice:p.price,attributes:[{attributeName:'Término',attributeValue:'Azul'}],note:'Salsa aparte'}],orderType:type,fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,paymentMethod:payment,notesCollected:true,deliveryFeeCalculated:4000});
 h.conv.state='awaiting_final_confirm';return h;
}
for(const name of names)for(const agent of [false,true])for(const payment of ['cash','transfer'])for(const type of ['delivery','pickup']){
 for(const text of ['yes','YES','Yes!','yes gracias','yes 👍'])it(`approve ${name} ${agent} ${payment} ${type} ${text}`,async()=>{
  const h=setup(name,agent,payment,type);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(text);expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(reply).toMatch(/pedido quedó registrado/i);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items[0].productId).toBe(before[0].productId);expect(dto.items).toHaveLength(1);expect(dto.items[0].attributes).toEqual(before[0].attributes);expect(dto.items[0].note).toBe(before[0].note);
 });
 for(const text of ['yes?','¿yes?','yes pero cambia la dirección','yes si llega en diez minutos','not yes'])it(`not approval ${name} ${agent} ${payment} ${type} ${text}`,async()=>{
  const h=setup(name,agent,payment,type),before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.cart).toEqual(before);
 });
 for(const text of ['no','no más','solo eso'])it(`recover close ${name} ${agent} ${payment} ${type} ${text}`,async()=>{
  const h=setup(name,agent,payment,type),before=structuredClone(h.conv.sessionData.cart);
  for(let i=0;i<2;i++){
   const reply=await h.sendQueued(text);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/confirmar/i);expect(reply).not.toMatch(/algo más/i);
  }
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 });
 for(const pending of ['removal','quantity','replacement'])it(`pending edit ${name} ${agent} ${payment} ${type} ${pending}`,async()=>{
  const h=setup(name,agent,payment,type),before=structuredClone(h.conv.sessionData.cart),base={cartSignature:JSON.stringify(before),options:[{cartIndex:0,label:name}]};
  if(pending==='removal')h.conv.sessionData.pendingCartRemoval=base;
  if(pending==='quantity')h.conv.sessionData.pendingCartQuantity={...base,quantity:2} as any;
  if(pending==='replacement')h.conv.sessionData.pendingCartReplacement={...base,addQuery:'otro'};
  await h.sendQueued('yes');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.cart).toEqual(before);
 });
}
