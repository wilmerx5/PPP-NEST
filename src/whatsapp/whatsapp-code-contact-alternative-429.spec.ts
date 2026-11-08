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
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true])for(const index of [0,1])for(const change of ['price','stock','removed'])for(const selection of ['code','row','ordinal','name'])it(`switches to another offered item after catalog change ${family}/${agent}/${index}/${change}/${selection}`,async()=>{
 const {h,menu}=await populated(family,agent),before=structuredClone(h.conv.sessionData.cart),product=menu[index],alternative=menu[1-index],otherIndex=1-index;
 if(change==='price')product.price=27000;else if(change==='stock')product.availableNow=false;else menu.splice(index,1);
 const notice=await h.sendQueued('#'+product.code+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.customerName).toBe('Camila Rojas');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(notice).toMatch(change==='price'?/precio.*cambi/i:/no.*disponible/i);
 const choice=selection==='code'?'#'+alternative.code:selection==='row'?String(otherIndex+1):selection==='ordinal'?otherIndex===0?'el primero':'la segunda':alternative.name;
 const reply=await h.sendQueued(choice);expect(h.conv.sessionData.cart).toEqual([...before,expect.objectContaining({productId:alternative.id,quantity:1,unitPrice:alternative.price})]);expect(reply).toContain(alternative.name);expect(h.conv.sessionData.cart.some(item=>item.productId===product.id)).toBe(false);
 const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(cart);await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(item=>item.productId)).toEqual([41009,41009,alternative.id]);expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(/3000000002$/);expect(dto.address).toMatch(/81b/i);
});
