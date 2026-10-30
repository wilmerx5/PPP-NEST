import {harness} from './whatsapp-accuracy.test-support';
const catalogs=[['Ejecutivo Con Pollo Frito','Pechuga','Agua Mineral'],['Bandeja Con Tofu','Filete','Papas Rusticas'],['Plato Con Pescado','Lomo','Te Frio']];
function setup(names:string[],agent:boolean,quantity:number,merge:boolean){
 const [name,choice,addition]=names;
 const menu=[{id:97401,code:97401,name,price:24000,hasAttributes:true,availableNow:true,attributes:[{attributeName:'Corte',options:[choice]},{attributeName:'Bebida',options:['Limonada','Cola']}]},
 {id:97402,code:97402,name:addition,price:7000,hasAttributes:false,availableNow:true,attributes:[]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:299,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const cart=[0,1].map(i=>({productId:97401,code:97401,name,quantity,unitPrice:24000,note:i?'Salsa aparte':'Sin sal',attributes:[{attributeName:'Corte',attributeValue:choice},{attributeName:'Bebida',attributeValue:i?'Cola':'Limonada'}]}));
 if(merge)cart.push({productId:97402,code:97402,name:addition,quantity:1,unitPrice:7000,attributes:[]} as any);
 Object.assign(h.conv.sessionData,{cart,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 return {h,menu,cart:structuredClone(cart),request:`quita dos de los de ${choice} y agrega tres ${addition}`};
}
for(const names of catalogs)for(const agent of [false,true])for(const quantity of [2,4])for(const merge of [false,true])
for(const scenario of ['number','ordinal','note','total','invalid','cancel'])
it(`mixed clarification ${names[0]} ${agent} ${quantity} ${merge} ${scenario}`,async()=>{
 const {h,cart,request}=setup(names,agent,quantity,merge);
 const prompt=await h.sendQueued(request);
 expect(h.conv.sessionData.cart).toEqual(cart);expect(prompt).toMatch(/cu[aá]l.*l[ií]nea/i);expect(prompt).toContain(names[2]);
 expect(h.conv.sessionData.pendingCartRemoval).toBeTruthy();
 if(scenario==='cancel'){
  await h.sendQueued('olvida ese cambio');expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
 }
 if(scenario==='total'||scenario==='invalid'){
  const reply=await h.sendQueued(scenario==='total'?'cuánto va todo':'9');
  expect(reply).toMatch(/l[ií]nea/i);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toBeTruthy();
 }
 const reply=await h.sendQueued(scenario==='note'?'el de salsa aparte':scenario==='ordinal'?'el segundo':'2');
 const expected=[cart[0],...(quantity>2?[{...cart[1],quantity:quantity-2}]:[]),{productId:97402,code:97402,name:names[2],quantity:3+(merge?1:0),unitPrice:7000,attributes:[]}];
 expect(h.conv.sessionData.cart).toEqual(expected);expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();expect(reply).toMatch(/quité.*agregué/);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');
 await h.sendQueued(merge?'transferencia':'efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
 const items=h.service.ordersService.create.mock.calls[0][0].items;
 expect(items).toEqual(expected.flatMap(line=>Array.from({length:line.quantity},()=>expect.objectContaining({productId:line.productId,attributes:line.attributes,...('note' in line?{note:line.note}:{})}))));
 expect(receipt).toContain(((quantity*2-2)*24000+(3+(merge?1:0))*7000).toLocaleString('es-CO'));
});
for(const agent of [false,true])for(const fault of ['cart changed','unavailable','new attributes','payment','limit','insufficient','price changed','expired'])
it(`mixed pending guard ${agent} ${fault}`,async()=>{
 const {h,cart,menu,request}=setup(catalogs[0],agent,4,false);await h.sendQueued(request);
 expect(h.conv.sessionData.pendingCartRemoval).toBeTruthy();
 if(fault==='cart changed')h.conv.sessionData.cart[0].note='Otra nota';
 if(fault==='unavailable')menu[1].availableNow=false;
 if(fault==='new attributes'){menu[1].hasAttributes=true;menu[1].attributes=[{attributeName:'Sabor',options:['Mango']}];}
 if(fault==='payment')h.conv.sessionData.mpPreferenceId='synthetic';
 if(fault==='limit')Object.assign(h.cfg,{maxUnitsPerItem:1});
 if(fault==='insufficient'){h.conv.sessionData.cart[1].quantity=1;h.conv.sessionData.pendingCartRemoval!.cartSignature=JSON.stringify(h.conv.sessionData.cart);}
 if(fault==='price changed')menu[1].price=9000;
 if(fault==='expired')h.conv.sessionData.pendingCartRemoval!.mixedAddition!.createdAt=Date.now()-31*60*1000;
 const before=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('el segundo');
 expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/igual|cambi[oó]|venci[oó]|pendiente/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for(const agent of [false,true])for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])
for(const action of ['confirmar','no más','¿el segundo?','reiniciar','el segundo','déjalo como estaba','no hagas ese cambio'])
it(`mixed pending continuity ${agent} ${state} ${action}`,async()=>{
 const {h,cart,request}=setup(catalogs[0],agent,4,false);h.conv.state=state;
 await h.sendQueued(request);expect(h.conv.sessionData.pendingCartRemoval).toBeTruthy();
 await h.sendQueued(action);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(action==='reiniciar'){expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();expect(h.conv.state).toBe('building_cart');}
 else if(['déjalo como estaba','no hagas ese cambio'].includes(action)){expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();}
 else if(action==='el segundo'){expect(h.conv.sessionData.cart.map(l=>l.quantity)).toEqual([4,2,3]);expect(h.conv.state).toBe(state);}
 else{expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toBeTruthy();expect(h.conv.state).toBe(state);}
});
