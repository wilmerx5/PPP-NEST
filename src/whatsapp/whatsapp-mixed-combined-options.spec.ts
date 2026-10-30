import {harness} from './whatsapp-accuracy.test-support';
const catalogs=[['Ejecutivo Con Pollo Frito','Pechuga','Agua Mineral'],['Bandeja Con Tofu','Filete','Papas Rusticas'],['Plato Con Pescado','Lomo','Te Frio']];
function baseSetup(names:string[],agent:boolean,quantity:number,merge:boolean){
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

function setup(names:string[],agent:boolean,ambiguous:boolean,multiple:boolean){
 const hbase=baseSetup(names,agent,4,false);const {h,menu}=hbase;
 menu[1].hasAttributes=true;menu[1].attributes=[{attributeName:'Sabor',options:['Mango','Fresa']}];
 if(multiple)menu[1].attributes.push({attributeName:'Presentacion',options:['Vaso','Botella']});
 if(!ambiguous)h.conv.sessionData.cart[1].attributes![0].attributeValue='Cubos';
 return {...hbase,cart:structuredClone(h.conv.sessionData.cart)};
}
const phrases=['fresa y vaso','vaso y fresa','fresa, vaso','Sabor: Fresa; Presentacion: Vaso','con fresa y en vaso','FRESA Y VASO, PORFA'];
for(const names of catalogs)for(const agent of [false,true])for(const ambiguous of [false,true])for(const merge of [false,true])for(const quantity of [1,3])for(const phrase of phrases)
it(`combined options ${names[0]} ${agent} ${ambiguous} ${merge} ${quantity} ${phrase}`,async()=>{
 const {h,request}=setup(names,agent,ambiguous,true);
 const attrs=[{attributeName:'Sabor',attributeValue:'Fresa'},{attributeName:'Presentacion',attributeValue:'Vaso'}];
 if(merge)h.conv.sessionData.cart.push({productId:97402,code:97402,name:names[2],quantity:1,unitPrice:7000,attributes:attrs});
 const cart=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued(request.replace('agrega tres',`agrega ${quantity}`));if(ambiguous)await h.sendQueued('el segundo');
 expect(h.conv.sessionData.cart).toEqual(cart);
 const reply=await h.sendQueued(phrase);
 expect(reply).toContain('Fresa');expect(reply).toContain('Vaso');expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
 const expected=cart.map((line,i)=>i===(ambiguous?1:0)?{...line,quantity:2}:line.productId===97402?{...line,quantity:quantity+1}:line);
 if(!merge)expected.push({productId:97402,code:97402,name:names[2],quantity,unitPrice:7000,attributes:attrs});
 expect(h.conv.sessionData.cart).toEqual(expected);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');
 await h.sendQueued(merge?'transferencia':'efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');
 const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const items=h.service.ordersService.create.mock.calls[0][0].items;
 expect(items).toHaveLength(6+quantity+(merge?1:0));
 expect(items.filter(i=>i.productId===97402)).toEqual(Array.from({length:quantity+(merge?1:0)},()=>expect.objectContaining({productId:97402,attributes:attrs})));
 expect(receipt).toContain((144000+(quantity+(merge?1:0))*7000).toLocaleString('es-CO'));
});
for(const agent of [false,true])for(const phrase of ['fresa y botella y vaso','fresa y mora','fresa y vaso si hay','¿fresa y vaso?','fresa y vaso y agrega sopa','1 y 2','Sabor: Vaso y Presentacion: Fresa','fresa y fresa'])
it(`combined options reject and recover ${agent} ${phrase}`,async()=>{
 const {h,request,cart}=setup(catalogs[0],agent,false,true);await h.sendQueued(request);const pending=structuredClone(h.conv.sessionData.pendingCartRemoval);
 await h.sendQueued(phrase);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toEqual(pending);
 expect(h.replies.at(-1)).toContain('Sabor');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('fresa y vaso');expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();expect(h.conv.sessionData.cart.map(l=>l.quantity)).toEqual([2,4,3]);
});
for(const agent of [false,true])for(const fault of ['stock','price','options','cart','payment','limit','expiry','cancel','reset','ambiguous option'])
it(`combined option guard ${agent} ${fault}`,async()=>{
 const {h,menu,request}=setup(catalogs[0],agent,false,true);
 if(fault==='ambiguous option')menu[1].attributes[1].options.push('Fresa');
 await h.sendQueued(request);
 if(fault==='stock')menu[1].availableNow=false;if(fault==='price')menu[1].price=8000;
 if(fault==='options')menu[1].attributes[0].options=['Mora'];if(fault==='cart')h.conv.sessionData.cart[0].note='Otra nota';
 if(fault==='payment')h.conv.sessionData.mpPreferenceId='synthetic';if(fault==='limit')Object.assign(h.cfg,{maxUnitsPerItem:1});
 if(fault==='expiry')h.conv.sessionData.pendingCartRemoval!.mixedAddition!.createdAt=Date.now()-31*60*1000;
 const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued(fault==='cancel'?'olvida ese cambio':fault==='reset'?'reiniciar':'fresa y vaso');
 expect(h.conv.sessionData.cart).toEqual(fault==='reset'?[]:before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])
it(`combined remaining options after a shared selection ${agent}`,async()=>{
 const {h,menu,request,cart}=setup(catalogs[0],agent,false,true);
 menu[1].attributes.unshift({attributeName:'Temperatura',options:['Frio','Natural']});
 await h.sendQueued(request);await h.sendQueued('Frio');expect(h.conv.sessionData.cart).toEqual(cart);
 await h.sendQueued('vaso y fresa');expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
 expect(h.conv.sessionData.cart[2].attributes).toEqual([{attributeName:'Temperatura',attributeValue:'Frio'},{attributeName:'Sabor',attributeValue:'Fresa'},{attributeName:'Presentacion',attributeValue:'Vaso'}]);
 expect(h.conv.sessionData.cart.map(l=>l.quantity)).toEqual([2,4,3]);expect(h.replies.at(-1)).toContain('Frio');
});
