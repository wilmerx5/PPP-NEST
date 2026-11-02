import {harness} from './whatsapp-accuracy.test-support';
function setup(other:boolean,agent:boolean){
 const name=other?'Bowl Vegetal':'Arroz Con Pollo';
 const h=harness([{id:98401,code:1,name,price:25000,availableNow:true,hasAttributes:false,attributes:[]}],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'Aclaremos el pedido',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:354,dailyOrderNumber:354});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
 h.service.deliveryRouting={quoteDeliveryFee:jest.fn(async({customerAddress}:{customerAddress:string})=>customerAddress.includes('20-30')
 ?{ok:true,fee:2000,distanceKm:1,source:'mock',customer:{lat:4.64,lng:-74.14}}
 :{ok:false,reason:'address_ambiguous',message:'Comparte calle y número.'})};
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,cart:[{productId:98401,code:1,name,quantity:1,unitPrice:25000,attributes:[]}]});
 h.conv.state='awaiting_address';return h;
}
const contacts=['3000000002 celular','celular 3000000002','300 000 0002 teléfono','+57 300 000 0002 whatsapp'];
for(const other of [false,true])for(const agent of [false,true])for(const resolved of [false,true])for(const contact of contacts)it(`address and phone ${other} ${agent} ${resolved} ${contact}`,async()=>{
 const h=setup(other,agent),before=structuredClone(h.conv.sessionData.cart);
 const place=other?'Conjunto Los Cedros':'Conjunto Camino del Parque';
 await h.sendQueued(`${resolved?'Calle 10 #20-30 ':''}${place} torre 5 apto 501 ${contact}`);
 expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'').slice(-10)).toBe('3000000002');
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(!resolved){expect(h.replies.at(-1)).toMatch(/calle|n[uú]mero|ubicaci[oó]n/i);await h.sendQueued('Calle 10 #20-30');}
 const address=h.conv.sessionData.address!;
 expect(address).toContain(place);expect(address).toMatch(/torre 5/i);expect(address).toMatch(/apto 501/i);expect(address).not.toMatch(/celular|tel[eé]fono|whatsapp|300.?000.?0002|\+57/i);
 await h.sendQueued('contraentrega');const receipt=await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];
 expect(dto.phone.replace(/\D/g,'').slice(-10)).toBe('3000000002');expect(dto.address).toContain(place);expect(dto.address).toMatch(/torre 5/i);expect(dto.address).toMatch(/apto 501/i);expect(dto.address).not.toMatch(/celular|tel[eé]fono|whatsapp/i);expect(dto.items).toHaveLength(1);expect(receipt).toContain('27.000');
});
for(const agent of [false,true])for(const label of ['celular','teléfono'])it(`phone label before apartment ${agent} ${label}`,async()=>{
 const h=setup(false,agent);await h.sendQueued(`Calle 10 #20-30 Conjunto Los Cedros 3000000002 ${label} torre 5 apto 501`);
 expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'').slice(-10)).toBe('3000000002');
 expect(h.conv.sessionData.address).toMatch(/torre 5.*apto 501/i);expect(h.conv.sessionData.address).not.toContain(label);
});
for(const text of ['Calle 10 #20-30 local Celular Express','Calle 10 #20-30 frente a celulares','Calle 10 #20-30 torre 5 apto 501','Calle 10 #20-30 número 501'])it(`preserve unrelated address words ${text}`,()=>{
 const h=setup(false,false),parsed=h.service.parseCompoundOrderMessage(text);
 expect(parsed.phone).toBeNull();expect(parsed.address).toContain(text);
});

for(const landmark of ['Celular Express','teléfono público'])it(`phone does not erase landmark ${landmark}`,()=>{
 const h=setup(false,false),parsed=h.service.parseCompoundOrderMessage(`Calle 10 #20-30 local 3000000002 ${landmark}`);
 expect(parsed.phone.replace(/\D/g,'').slice(-10)).toBe('3000000002');expect(parsed.address).toContain(landmark);
});
for(const invalid of ['123 celular','300000 celular'])it(`invalid contact remains visible ${invalid}`,()=>{
 const h=setup(false,false),parsed=h.service.parseCompoundOrderMessage(`Calle 10 #20-30 ${invalid}`);
 expect(parsed.phone).toBeNull();expect(parsed.address).toContain(invalid);
});
