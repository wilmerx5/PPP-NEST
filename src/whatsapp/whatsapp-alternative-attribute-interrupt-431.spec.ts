import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(family:string,agent:boolean){
 const menu:Array<{id:number;code:number;name:string;categoryName:string;price:number;availableNow:boolean;hasAttributes:boolean;attributes:{attributeName:string;options:string[]}[]}>=[{id:41001,code:2,name:family+' Clásica',categoryName:family+'s',price:20000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41002,code:1,name:family+' Especial',categoryName:family+'s',price:25000,availableNow:true,hasAttributes:false,attributes:[]}];
 menu.push({id:41009,code:90,name:'Porción Del Huerto',categoryName:'Acompañamientos',price:7000,availableNow:true,hasAttributes:false,attributes:[]});
 const attributeName='Bebida',options=family==='Hamburguesa'?['Colombiana','Ginger']:['Limonada','Manzana'];for(const product of menu.slice(0,2)){product.hasAttributes=true;product.attributes=[{attributeName,options}];}
 const h=harness(menu,agent);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál bebida prefieres?',actions:{}});h.cfg.ignoreBusinessHours=false;
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
for(const family of ['Hamburguesa','Pizza'])for(const agent of [false,true])for(const index of [0,1])for(const change of ['price','stock','removed'])for(const interruption of ['price','phone'])for(const numeric of [false,true])it(`attribute resumes after interruption on alternative ${family}/${agent}/${index}/${change}/${interruption}/${numeric}`,async()=>{
 const {h,menu}=await populated(family,agent),before=structuredClone(h.conv.sessionData.cart),product=menu[index],alternative=menu[1-index],attribute=alternative.attributes[0];
 if(change==='price')product.price=27000;else if(change==='stock')product.availableNow=false;else menu.splice(index,1);
 await h.sendQueued('#'+product.code+'; '+fields.join('; '));expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('#'+alternative.code);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(alternative.id);
 const reply=await h.sendQueued(interruption==='price'?'Cuánto cuesta '+alternative.name:'Mi celular es 3000000003');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(alternative.id);expect(h.service.ordersService.create).not.toHaveBeenCalled();if(interruption==='price')expect(reply).toMatch(alternative.price===20000?/20[.,]000/:/25[.,]000/);else expect(h.conv.sessionData.contactPhone).toMatch(/3000000003$/);
 await h.sendQueued(numeric?'2':attribute.options[1]);expect(h.conv.sessionData.cart).toEqual([...before,expect.objectContaining({productId:alternative.id,quantity:1,unitPrice:alternative.price,attributes:[{attributeName:attribute.attributeName,attributeValue:attribute.options[1]}]})]);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
 const cart=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Por favor');expect(h.conv.sessionData.cart).toEqual(cart);await h.sendQueued('no más');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(item=>item.productId)).toEqual([41009,41009,alternative.id]);expect(dto.customerName).toBe('Camila Rojas');expect(dto.phone).toMatch(interruption==='phone'?/3000000003$/:/3000000002$/);expect(dto.address).toMatch(/81b/i);
});
