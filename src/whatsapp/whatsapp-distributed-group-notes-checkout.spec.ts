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
for(const names of catalogs)for(const agent of [false,true])for(const ambiguous of [false,true])for(const shared of [false,true])for(const merge of [false,true])for(const scenario of ['direct','reverse','total','missing'])for(const payment of ['efectivo','transferencia'])
it(`distributed group notes ${names[0]} ${agent} ${ambiguous} ${shared} ${merge} ${scenario} ${payment}`,async()=>{
 const {h,cart,request,common}=setup(names,agent,ambiguous,shared,merge);
 await h.sendQueued(request);if(ambiguous)await h.sendQueued('el segundo');if(shared)await h.sendQueued('Frio');
 expect(h.conv.sessionData.cart).toEqual(cart);
 const reply=await h.sendQueued('uno de fresa en vaso y el resto de mango en botella');expect(reply).toContain('Fresa');expect(reply).toContain('Botella');expect(h.conv.sessionData.pendingCartRemoval).toBeFalsy();
 const source=cart.slice(0,2).map((line,i)=>i===(ambiguous?1:0)?{...line,quantity:2}:line);
 expect(h.conv.sessionData.cart.slice(0,2)).toEqual(source);
 const drinks=h.conv.sessionData.cart.filter(l=>l.productId===97402);
 for(const [flavor,presentation,count] of [['Fresa','Vaso',1],['Mango','Botella',2+(merge?1:0)]] as const){
  expect(drinks.filter(l=>l.attributes?.some(a=>a.attributeValue===flavor))).toEqual([{productId:97402,code:97402,name:names[2],quantity:count,unitPrice:7000,attributes:[...common,{attributeName:'Sabor',attributeValue:flavor},{attributeName:'Presentacion',attributeValue:presentation}]}]);
 }
 expect(drinks).toHaveLength(2);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const beforeNotes=structuredClone(h.conv.sessionData.cart);
 const targets=['Fresa','Mango'].map(flavor=>h.conv.sessionData.cart.findIndex(l=>l.productId===97402 && l.attributes?.some(a=>a.attributeValue===flavor)));
 const notes=['sin hielo','sin azucar'];const ordinals=['primera','segunda','tercera','cuarta'];
 const order=scenario==='reverse'?[1,0]:[0,1];
 for(const step of order){
  const answer=await h.sendQueued(`a la ${ordinals[targets[step]]} ponle como nota ${notes[step]}`);
  beforeNotes[targets[step]].note=notes[step];
  expect(h.conv.sessionData.cart).toEqual(beforeNotes);expect(answer?.toLowerCase()).toContain(notes[step]);
  if(scenario==='total'){const total=await h.sendQueued('cuánto va todo');expect(total).toContain((165000+(merge?7000:0)).toLocaleString('es-CO'));expect(h.conv.sessionData.cart).toEqual(beforeNotes);}
  if(scenario==='missing'){const missing=await h.sendQueued('a la quinta ponle como nota sin sal');expect(missing).toMatch(/posición no está/);expect(h.conv.sessionData.cart).toEqual(beforeNotes);}
 }

 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');await h.sendQueued(payment);expect(h.conv.state).toBe('awaiting_final_confirm');
 const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
 const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(9+(merge?1:0));
 for(const line of beforeNotes){const matches=items.filter(i=>i.productId===line.productId && JSON.stringify(i.attributes)===JSON.stringify(line.attributes));expect(matches).toHaveLength(line.quantity);for(const item of matches)expect(item.note||'').toBe(line.note||'');}
 expect(receipt).toContain((165000+(merge?7000:0)).toLocaleString('es-CO'));for(const note of notes)expect(receipt?.toLowerCase()).toContain(note);
});
for(const agent of [false,true])for(const query of ['quinta','sexto','séptima','octavo','novena','décimo','5','6ª','número 7','99','0'])for(const exists of [false,true])
it(`scoped note ordinal ${query} ${agent} exists=${exists}`,async()=>{
 const rank=({'quinta':5,'sexto':6,'séptima':7,'octavo':8,'novena':9,'décimo':10,'5':5,'6ª':6,'número 7':7,'99':99,'0':0} as Record<string,number>)[query];
 const {h}=setup(catalogs[0],agent,false,false,false);
 const count=exists&&rank>0?rank:4;
 h.conv.sessionData.cart=Array.from({length:count},(_,i)=>({productId:97402,code:97402,name:'Jugo Natural',quantity:1,unitPrice:7000,note:`bolsa ${i+1}`,attributes:[{attributeName:'Sabor',attributeValue:i%2?'Mango':'Fresa'}]}));
 const before=structuredClone(h.conv.sessionData.cart);
 const answer=await h.sendQueued(`a la ${query} ponle como nota sin hielo`);
 const expected=before.map((line,i)=>exists&&rank>0&&i===rank-1?{...line,note:line.note+'; sin hielo'}:line);
 expect(h.conv.sessionData.cart).toEqual(expected);
 expect(answer).toMatch(exists&&rank>0?/sin hielo/:/posición no está/);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
