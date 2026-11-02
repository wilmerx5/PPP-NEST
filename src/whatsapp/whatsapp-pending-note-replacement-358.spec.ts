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
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:358,dailyOrderNumber:358});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.conv.sessionData.cart=[{productId:97801,code:1,name,quantity,unitPrice:25000,attributes:[{attributeName:key,attributeValue:choice},{attributeName:'Bebida',attributeValue:'Limonada'}],note:'Salsa aparte'},
 {productId:97801,code:1,name,quantity:1,unitPrice:25000,attributes:[{attributeName:key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}],note:'Sin sal'}];
 h.conv.state=checkout?'awaiting_final_confirm':'building_cart';if(checkout)h.conv.sessionData.paymentMethod='contraentrega';
 return {h,menu,choice,target};
}
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true])for(const action of ['replace','style','partial','contrast'])it(`replacement interrupts note ${other} ${agent} ${checkout} ${action}`,async()=>{
 const {h,choice,target}=setup(other,agent,checkout,['style','contrast'].includes(action)?1:2),before=structuredClone(h.conv.sessionData.cart),state=h.conv.state;
 await h.sendQueued('El broaster sin arroz');expect(h.conv.sessionData.pendingSubsetKitchenNote?.preparationScope).toBeDefined();
 const text=action==='replace'?`cambia el de ${choice} por ${target}`:action==='partial'?`cambia uno de los de ${choice} a frito`:action==='contrast'?`el que tiene ${choice} que ya no sea broaster sino frito`:`cambia el de ${choice} a frito`;
 const reply=await h.sendQueued(text);
 expect(reply).toMatch(/Dejé sin aplicar/);expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(reply).toMatch(/nota.*pendiente|pendiente.*nota/i);
 expect(h.conv.state).toBe(state);
 const cart=h.conv.sessionData.cart;
 expect(cart.find(l=>l.productId===97802)).toMatchObject({quantity:action==='replace'?2:1,unitPrice:24000,attributes:before[0].attributes,note:'Salsa aparte'});
 expect(cart).toContainEqual(before[1]);
 expect(cart.reduce((n,l)=>n+l.quantity,0)).toBe(before.reduce((n,l)=>n+l.quantity,0));
 expect(cart.every(l=>!/sin arroz/i.test(l.note||''))).toBe(true);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const after=structuredClone(cart);await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual(after);
 await h.sendQueued('no más');await h.sendQueued('contraentrega');const receipt=await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const items=h.service.ordersService.create.mock.calls[0][0].items;
 expect(items).toHaveLength(['style','contrast'].includes(action)?2:3);expect(items.every(i=>!/sin arroz/i.test(i.note||''))).toBe(true);
 expect(receipt).toContain(action==='replace'?'73.000':action==='partial'?'74.000':'49.000');
});
for(const agent of [false,true])for(const scenario of ['ambiguous','ordinal','unknown','unavailable','missing option','same product','question','conditional','payment','expired','changed','extra target note','ambiguous target','incompatible option','other selection'])it(`replacement note guard ${agent} ${scenario}`,async()=>{
 const {h,menu,target,choice}=setup(false,agent,true);await h.sendQueued('El broaster sin arroz');
 if(scenario==='expired')h.conv.sessionData.pendingSubsetKitchenNote!.preparationScope!.createdAt-=11*60*1000;
 if(scenario==='changed')h.conv.sessionData.cart[0].quantity++;
 if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic';
 if(scenario==='unavailable')menu[1].availableNow=false;
 if(scenario==='ambiguous target')menu.push({...structuredClone(menu[1]),id:97803});
 if(scenario==='incompatible option')menu[1].attributes[0].options=['Muslo','Ala'];
 if(scenario==='other selection')h.conv.sessionData.pendingMatch={query:'otro plato',candidates:[menu[1]],quantity:1,intent:'order'};
 if(scenario==='missing option')menu[1].attributes.push({attributeName:'Salsa',options:['Roja','Verde']});
 const commands:Record<string,string>={'extra target note':`cambia el de ${choice} por ${target} con bebida desconocida`,ambiguous:`cambia el broaster por ${target}`,ordinal:`cambia el primero por ${target}`,unknown:`cambia el de ${choice} por pizza`,question:`¿cambia el de ${choice} por ${target}?`,conditional:`cambia el de ${choice} por ${target} si puedes`,'same product':`cambia el de ${choice} por ${menu[0].name}`};
 const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued(commands[scenario]||`cambia el de ${choice} por ${target}`);
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(['expired','changed'].includes(scenario))expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();else expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
});
