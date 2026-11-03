import {harness} from './whatsapp-accuracy.test-support';
import {isNothingElseOrderIntent} from './whatsapp-intent';
import {isUsableWhatsappCustomerName} from './whatsapp-session-intents';
const closings=['No así no más','No, así no más.','así no más','no asi nomas','No señor, así no más','No así no más gracias'];
function setup(other:boolean,agent:boolean,state:string){
 const names=other?['Combo Vegetal','Arroz Con Tofu']:['Combo De Pollo Frito','Arroz Chino'];
 const menu=names.map((name,index)=>({id:98301+index,code:index+1,name,price:index?38000:53000,availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);h.conv.customerName=null as never;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'Aclaremos el pedido',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:353,dailyOrderNumber:353});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.conv.sessionData.cart=menu.map(p=>({productId:p.id,code:p.code,name:p.name,quantity:1,unitPrice:p.price,attributes:[]}));
 Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000});
 h.conv.state=state;return h;
}
for(const other of [false,true])for(const agent of [false,true])for(const state of ['building_cart','awaiting_name'])for(const said of closings)it(`closing is not name ${other} ${agent} ${state} ${said}`,async()=>{
 const h=setup(other,agent,state),before=structuredClone(h.conv.sessionData.cart);
 const reply=await h.sendQueued(said);
 expect(h.conv.customerName).toBeNull();expect(h.conv.state).toBe('awaiting_name');expect(reply).toMatch(/nombre/i);
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('Lucía Fernández');expect(h.conv.customerName).toBe('Lucía Fernández');
 await h.sendQueued('contraentrega');const receipt=await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Lucía Fernández');expect(dto.items).toHaveLength(2);
 expect(receipt).toContain('93.000');expect(receipt).not.toContain(said);
});
for(const agent of [false,true])for(const badName of ['No así no más','así no más'])it(`old polluted name requires repair ${agent} ${badName}`,async()=>{
 const h=setup(false,agent,'building_cart');h.conv.customerName=badName;
 const reply=await h.sendQueued('no más');expect(h.conv.state).toBe('awaiting_name');expect(reply).toMatch(/nombre/i);
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('María de los Ángeles');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].customerName).toBe('María de los Ángeles');
});
for(const phrase of closings)it(`closing semantic contract ${phrase}`,()=>{expect(isNothingElseOrderIntent(phrase)).toBe(true);expect(isUsableWhatsappCustomerName(phrase)).toBe(false);});
for(const phrase of ['No así, más arroz','no así, cambia el pollo','así no más si viene con gaseosa','no así no más, agrega un jugo'])it(`mixed message does not close ${phrase}`,()=>expect(isNothingElseOrderIntent(phrase)).toBe(false));
for(const name of ['Noé García','Noelia Rojas','María de los Ángeles','Gracia Montoya'])it(`real name remains valid ${name}`,()=>expect(isUsableWhatsappCustomerName(name)).toBe(true));

for(const other of [false,true])for(const agent of [false,true])it(`fresh purchase then real name and address ${other} ${agent}`,async()=>{
 const h=setup(other,agent,'building_cart');const names=h.conv.sessionData.cart.map(p=>p.name);
 h.conv.sessionData.cart=[];h.conv.sessionData.address=undefined;h.conv.sessionData.addressConfirmed=false;h.conv.sessionData.deliveryFeeCalculated=undefined;
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:0.6,source:'mock',customer:{lat:4.63,lng:-74.15}})};
 await h.sendQueued(`un ${names[0]} y un ${names[1]}`);expect(h.conv.sessionData.cart).toHaveLength(2);
 await h.sendQueued('No así no más');expect(h.conv.customerName).toBeNull();expect(h.conv.state).toBe('awaiting_name');
 await h.sendQueued('Lucía Fernández');expect(h.conv.state).toBe('awaiting_address');
 await h.sendQueued('Calle 10 #20-30');expect(h.conv.sessionData.address).toMatch(/10.*20.*30/);
 await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.customerName).toBe('Lucía Fernández');expect(dto.items).toHaveLength(2);
});
