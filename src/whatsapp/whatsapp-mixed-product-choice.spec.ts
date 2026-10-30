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

function setup(names:string[],agent:boolean,ambiguous:boolean,attributes:boolean,quantity:number){
 const base=baseSetup(names,agent,4,false);const {h,menu}=base;
 menu[1].name=names[2]+' Pequeno';
 const target={...menu[1],id:97403,code:97403,name:names[2]+' Grande',price:9000,hasAttributes:attributes,attributes:attributes?[{attributeName:'Sabor',options:['Mango','Fresa']}]:[]};
 menu.push(target);
 if(!ambiguous)h.conv.sessionData.cart[1].attributes![0].attributeValue='Cubos';
 return {...base,target,cart:structuredClone(h.conv.sessionData.cart),request:`quita dos de los de ${names[1]} y agrega ${quantity} ${names[2]}`};
}
for(const names of catalogs)for(const agent of [false,true])for(const ambiguous of [false,true])for(const attributes of [false,true])for(const quantity of [1,3])
for(const scenario of ['number','name','ordinal','total','cancel','reset'])
it(`mixed product choice ${names[0]} ${agent} ${ambiguous} ${attributes} ${quantity} ${scenario}`,async()=>{
 const {h,target,cart,request}=setup(names,agent,ambiguous,attributes,quantity);
 const prompt=await h.sendQueued(request);expect(prompt).toContain(target.name);expect(prompt).toContain('9.000');expect(h.conv.sessionData.cart).toEqual(cart);
 expect(h.conv.sessionData.pendingCartRemoval?.mixedAddition?.candidates).toHaveLength(2);
 if(scenario==='cancel'||scenario==='reset'){
  await h.sendQueued(scenario==='cancel'?'olvida ese cambio':'reiniciar');expect(h.conv.sessionData.cart).toEqual(scenario==='cancel'?cart:[]);expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();return;
 }
 if(scenario==='total'){const total=await h.sendQueued('cuánto va todo');expect(total).toContain('192.000');expect(total).toContain(target.name);expect(h.conv.sessionData.cart).toEqual(cart);}
 await h.sendQueued(scenario==='name'?target.name:scenario==='ordinal'?'el segundo':'2');
 if(ambiguous){expect(h.conv.sessionData.cart).toEqual(cart);expect(h.replies.at(-1)).toMatch(/l[ií]nea/);await h.sendQueued('el segundo');}
 if(attributes){expect(h.conv.sessionData.cart).toEqual(cart);expect(h.replies.at(-1)).toContain('Sabor');await h.sendQueued('2');}
 const attrs=attributes?[{attributeName:'Sabor',attributeValue:'Fresa'}]:[];
 const expected=[...cart.map((line,i)=>i===(ambiguous?1:0)?{...line,quantity:2}:line),{productId:97403,code:97403,name:target.name,quantity,unitPrice:9000,attributes:attrs}];
 expect(h.conv.sessionData.cart).toEqual(expected);expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');await h.sendQueued(attributes?'transferencia':'efectivo');expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
 const items=h.service.ordersService.create.mock.calls[0][0].items;
 expect(items).toEqual(expected.flatMap(line=>Array.from({length:line.quantity},()=>expect.objectContaining({productId:line.productId,attributes:line.attributes,...('note' in line?{note:line.note}:{})}))));
 expect(receipt).toContain((144000+quantity*9000).toLocaleString('es-CO'));
});
for(const agent of [false,true])for(const fault of ['price','stock','options','cart','payment','limit','question','invalid','expiry','confirm'])
it(`mixed candidate guard ${agent} ${fault}`,async()=>{
 const {h,target,request}=setup(catalogs[0],agent,false,false,3);await h.sendQueued(request);
 expect(h.conv.sessionData.pendingCartRemoval?.mixedAddition?.candidates).toHaveLength(2);
 if(fault==='price')target.price=10000;if(fault==='stock')target.availableNow=false;
 if(fault==='options'){target.hasAttributes=true;target.attributes=[{attributeName:'Sabor',options:['Mango']}];}
 if(fault==='cart')h.conv.sessionData.cart[0].note='Otra nota';
 if(fault==='payment')h.conv.sessionData.mpPreferenceId='synthetic';if(fault==='limit')Object.assign(h.cfg,{maxUnitsPerItem:1});
 if(fault==='expiry')h.conv.sessionData.pendingCartRemoval!.mixedAddition!.createdAt=Date.now()-31*60*1000;
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(fault==='question'?'¿el segundo?':fault==='invalid'?'9':fault==='confirm'?'confirmar':'2');
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for(const agent of [false,true])for(const scenario of ['prefix boundary','exact precedence','duplicate names','too many','condition','unavailable'])
it(`mixed catalog boundaries ${agent} ${scenario}`,async()=>{
 const {h,menu,target,cart,request}=setup(catalogs[0],agent,false,false,1);
 if(scenario==='prefix boundary')menu[1].name='Jugo Naturaleza Pequeno';
 if(scenario==='exact precedence')menu.push({...target,id:97404,code:97404,name:catalogs[0][2],price:8000});
 if(scenario==='duplicate names')menu[1].name=target.name;
 if(scenario==='too many')for(let i=0;i<8;i++)menu.push({...target,id:97500+i,code:97500+i,name:catalogs[0][2]+' Opcion '+i});
 if(scenario==='unavailable')target.availableNow=false;
 await h.sendQueued(request+(scenario==='condition'?' si hay':''));
 expect(h.conv.sessionData.pendingCartRemoval?.mixedAddition?.candidates).toBeFalsy();
 if(scenario==='exact precedence')expect(h.conv.sessionData.cart).toEqual([{...cart[0],quantity:2},cart[1],expect.objectContaining({productId:97404,quantity:1,unitPrice:8000})]);
 else expect(h.conv.sessionData.cart).toEqual(cart);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])for(const attributes of [false,true])
it(`standalone purchase supersedes mixed candidates ${agent} ${attributes}`,async()=>{
 const {h,target,cart,request}=setup(catalogs[0],agent,false,attributes,1);await h.sendQueued(request);
 await h.sendQueued('agrega 2 '+target.name);
 expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
 if(attributes){expect(h.conv.sessionData.cart).toEqual(cart);await h.sendQueued('Fresa');}
 expect(h.conv.sessionData.cart.slice(0,2)).toEqual(cart);
 expect(h.conv.sessionData.cart[2]).toMatchObject({productId:target.id,quantity:2});expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
