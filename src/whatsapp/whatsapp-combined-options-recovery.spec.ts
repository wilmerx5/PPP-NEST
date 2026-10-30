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
const interruptions=[['total','cuánto va todo'],['unknown','fresa y lata'],['conditional','fresa y vaso si hay'],['question','¿fresa y vaso?']];
for(const names of catalogs)for(const agent of [false,true])for(const ambiguous of [false,true])for(const merge of [false,true])for(const shared of [false,true])for(const payment of ['efectivo','transferencia'])for(const [kind,message] of interruptions)
it(`combined recovery ${names[0]} ${agent} ${ambiguous} ${merge} ${shared} ${payment} ${kind}`,async()=>{
 const {h,menu,request}=setup(names,agent,ambiguous,true);
 if(shared)menu[1].attributes.unshift({attributeName:'Temperatura',options:['Frio','Natural']});
 const attrs=[...(shared?[{attributeName:'Temperatura',attributeValue:'Frio'}]:[]),{attributeName:'Sabor',attributeValue:'Fresa'},{attributeName:'Presentacion',attributeValue:'Vaso'}];
 if(merge)h.conv.sessionData.cart.push({productId:97402,code:97402,name:names[2],quantity:1,unitPrice:7000,attributes:attrs});
 const cart=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued(request);if(ambiguous)await h.sendQueued('el segundo');if(shared)await h.sendQueued('Frio');
 const pending=structuredClone(h.conv.sessionData.pendingCartRemoval);
 const interrupted=await h.sendQueued(message);
 expect(h.conv.sessionData.cart).toEqual(cart);expect(h.conv.sessionData.pendingCartRemoval).toEqual(pending);
 expect(interrupted).toContain('Sabor');if(kind==='total')expect(interrupted).toContain((192000+(merge?7000:0)).toLocaleString('es-CO'));
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const reply=await h.sendQueued('Presentacion: Vaso; Sabor: Fresa');
 expect(reply).toContain('Fresa');expect(reply).toContain('Vaso');expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
 const expected=cart.map((line,i)=>i===(ambiguous?1:0)?{...line,quantity:2}:line.productId===97402?{...line,quantity:4}:line);
 if(!merge)expected.push({productId:97402,code:97402,name:names[2],quantity:3,unitPrice:7000,attributes:attrs});
 expect(h.conv.sessionData.cart).toEqual(expected);
 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');
 await h.sendQueued(payment);expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
 const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(merge?10:9);
 for(const line of expected){
  const matches=items.filter(item=>item.productId===line.productId && JSON.stringify(item.attributes)===JSON.stringify(line.attributes));
  expect(matches).toHaveLength(line.quantity);
  for(const item of matches)expect(item.note||'').toBe(line.note||'');
 }
 expect(receipt).toContain((144000+(merge?4:3)*7000).toLocaleString('es-CO'));
 expect(receipt).toContain('Sin sal');expect(receipt).toContain('Salsa aparte');
});
