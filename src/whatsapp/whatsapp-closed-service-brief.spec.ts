import {harness,products} from './whatsapp-accuracy.test-support';
for(const enabled of [false,true])for(const existing of [false,true])for(const text of ['Hay servicio de domicilio?','Hola buenas noches, hay servicio de domicilio?','uy buenas noches','¿Están atendiendo?'])it(`closed brief ${text} cart=${existing} agent=${enabled}`,async()=>{
 const h=harness(products,enabled);h.cfg.ignoreBusinessHours=false;
 h.service.businessService.getStatus=jest.fn().mockResolvedValue({isOpen:false,message:'Cerrado',openTime:'11:00',closeTime:'22:00'});
 if(existing)h.conv.sessionData.cart=[{productId:1,code:1,name:'1 Pollo Frito',quantity:1,unitPrice:41000}];
 const before=structuredClone(h.conv.sessionData);const state=h.conv.state;
 const reply=await h.sendQueued(text);
 expect(h.replies).toHaveLength(1);expect(reply).toMatch(/cerrados/i);expect(reply).toContain('11:00');expect(reply).toContain('22:00');
 expect(reply).not.toMatch(/tarifas|km|se te antoja|plato|código|puedes pedir|carrito/i);
 expect(reply!.length).toBeLessThan(230);expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.conv.state).toBe(state);
});
it('open service remains available',async()=>{
 const h=harness(products,false);const reply=await h.sendQueued('Hay servicio de domicilio?');expect(reply).toMatch(/atendiendo|domicilio/i);expect(reply).not.toMatch(/cerrados/i);
});
for(const enabled of [false,true])for(const text of ['ya abriste?','¿Ya abrieron?','puedo hacer un pedido?','Todavía puedo pedir?'])it(`closed followup ${text} agent=${enabled}`,async()=>{
 const h=harness(products,enabled);h.cfg.ignoreBusinessHours=false;
 h.service.businessService.getStatus=jest.fn().mockResolvedValue({isOpen:false,message:'Cerrado',openTime:'11:00',closeTime:'22:00'});
 const reply=await h.send(text);
 expect(reply).toMatch(/cerrados/i);expect(reply).toContain('11:00');expect(reply).toContain('22:00');
 expect(reply).toMatch(/con gusto/i);expect(reply).not.toMatch(/estamos abiertos|no lo resuelvo/i);
 expect(h.cartRows()).toEqual([]);
});
