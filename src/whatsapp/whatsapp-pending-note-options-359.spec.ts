import {harness} from './whatsapp-accuracy.test-support';
function setup(other:boolean,agent:boolean,checkout:boolean,quantity=2){
 const name=other?'Bandeja Con Tofu Broaster':'Ejecutivo Con Pollo Broaster';
 const target=name.replace('Broaster','Frito');
 const key=other?'Corte':'Presa',choice=other?'Filete':'Pechuga';
 const attributes=[{attributeName:key,options:[choice,'Cubos']},{attributeName:'Bebida',options:['Limonada','Cola']}];
 const menu=[{id:97801,code:1,name,price:25000,availableNow:true,hasAttributes:true,attributes},
 {id:97802,code:2,name:target,price:24000,availableNow:true,hasAttributes:true,attributes:structuredClone(attributes)}];
 const h=harness(menu,agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:359,dailyOrderNumber:359});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.conv.sessionData.cart=[{productId:97801,code:1,name,quantity,unitPrice:25000,attributes:[{attributeName:key,attributeValue:choice},{attributeName:'Bebida',attributeValue:'Limonada'}],note:'Salsa aparte'},
 {productId:97801,code:1,name,quantity:1,unitPrice:25000,attributes:[{attributeName:key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}],note:'Sin sal'}];
 h.conv.state=checkout?'awaiting_final_confirm':'building_cart';if(checkout)h.conv.sessionData.paymentMethod='contraentrega';
 return {h,menu,choice,target};
}
async function begin(other:boolean,agent:boolean,checkout:boolean,two=false){
 const {h,menu,choice,target}=setup(other,agent,checkout);
 menu[1].attributes.push({attributeName:'Salsa',options:['Roja','Verde']});
 if(two)menu[1].attributes.push({attributeName:'Empaque',options:['Caja','Bolsa']});
 const before=structuredClone(h.conv.sessionData.cart),state=h.conv.state;
 await h.sendQueued('El broaster sin arroz');
 const reply=await h.sendQueued(`cambia el de ${choice} por ${target}`);
 expect(reply).toMatch(/nota.*sin aplicar|sin aplicar.*nota/i);expect(reply).toMatch(/original.*conserv|conserv.*original/i);expect(reply).toMatch(/Salsa/);
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
 expect(h.conv.state).toBe('awaiting_attribute');expect(h.conv.sessionData.pendingAttribute?.replacement?.originalLine).toEqual(before[0]);
 expect(h.conv.sessionData.pendingAttribute?.quantity).toBe(2);
 return {h,before,state};
}
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true])for(const two of [false,true])for(const numeric of [false,true])it(`choose new replacement options ${other} ${agent} ${checkout} ${two} ${numeric}`,async()=>{
 const {h,before,state}=await begin(other,agent,checkout,two);
 await h.sendQueued('99');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute).toBeDefined();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute).toBeDefined();
 await h.sendQueued(numeric?'1':'Roja');
 if(two){expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute).toBeDefined();await h.sendQueued(numeric?'1':'Caja');}
 expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();
 expect(h.conv.state).toBe(state);
 expect(h.conv.sessionData.cart).toContainEqual(before[1]);
 expect(h.conv.sessionData.cart.find(l=>l.productId===97802)).toMatchObject({quantity:2,unitPrice:24000,note:'Salsa aparte',attributes:expect.arrayContaining([...before[0].attributes!,{attributeName:'Salsa',attributeValue:'Roja'},...(two?[{attributeName:'Empaque',attributeValue:'Caja'}]:[])])});
 await h.sendQueued('no más');await h.sendQueued('contraentrega');const receipt=await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(3);expect(dto.items.every(i=>!/sin arroz/i.test(i.note||''))).toBe(true);expect(receipt).toContain('73.000');
});
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true])it(`cancel keeps original ${other} ${agent} ${checkout}`,async()=>{
 const {h,before,state}=await begin(other,agent,checkout,true);await h.sendQueued('Roja');await h.sendQueued('cancela ese cambio');
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const other of [false,true])for(const agent of [false,true])it(`changed original cannot be overwritten ${other} ${agent}`,async()=>{
 const {h}=await begin(other,agent,true);h.conv.sessionData.cart[0].quantity=3;const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('Roja');expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.conv.sessionData.cart.some(l=>l.productId===97802)).toBe(false);
});
