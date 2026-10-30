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
const interruptions=[['total','cuánto va todo'],['excess','cuatro de fresa en vaso y el resto de mango en botella'],['unknown','uno de fresa en vaso y el resto de mora en botella'],['duplicate','uno de fresa en vaso y el resto de mango en botella y el resto de fresa en vaso']];
for(const names of catalogs)for(const agent of [false,true])for(const ambiguous of [false,true])for(const shared of [false,true])for(const merge of [false,true])for(const multi of [false,true])for(const [kind,message] of interruptions)
it(`remainder interrupted ${names[0]} ${agent} ${ambiguous} ${shared} ${merge} ${multi} ${kind}`,async()=>{
 const {h,menu,cart,request,common}=setup(names,agent,ambiguous,shared,merge);
 if(!multi){menu[1].attributes.pop();const attrs=h.conv.sessionData.cart.find(l=>l.productId===97402)?.attributes;attrs?.pop();cart.find(l=>l.productId===97402)?.attributes?.pop();}

 await h.sendQueued(request);if(ambiguous)await h.sendQueued('el segundo');if(shared)await h.sendQueued('Frio');
 expect(h.conv.sessionData.cart).toEqual(cart);
 const pending=structuredClone(h.conv.sessionData.pendingCartRemoval);
 const interruption=await h.sendQueued(multi?message:message.replace(/ en vaso| en botella/g,''));
 expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toEqual(pending);
 expect(interruption).toContain('Sabor');if(kind==='total')expect(interruption).toContain((192000+(merge?7000:0)).toLocaleString('es-CO'));
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const phrase='uno de fresa en vaso y los demas de mango en botella';
 const reply=await h.sendQueued(multi?phrase:phrase.replace(/ en vaso| en botella/g,''));expect(reply).toContain('Fresa');expect(reply).toContain(multi?'Botella':'Mango');expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
 const source=cart.slice(0,2).map((line,i)=>i===(ambiguous?1:0)?{...line,quantity:2}:line);
 expect(h.conv.sessionData.cart.slice(0,2)).toEqual(source);
 const drinks=h.conv.sessionData.cart.filter(l=>l.productId===97402);
 for(const [flavor,presentation,count] of [['Fresa','Vaso',1],['Mango','Botella',2+(merge?1:0)]] as const){
  expect(drinks.filter(l=>l.attributes?.some(a=>a.attributeValue===flavor))).toEqual([{productId:97402,code:97402,name:names[2],quantity:count,unitPrice:7000,attributes:[...common,{attributeName:'Sabor',attributeValue:flavor},...(multi?[{attributeName:'Presentacion',attributeValue:presentation}]:[])]}]);
 }
 expect(drinks).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');await h.sendQueued(shared?'transferencia':'efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');
 const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
 const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(9+(merge?1:0));
 for(const line of [...source,...drinks]){const matches=items.filter(i=>i.productId===line.productId && JSON.stringify(i.attributes)===JSON.stringify(line.attributes));expect(matches).toHaveLength(line.quantity);for(const item of matches)expect(item.note||'').toBe(line.note||'');}
 expect(receipt).toContain((165000+(merge?7000:0)).toLocaleString('es-CO'));expect(receipt).toContain('Sin sal');expect(receipt).toContain('Salsa aparte');
});
