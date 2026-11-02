import {harness} from './whatsapp-accuracy.test-support';
function setup(other:boolean,agent:boolean,checkout:boolean){
 const name=other?'Bandeja Con Tofu Broaster':'Ejecutivo Con Pollo Broaster';
 const key=other?'Corte':'Presa',choice=other?'Filete':'Pechuga';
 const menu=[{id:97801,code:1,name,price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:key,options:[choice,'Cubos']},{attributeName:'Bebida',options:['Limonada','Cola']}]}];
 const h=harness(menu,agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'Aclaremos el pedido',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:348,dailyOrderNumber:348});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.conv.sessionData.cart=[{productId:97801,code:1,name,quantity:2,unitPrice:25000,attributes:[{attributeName:key,attributeValue:choice},{attributeName:'Bebida',attributeValue:'Limonada'}],note:'Salsa aparte'},
 {productId:97801,code:1,name,quantity:1,unitPrice:25000,attributes:[{attributeName:key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}],note:'Sin sal'}];
 h.conv.state=checkout?'awaiting_final_confirm':'building_cart';if(checkout)h.conv.sessionData.paymentMethod='contraentrega';
 return {h,choice};
}
for(const other of [false,true])for(const agent of [false,true])for(const checkout of [false,true])for(const action of ['remove','quantity','partial'])it(`edit interrupts note ${other} ${agent} ${checkout} ${action}`,async()=>{
 const {h,choice}=setup(other,agent,checkout),before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('El broaster sin arroz');
 const reply=await h.sendQueued(action==='remove'?`quita el de ${choice}`:action==='partial'?`quita un ${before[0].name} con ${choice}`:`deja 3 de ${choice}`);
 expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();expect(reply).toMatch(/nota.*pendiente|pendiente.*nota/i);
 const expected=action==='remove'?[before[1]]:[{...before[0],quantity:action==='partial'?1:3},before[1]];
 expect(h.conv.sessionData.cart).toEqual(expected);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual(expected);expect(h.conv.sessionData.cart.every(l=>!/sin arroz/i.test(l.note||''))).toBe(true);
 await h.sendQueued('no más');await h.sendQueued('contraentrega');const receipt=await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const items=h.service.ordersService.create.mock.calls[0][0].items;
 expect(items).toHaveLength(action==='remove'?1:action==='partial'?2:4);expect(items.every(i=>!/sin arroz/i.test(i.note||''))).toBe(true);
 expect(receipt).toContain(action==='remove'?'25.000':action==='partial'?'50.000':'100.000');
});
for(const agent of [false,true])for(const scenario of ['ambiguous','ordinal','unknown','question','conditional','same quantity','invalid quantity','payment','expired','changed'])it(`pending note edit guard ${agent} ${scenario}`,async()=>{
 const {h}=setup(false,agent,true);await h.sendQueued('El broaster sin arroz');
 if(scenario==='expired')h.conv.sessionData.pendingSubsetKitchenNote!.preparationScope!.createdAt-=11*60*1000;
 if(scenario==='changed')h.conv.sessionData.cart[0].quantity++;
 if(scenario==='payment')h.conv.sessionData.mpPreferenceId='synthetic-only';
 const before=structuredClone(h.conv.sessionData.cart);
 const commands:Record<string,string>={ambiguous:'quita el broaster',ordinal:'quita el primero',unknown:'quita la pizza',question:'¿quita el de pechuga?',conditional:'quita el de pechuga si puedes','same quantity':'deja 2 de pechuga','invalid quantity':'deja 0 de pechuga'};
 await h.sendQueued(commands[scenario]||'quita el de pechuga');expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(['expired','changed'].includes(scenario))expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeUndefined();else expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeDefined();
});
