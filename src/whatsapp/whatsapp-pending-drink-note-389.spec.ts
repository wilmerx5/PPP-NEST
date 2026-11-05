import {harness} from './whatsapp-accuracy.test-support';
for(const other of [false,true])for(const agent of [false,true])for(const note of ['la bebida bien fría','la gaseosa al clima'])it(`pending preparation retains drink note ${other}/${agent}/${note}`,async()=>{
 const food=other?'Pizza':'Pollo',preparation=other?'Asada':'Broaster';
 const menu=['Frita',preparation].map((p,i)=>({id:38901+i,code:1+i,name:`Combo De ${food} ${p==='Frita'&&!other?'Frito':p}`,price:30000+i*2000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Pepsi','Colombiana']}]}));
 const h=harness(menu,agent);h.service.ordersService.create=jest.fn().mockResolvedValue({id:389,dailyOrderNumber:389});
 await h.sendQueued(`Un combo de ${food} con Pepsi`);
 expect(h.conv.sessionData.cart).toHaveLength(0);
 const reply=await h.sendQueued(note);
 expect(reply).not.toMatch(/no manejamos|no pude|no entend/i);
 expect((h.conv.sessionData.pendingMatch?.note || h.conv.sessionData.pendingMultiOrder?.ambiguous[0]?.note)).toMatch(/Bebida/i);
 await h.sendQueued(preparation);
 expect(h.conv.sessionData.cart).toHaveLength(1);
 expect(h.conv.sessionData.cart[0]).toMatchObject({productId:38902,quantity:1});
 expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Pepsi'});
 expect(h.conv.sessionData.cart[0].note).toMatch(note.includes('fría')?/bebida.*fr[ií]a/i:/bebida.*clima/i);
 await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items[0].note).toMatch(note.includes('fría')?/fr[ií]a/i:/clima/i);
});
function pendingFixture(agent:boolean,multi:boolean){
 const menu=['Frito','Broaster'].map((style,i)=>({id:38911+i,code:11+i,name:`Combo De Pollo ${style}`,price:30000+i*2000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Pepsi','Colombiana']}]}));
 const drink={id:38913,code:13,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]};
 const h=harness([...menu,drink],agent);
 const group={segment:'un combo de pollo',candidates:structuredClone(menu),note:undefined as string|undefined};
 if(multi)h.conv.sessionData.pendingMultiOrder={confident:[],ambiguous:[group],needsAttributes:[],unresolved:[]};
 else h.conv.sessionData.pendingMatch={query:'un combo de pollo',candidates:structuredClone(menu),intent:'order',quantity:1};
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:389,dailyOrderNumber:389});
 const getNote=()=>h.conv.sessionData.pendingMatch?.note || h.conv.sessionData.pendingMultiOrder?.ambiguous[0]?.note;
 return {h,menu,drink,getNote};
}
for(const agent of [false,true])for(const multi of [false,true])for(const guard of ['quantity','other-drink','conflict','withdrawn','question','repeat'])it(`pending note guard ${agent}/${multi}/${guard}`,async()=>{
 const {h,menu,drink,getNote}=pendingFixture(agent,multi);
 if(guard==='quantity'){if(multi)h.conv.sessionData.pendingMultiOrder!.ambiguous[0].segment='dos combos de pollo';else h.conv.sessionData.pendingMatch!.quantity=2;}
 if(guard==='other-drink')h.conv.sessionData.cart=[{productId:drink.id,code:drink.code,name:drink.name,unitPrice:drink.price,quantity:1}];
 if(guard==='conflict'){if(multi)h.conv.sessionData.pendingMultiOrder!.ambiguous[0].note='Bebida al clima';else h.conv.sessionData.pendingMatch!.note='Bebida al clima';}
 if(guard==='withdrawn')menu[1].availableNow=false;
 const before=structuredClone(h.conv.sessionData.cart),old=getNote();
 await h.sendQueued(guard==='question'?'¿La bebida bien fría?':'la bebida bien fría');
 if(guard==='repeat'){await h.sendQueued('la bebida bien fría');expect(getNote()?.match(/fría/gi)).toHaveLength(1);}
 else expect(getNote()).toBe(old);
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])for(const multi of [false,true])it(`numeric pick preserves earlier kitchen note ${agent}/${multi}`,async()=>{
 const {h,getNote}=pendingFixture(agent,multi);
 if(multi)h.conv.sessionData.pendingMultiOrder!.ambiguous[0].note='Sin cebolla';else h.conv.sessionData.pendingMatch!.note='Sin cebolla';
 await h.sendQueued('la bebida sin hielo');expect(getNote()).toMatch(/sin cebolla/i);expect(getNote()).toMatch(/bebida sin hielo/i);
 await h.sendQueued('2');if(h.conv.sessionData.pendingAttribute)await h.sendQueued('Pepsi');expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0].productId).toBe(38912);expect(h.conv.sessionData.cart[0].note).toMatch(/sin hielo/i);
 await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items[0].note).toMatch(/sin cebolla/i);expect(h.service.ordersService.create.mock.calls[0][0].items[0].note).toMatch(/sin hielo/i);
});
