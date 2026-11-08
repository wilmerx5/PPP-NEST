import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(family:string,agent:boolean){
 const menu=[{id:41001,code:2,name:family+' Clásica',categoryName:family+'s',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41002,code:1,name:family+' Especial',categoryName:family+'s',price:25000,availableNow:true,hasAttributes:false,attributes:[]}];
 menu.push({id:41009,code:90,name:'Porción Del Huerto',categoryName:'Acompañamientos',price:7000,availableNow:true,hasAttributes:false,attributes:[]});
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
 Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 1 #2-3',addressConfirmed:true,fulfillmentChosen:true,
 deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:410,dailyOrderNumber:410});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('Quiero una '+family.toLowerCase());
 expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([41001,41002]);expect(h.conv.sessionData.cart).toEqual([]);
 return {h,menu};
}
const codes=[['#1',1],['#2',0],['el #1',1],['la #2',0],['código 1',1],['código 2',0]] as const;
async function populated(family:string,agent:boolean){const f=await setup(family,agent);f.h.conv.sessionData.cart=[{productId:41009,code:90,name:'Porción Del Huerto',unitPrice:7000,quantity:2,attributes:[],note:'Sin sal'}];return f;}
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true]){
 for(const [choice,index] of [['#1',1],['código 2',0]] as const)for(const change of ['price','stock','removed'])it(`code form rechecks live catalog and recovers ${family}/${agent}/${choice}/${change}`,async()=>{
  const {h,menu}=await populated(family,agent),before=structuredClone(h.conv.sessionData.cart),product=menu[index];
  if(change==='price')product.price=27000;else if(change==='stock')product.availableNow=false;else menu.splice(index,1);
  const reply=await h.sendQueued(choice+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();if(change==='price')expect(reply).toMatch(/precio.*cambi/i);else expect(reply).toMatch(/no.*disponible/i);
  if(change==='stock')product.availableNow=true;else if(change==='removed')menu.splice(index,0,product);
  await h.sendQueued(choice);expect(h.conv.sessionData.cart).toEqual([...before,expect.objectContaining({productId:product.id,quantity:1,unitPrice:product.price})]);await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(item=>item.productId)).toEqual([41009,41009,product.id]);expect(dto.customerName).toBe('Camila Rojas');
 });
 it(`duplicate offered code preserves whole form and can recover ${family}/${agent}`,async()=>{
  const {h,menu}=await populated(family,agent);menu[1].code=2;h.conv.sessionData.pendingMatch!.candidates.forEach(candidate=>{candidate.code=2});const before=structuredClone(h.conv.sessionData);
  const reply=await h.sendQueued('#2; '+fields.join('; '));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(reply).toMatch(/No cambié/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  menu[1].code=1;h.conv.sessionData.pendingMatch!.candidates.find(candidate=>candidate.id===41002)!.code=1;await h.sendQueued('#1; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([...before.cart,expect.objectContaining({productId:41002,quantity:1})]);
 });
 it(`known catalog code outside offered list preserves form ${family}/${agent}`,async()=>{
  const {h}=await populated(family,agent),before=structuredClone(h.conv.sessionData);const reply=await h.sendQueued('#90; '+fields.join('; '));expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe('Wilmer');expect(reply).toMatch(/No cambié/);expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('#2; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual([...before.cart,expect.objectContaining({productId:41001,quantity:1})]);
 });
}
