/** CHAT2510-08: content inquiry, side substitution and repeat preserve the selected drink. */
import {harness} from './whatsapp-accuracy.test-support';
const menus=[
 {name:'Combo De Pollo Frito',from:'papa salada',to:'yuca'},
 {name:'Combo De Pizza Vegetal',from:'pan de ajo',to:'ensalada'},
 {name:'Combo De Ramen Miso',from:'arroz',to:'fideos'},
];
for(const m of menus)for(const agent of [false,true])for(const explicit of [false,true])it(`${m.name}/${agent}/${explicit}: inquiry then repeated substitution reaches the right DTO`,async()=>{
 const h=harness([{id:9801,code:81,name:m.name,price:30000,description:`Acompañado con ${m.from} y bebida.`,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Pepsi']}]},{id:9802,code:82,name:`Porción De ${m.to}`,price:5000,availableNow:true,hasAttributes:false,attributes:[]}],agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
 Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 await h.sendQueued(`Me regalas un ${m.name} con Pepsi`);
 expect(h.conv.sessionData.cart.map(p=>[p.productId,p.quantity])).toEqual([[9801,1]]);
 expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Pepsi'});
 const purchased=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('Con que viene el\nCombo\n?');expect(h.conv.sessionData.cart).toEqual(purchased);
 expect(h.replies.at(-1)).toMatch(new RegExp(m.from,'i'));expect(h.conv.sessionData.pendingMatch).toBeFalsy();
 const message=explicit?`Al ${m.name} que ya te pedí, en vez de ${m.from} me regalas ${m.to}`:`no, el combo que ya te pedi, lo quiero con en vez de ${m.from} me regalas ${m.to}`;
 await h.sendQueued(message);
 const changed=structuredClone(h.conv.sessionData.cart);expect(changed).toHaveLength(1);expect(changed[0].quantity).toBe(1);
 expect(changed[0].attributes).toEqual(purchased[0].attributes);expect(changed[0].note).toMatch(new RegExp(m.from,'i'));expect(changed[0].note).toMatch(new RegExp(m.to,'i'));
 expect(h.replies.at(-1)).not.toMatch(/no entend|no pude|cu[aá]l prefieres/i);
 await h.sendQueued(message);expect(h.conv.sessionData.cart).toEqual(changed);
 await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(1);expect(dto.items[0].productId).toBe(9801);expect(dto.items[0].note).toBe(changed[0].note);expect(dto.items[0].attributes).toEqual(purchased[0].attributes);
});

for(const m of menus)for(const agent of [false,true])for(const fault of ['ambiguous','quantity','pending','payment','unknown-from','conflict','long-note'])it(`${m.name}/${agent}/${fault}: clarify without partial changes`,async()=>{
 const product={id:9801,code:81,name:m.name,price:30000,description:`Acompañado con ${m.from} y bebida.`,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Pepsi']}]};
 const h=harness([product],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.conv.sessionData.cart=[{productId:product.id,code:product.code,name:product.name,unitPrice:product.price,quantity:fault==='quantity'?2:1,attributes:[{attributeName:'Bebida',attributeValue:'Pepsi'}],note:fault==='conflict'?`Con ${m.from}`:fault==='long-note'?'x'.repeat(195):'Sin salsa'}];
 if(fault==='ambiguous')h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],note:'Sin cebolla'});
 if(fault==='pending')h.conv.sessionData.pendingAttribute={productId:9801} as never;
 if(fault==='payment'){h.conv.state='awaiting_mp_payment';h.conv.sessionData.mpPreferenceId='synthetic-only';}
 const before=structuredClone(h.conv.sessionData);
 await h.sendQueued(`Al ${m.name} que ya te pedí, en vez de ${fault==='unknown-from'?'ingrediente inexistente':m.from} me regalas ${m.to}`);
 expect(h.conv.sessionData).toEqual(before);expect(h.replies.at(-1)).toMatch(/igual/i);
 expect(h.replies.at(-1)).not.toMatch(/Anot[eé] la solicitud/i);
});
