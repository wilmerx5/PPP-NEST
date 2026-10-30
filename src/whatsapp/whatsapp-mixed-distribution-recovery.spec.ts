import {harness} from './whatsapp-accuracy.test-support';
const catalogs=[['Ejecutivo Con Pollo Frito','Pechuga','Jugo Natural'],['Bandeja Con Tofu','Filete','Batido Natural'],['Plato Con Pescado','Lomo','Te Frio']];
function baseSetup(names:string[],agent:boolean,quantity:number,merge:boolean){
 const [name,choice,addition]=names;
 const menu=[{id:97401,code:97401,name,price:24000,hasAttributes:true,availableNow:true,attributes:[{attributeName:'Corte',options:[choice]},{attributeName:'Bebida',options:['Limonada','Cola']}]},
 {id:97402,code:97402,name:addition,price:7000,hasAttributes:false,availableNow:true,attributes:[]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:299,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.conversationService.reopenForNewOrder=jest.fn().mockImplementation(async()=>{h.conv.state='building_cart';h.conv.sessionData={cart:[],orderType:'pickup'};});
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
const phrases=['uno de mango y uno de fresa y uno de mango','1 mango, 1 mango, 1 fresa','una con fresa; una con mango; una con mango','UNO DE MÁNGO Y UNO DE FRESA Y UNO DE MANGO, POR FAVOR'];
for(const names of catalogs)for(const agent of [false,true])for(const ambiguous of [false,true])for(const shared of [false,true])for(const merge of [false,true])for(const phrase of phrases)for(const interruption of ['total','invalid'])
it(`distribution recovery ${names[0]} ${agent} ${ambiguous} ${shared} ${merge} ${phrase} ${interruption}`,async()=>{
 const {h,cart,request,common}=setup(names,agent,ambiguous,shared,merge);
 await h.sendQueued(request);if(ambiguous)await h.sendQueued('el segundo');if(shared)await h.sendQueued('Vaso');
 expect(h.conv.sessionData.cart).toEqual(cart);expect(h.replies.at(-1)).toContain('Sabor');
 const pending=structuredClone(h.conv.sessionData.pendingCartRemoval);
 const intermediate=await h.sendQueued(interruption==='total'?'cuánto va todo':'dos de mango y dos de fresa');
 expect(h.conv.sessionData.cart).toEqual(cart);
 expect(h.conv.sessionData.pendingCartRemoval).toEqual(pending);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(interruption==='total')expect(intermediate).toContain((192000+(merge?7000:0)).toLocaleString('es-CO'));
 else expect(intermediate).toContain('Sabor');
 await h.sendQueued(phrase);
 expect(h.replies.at(-1)).toMatch(/Mango/i);expect(h.replies.at(-1)).toMatch(/Fresa/i);
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
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});
