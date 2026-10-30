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
 if(merge)h.conv.sessionData.cart.push({productId:97402,code:97402,name:names[2],quantity:1,unitPrice:7000,note:'sin azucar',attributes:[...common,{attributeName:'Sabor',attributeValue:'Mango'},{attributeName:'Presentacion',attributeValue:'Botella'}]});
 return {...base,cart:structuredClone(h.conv.sessionData.cart),common};
}
const phrases=['uno de fresa en vaso sin hielo y dos de mango en botella sin azucar','2 mango en botella sin azucar, 1 fresa en vaso sin hielo','dos en botella de mango sin azucar; uno en vaso de fresa sin hielo','uno con fresa en vaso sin hielo y dos con mango en botella sin azucar','uno de mango en botella sin azucar y uno de fresa en vaso sin hielo y uno de mango en botella sin azucar','UNO DE FRESA EN VASO SIN HIELO Y EL RESTO DE MANGO EN BOTELLA SIN AZÚCAR, PORFA'];
for(const names of catalogs)for(const agent of [false,true])for(const ambiguous of [false,true])for(const shared of [false,true])for(const merge of [false,true])for(const phrase of phrases)
it(`inline group notes ${names[0]} ${agent} ${ambiguous} ${shared} ${merge} ${phrase}`,async()=>{
 const {h,cart,request,common}=setup(names,agent,ambiguous,shared,merge);
 await h.sendQueued(request);if(ambiguous)await h.sendQueued('el segundo');if(shared)await h.sendQueued('Frio');
 expect(h.conv.sessionData.cart).toEqual(cart);
 const reply=await h.sendQueued(phrase);expect(reply).toContain('sin hielo');expect(reply).toContain('sin azucar');expect(reply).toContain('Fresa');expect(reply).toContain('Botella');expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
 const source=cart.slice(0,2).map((line,i)=>i===(ambiguous?1:0)?{...line,quantity:2}:line);
 expect(h.conv.sessionData.cart.slice(0,2)).toEqual(source);
 const drinks=h.conv.sessionData.cart.filter(l=>l.productId===97402);
 for(const [flavor,presentation,count] of [['Fresa','Vaso',1],['Mango','Botella',2+(merge?1:0)]] as const){
  expect(drinks.filter(l=>l.attributes?.some(a=>a.attributeValue===flavor))).toEqual([{productId:97402,code:97402,name:names[2],quantity:count,unitPrice:7000,note:flavor==='Fresa'?'sin hielo':'sin azucar',attributes:[...common,{attributeName:'Sabor',attributeValue:flavor},{attributeName:'Presentacion',attributeValue:presentation}]}]);
 }
 expect(drinks).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');await h.sendQueued(shared?'transferencia':'efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');
 const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
 const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(9+(merge?1:0));
 for(const line of [...source,...drinks]){const matches=items.filter(i=>i.productId===line.productId && JSON.stringify(i.attributes)===JSON.stringify(line.attributes));expect(matches).toHaveLength(line.quantity);for(const item of matches)expect(item.note||'').toBe(line.note||'');}
 expect(receipt).toContain((165000+(merge?7000:0)).toLocaleString('es-CO'));
});
for(const agent of [false,true])for(const phrase of ['uno de fresa en vaso sin hielo y uno de mango en botella sin azucar','uno de fresa en vaso sin hielo y tres de mango en botella sin azucar','uno de fresa en vaso sin hielo y dos de mora en botella sin azucar','uno de fresa sin hielo y dos de mango en botella sin azucar','uno de fresa en vaso sin hielo y dos de mango en botella sin azucar si hay','¿uno de fresa en vaso sin hielo y dos de mango en botella sin azucar?','uno de fresa en vaso sin hielo y dos de mango en botella sin','uno de fresa en vaso sin hielo y dos de mango en botella sin azucar y agrega sopa','uno de fresa en vaso sin hielo con hielo y dos de mango en botella sin azucar','uno de fresa en vaso sin hielo y dos de mango en botella sin azucar pero poco'])
it(`inline note recovery ${agent} ${phrase}`,async()=>{
 const {h,cart,request}=setup(catalogs[0],agent,false,false,false);await h.sendQueued(request);const pending=structuredClone(h.conv.sessionData.pendingCartRemoval);
 await h.sendQueued(phrase);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toEqual(pending);expect(h.replies.at(-1)).toContain('Sabor');
 await h.sendQueued(phrases[0]);expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();expect(h.conv.sessionData.cart.map(l=>l.quantity)).toEqual([2,4,1,2]);
});
for(const agent of [false,true])for(const fault of ['late limit','amount','stock','price','options','cart','payment','expiry','cancel','reset','ambiguous'])
it(`inline note guard ${agent} ${fault}`,async()=>{
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
for(const agent of [false,true])for(const mode of ['distinct notes','same note','catalog option','one note'])
it(`inline notes preserve grouping ${agent} ${mode}`,async()=>{
 const {h,menu,request,cart}=setup(catalogs[0],agent,false,false,false);
 if(mode==='catalog option')menu[1].attributes[1].options.push('sin hielo');
 await h.sendQueued(request);
 const suffix=mode==='same note'?' sin hielo':mode==='one note'?'':' sin azucar';
 await h.sendQueued('uno de fresa en vaso sin hielo y dos de fresa en vaso'+suffix);
 if(mode==='catalog option'){expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toBeTruthy();return;}
 const drinks=h.conv.sessionData.cart.filter(l=>l.productId===97402);
 expect(drinks.map(l=>({quantity:l.quantity,note:l.note||''}))).toEqual(mode==='same note'?[{quantity:3,note:'sin hielo'}]:[{quantity:1,note:'sin hielo'},{quantity:2,note:mode==='one note'?'':'sin azucar'}]);
 for(const line of drinks)expect(line.attributes).toEqual([{attributeName:'Sabor',attributeValue:'Fresa'},{attributeName:'Presentacion',attributeValue:'Vaso'}]);
 expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
