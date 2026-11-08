import {harness} from './whatsapp-accuracy.test-support';
const fields=['A nombre de Camila Rojas','Mi celular es 3000000002','La dirección es Calle 6B #81B-51 Torre 3 apto 510','Pago por Nequi'];
async function setup(name:string,agent:boolean){
 const options=name==='Jugo Natural'?['Mango','Lulo']:['Guanabana','Fresa'];
 const menu=[{id:41701,code:1,name:options[0],price:19000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41702,code:2,name:'Pasta Del Huerto',price:27000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:41703,code:3,name,price:6000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options}]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:417,dailyOrderNumber:417});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{cart:menu.slice(0,2).map(product=>({productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:1,attributes:[],note:'Sin sal'})),orderType:'delivery',fulfillmentChosen:true,address:'Calle 1 #2-3',addressConfirmed:true,deliveryFeeCalculated:2000,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});
 await h.sendQueued('Quiero un '+name);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(41703);
 await h.sendQueued('Que precio tiene');expect(h.conv.sessionData.pendingPriceInquiry).toBeDefined();expect(h.conv.sessionData.pendingAttribute).toBeDefined();return{h,options,menu};
}
for(const name of ['Jugo Natural','Batido Natural'])for(const agent of [false,true])for(const cancel of ['cancelar','cancela el pedido','por favor cancelar pedido','quiero cancelar el pedido'])it(`cancels both competing decisions and starts clean ${name}/${agent}/${cancel}`,async()=>{
 const {h,options}=await setup(name,agent);const reply=await h.sendQueued(cancel);expect(reply).toMatch(/cancelad|vaci/i);expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingPriceInquiry).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('Quiero un '+name);await h.sendQueued(options[1]);expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41703,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:options[1]}]})]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
