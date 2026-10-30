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
 menu[1].hasAttributes=true;menu[1].attributes=[...(shared?[{attributeName:'Temperatura',options:['Frio','Natural']}]:[]),{attributeName:'Sabor',options:['Mango','Fresa']},{attributeName:'Presentacion',options:['Vaso','Botella']}];
 if(!ambiguous)h.conv.sessionData.cart[1].attributes![0].attributeValue='Cubos';
 const common=shared?[{attributeName:'Temperatura',attributeValue:'Frio'}]:[];
 if(merge)h.conv.sessionData.cart.push({productId:97402,code:97402,name:names[2],quantity:1,unitPrice:7000,attributes:[...common,{attributeName:'Sabor',attributeValue:'Mango'},{attributeName:'Presentacion',attributeValue:'Botella'}]});
 return {...base,cart:structuredClone(h.conv.sessionData.cart),common};
}
const phrases=['uno de fresa en vaso y dos de mango en botella','2 mango en botella, 1 fresa en vaso','dos en botella de mango; uno en vaso de fresa','uno con fresa en vaso y dos con mango en botella','uno de mango en botella y uno de fresa en vaso y uno de mango en botella','UNO DE FRESA EN VASO Y DOS DE MANGO EN BOTELLA, PORFA'];
for(const names of catalogs)for(const agent of [false,true])for(const ambiguous of [false,true])for(const shared of [false,true])for(const merge of [false,true])for(const phrase of phrases)
it(`multi attribute distribution ${names[0]} ${agent} ${ambiguous} ${shared} ${merge} ${phrase}`,async()=>{
 const {h,cart,request,common}=setup(names,agent,ambiguous,shared,merge);
 await h.sendQueued(request);if(ambiguous)await h.sendQueued('el segundo');if(shared)await h.sendQueued('Frio');
 expect(h.conv.sessionData.cart).toEqual(cart);
 const reply=await h.sendQueued(phrase);expect(reply).toContain('Fresa');expect(reply).toContain('Botella');expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
 const source=cart.slice(0,2).map((line,i)=>i===(ambiguous?1:0)?{...line,quantity:2}:line);
 expect(h.conv.sessionData.cart.slice(0,2)).toEqual(source);
 const drinks=h.conv.sessionData.cart.filter(l=>l.productId===97402);
 for(const [flavor,presentation,count] of [['Fresa','Vaso',1],['Mango','Botella',2+(merge?1:0)]] as const){
  expect(drinks.filter(l=>l.attributes?.some(a=>a.attributeValue===flavor))).toEqual([{productId:97402,code:97402,name:names[2],quantity:count,unitPrice:7000,attributes:[...common,{attributeName:'Sabor',attributeValue:flavor},{attributeName:'Presentacion',attributeValue:presentation}]}]);
 }
 expect(drinks).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');await h.sendQueued(shared?'transferencia':'efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');
 const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
 const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(9+(merge?1:0));
 for(const line of [...source,...drinks]){const matches=items.filter(i=>i.productId===line.productId && JSON.stringify(i.attributes)===JSON.stringify(line.attributes));expect(matches).toHaveLength(line.quantity);for(const item of matches)expect(item.note||'').toBe(line.note||'');}
 expect(receipt).toContain((165000+(merge?7000:0)).toLocaleString('es-CO'));
});
for(const agent of [false,true])for(const phrase of ['uno de fresa en vaso y uno de mango en botella','uno de fresa en vaso y tres de mango en botella','uno de mora en vaso y dos de mango en botella','uno de fresa y dos de mango en botella','uno de fresa en vaso y dos de mango en botella si hay','¿uno de fresa en vaso y dos de mango en botella?','uno de fresa en vaso y el resto de mango','uno de fresa en vaso y dos de mango en botella y agrega sopa','0 de fresa en vaso y tres de mango en botella','1.5 fresa en vaso y 1.5 mango en botella'])
it(`invalid multi attribute recovery ${agent} ${phrase}`,async()=>{
 const {h,cart,request}=setup(catalogs[0],agent,false,false,false);await h.sendQueued(request);const pending=structuredClone(h.conv.sessionData.pendingCartRemoval);
 await h.sendQueued(phrase);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toEqual(pending);expect(h.replies.at(-1)).toContain('Sabor');
 await h.sendQueued(phrases[0]);expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();expect(h.conv.sessionData.cart.map(l=>l.quantity)).toEqual([2,4,1,2]);
});
for(const agent of [false,true])for(const fault of ['late limit','amount','stock','price','options','cart','payment','expiry','cancel','reset','ambiguous'])
it(`multi attribute guard ${agent} ${fault}`,async()=>{
 const {h,menu,request}=setup(catalogs[0],agent,false,false,false);
 if(fault==='ambiguous'){menu[1].attributes[0].options.push('Vaso');menu[1].attributes[1].options.push('Fresa');}
 await h.sendQueued(request);
 if(fault==='late limit')Object.assign(h.cfg,{maxCartLines:3});if(fault==='amount')Object.assign(h.cfg,{maxOrderAmount:160000});
 if(fault==='stock')menu[1].availableNow=false;if(fault==='price')menu[1].price=8000;if(fault==='options')menu[1].attributes[1].options=['Lata'];
 if(fault==='cart')h.conv.sessionData.cart[0].note='Otra nota';if(fault==='payment')h.conv.sessionData.mpPreferenceId='synthetic';
 if(fault==='expiry')h.conv.sessionData.pendingCartRemoval!.mixedAddition!.createdAt=Date.now()-31*60*1000;
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(fault==='cancel'?'olvida ese cambio':fault==='reset'?'reiniciar':phrases[0]);
 expect(h.conv.sessionData.cart).toEqual(fault==='reset'?[]:before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])for(const count of [2,3,4])
it(`catalog multiword options with ${count} attributes ${agent}`,async()=>{
 const {h,menu,request}=setup(catalogs[1],agent,false,false,false);
 menu[1].attributes=[{attributeName:'Sabor',options:['Mango dulce','Fresa natural']},{attributeName:'Presentacion',options:['Vaso grande','Botella pequena']},...(count>=3?[{attributeName:'Temperatura',options:['Frio','Natural']}]:[]),...(count===4?[{attributeName:'Endulzante',options:['Con azucar','Sin azucar']}]:[])];
 await h.sendQueued(request);
 const first=`uno de fresa natural en vaso grande${count>=3?' frio':''}${count===4?' sin azucar':''}`;
 const second=`dos de mango dulce en botella pequena${count>=3?' natural':''}${count===4?' con azucar':''}`;
 await h.sendQueued(first+' y '+second);
 expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();expect(h.conv.sessionData.cart.map(l=>l.quantity)).toEqual([2,4,1,2]);
 const drinks=h.conv.sessionData.cart.slice(2);for(const line of drinks)expect(line.attributes).toHaveLength(count);
 expect(drinks[0].attributes!.slice(0,2)).toEqual([{attributeName:'Sabor',attributeValue:'Fresa natural'},{attributeName:'Presentacion',attributeValue:'Vaso grande'}]);
 expect(drinks[1].attributes!.slice(0,2)).toEqual([{attributeName:'Sabor',attributeValue:'Mango dulce'},{attributeName:'Presentacion',attributeValue:'Botella pequena'}]);
 expect(h.replies.at(-1)).toContain('Fresa natural');expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
