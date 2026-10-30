import {harness} from './whatsapp-accuracy.test-support';
const catalogs=[['Ejecutivo Con Pollo Frito','Pechuga','Jugo Natural'],['Bandeja Con Tofu','Filete','Batido Natural'],['Plato Con Pescado','Lomo','Te Frio']];
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

function setup(names:string[],agent:boolean,ambiguous:boolean,shared:boolean,merge:boolean){
 const base=baseSetup(names,agent,4,false);const {h,menu}=base;
 menu[1].hasAttributes=true;menu[1].attributes=[...(shared?[{attributeName:'Presentacion',options:['Vaso','Botella']}]:[]),{attributeName:'Sabor',options:['Mango','Fresa']}];
 if(!ambiguous)h.conv.sessionData.cart[1].attributes![0].attributeValue='Cubos';
 const common=shared?[{attributeName:'Presentacion',attributeValue:'Vaso'}]:[];
 if(merge)h.conv.sessionData.cart.push({productId:97402,code:97402,name:names[2],quantity:1,unitPrice:7000,attributes:[...common,{attributeName:'Sabor',attributeValue:'Mango'}]});
 return {...base,cart:structuredClone(h.conv.sessionData.cart),common};
}
const phrases=['dos de mango y uno de fresa','2 mango y 1 fresa','dos con mango, uno con fresa','2 de mango; 1 de fresa','uno de fresa y dos de mango','dos de mango y uno de fresa, porfa'];
for(const names of catalogs)for(const agent of [false,true])for(const ambiguous of [false,true])for(const shared of [false,true])for(const merge of [false,true])for(const phrase of phrases)
it(`mixed distribution ${names[0]} ${agent} ${ambiguous} ${shared} ${merge} ${phrase}`,async()=>{
 const {h,cart,request,common}=setup(names,agent,ambiguous,shared,merge);
 await h.sendQueued(request);if(ambiguous)await h.sendQueued('el segundo');if(shared)await h.sendQueued('Vaso');
 expect(h.conv.sessionData.cart).toEqual(cart);expect(h.replies.at(-1)).toContain('Sabor');
 await h.sendQueued(phrase);
 expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const expectedSource=cart.slice(0,2).map((line,i)=>i===(ambiguous?1:0)?{...line,quantity:2}:line);
 expect(h.conv.sessionData.cart.slice(0,2)).toEqual(expectedSource);
 const drinks=h.conv.sessionData.cart.filter(line=>line.productId===97402).sort((a,b)=>a.attributes!.at(-1)!.attributeValue.localeCompare(b.attributes!.at(-1)!.attributeValue));
 expect(drinks).toEqual(['Fresa','Mango'].map((value,i)=>({productId:97402,code:97402,name:names[2],quantity:i?2+(merge?1:0):1,unitPrice:7000,attributes:[...common,{attributeName:'Sabor',attributeValue:value}]})));
 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');await h.sendQueued(shared?'transferencia':'efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
 const items=h.service.ordersService.create.mock.calls[0][0].items;
 expect(items).toHaveLength(9+(merge?1:0));
 for(const value of ['Fresa','Mango']){const selected=items.filter(item=>item.productId===97402 && item.attributes.some(a=>a.attributeValue===value));expect(selected).toHaveLength(value==='Fresa'?1:2+(merge?1:0));for(const item of selected){expect(item.note||'').toBe('');expect(item.attributes).toEqual([...common,{attributeName:'Sabor',attributeValue:value}]);}}
 expect(receipt).toContain((144000+(3+(merge?1:0))*7000).toLocaleString('es-CO'));
 for(const line of expectedSource)expect(receipt).toContain(line.note!);
});
for(const agent of [false,true])for(const phrase of ['uno de mango y uno de fresa','tres de mango y uno de fresa','dos de mango y uno de mora','-1 de mango y cuatro de fresa','1.5 mango y 1.5 fresa','dos de mango y uno de fresa si hay','¿dos de mango y uno de fresa?','dos de mango y el resto de fresa','dos de mango y uno de fresa y agrega sopa','0 mango y tres de fresa'])
it(`invalid mixed distribution recovers ${agent} ${phrase}`,async()=>{
 const {h,cart,request}=setup(catalogs[0],agent,false,false,false);await h.sendQueued(request);await h.sendQueued(phrase);
 expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toBeTruthy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('dos de mango y uno de fresa');expect(h.conv.sessionData.cart.map(l=>l.quantity)).toEqual([2,4,2,1]);expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
});
for(const agent of [false,true])for(const fault of ['late line limit','amount limit','stock','price','options','stale cart','payment','expiry','cancel','reset'])
it(`distributed mixed guard ${agent} ${fault}`,async()=>{
 const {h,menu,request}=setup(catalogs[0],agent,false,false,false);await h.sendQueued(request);
 if(fault==='late line limit')Object.assign(h.cfg,{maxCartLines:3});
 if(fault==='amount limit')Object.assign(h.cfg,{maxOrderAmount:160000});
 if(fault==='stock')menu[1].availableNow=false;if(fault==='price')menu[1].price=8000;
 if(fault==='options')menu[1].attributes[0].options=['Mango','Mora'];
 if(fault==='stale cart')h.conv.sessionData.cart[0].note='Otra nota';if(fault==='payment')h.conv.sessionData.mpPreferenceId='synthetic';
 if(fault==='expiry')h.conv.sessionData.pendingCartRemoval!.mixedAddition!.createdAt=Date.now()-31*60*1000;
 const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued(fault==='cancel'?'olvida ese cambio':fault==='reset'?'reiniciar':'dos de mango y uno de fresa');
 expect(h.conv.sessionData.cart).toEqual(fault==='reset'?[]:before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
