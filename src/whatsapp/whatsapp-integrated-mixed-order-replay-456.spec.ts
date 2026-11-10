import {harness} from './whatsapp-accuracy.test-support';
function setup(base:string,agent:boolean){
 const menu=[{id:45601,code:1,name:`1 ${base} Frito`,price:44000,availableNow:true,attributes:[]},{id:45602,code:4,name:`1 ${base} Broaster`,price:46000,availableNow:true,attributes:[]},{id:45603,code:99,name:`Combo De ${base} Frito`,price:53000,availableNow:true,attributes:[]},{id:45604,code:98,name:`Combo De ${base} Broaster`,price:55000,availableNow:true,attributes:[]},{id:45605,code:89,name:`Combo De ${base} Mixto`,price:base==='Pollo'?57000:63000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Manzana']},{attributeName:'Arepas',options:['Blancas','Fritas']}]},{id:45606,code:15,name:'Sopa De Menudencias',price:12000,availableNow:true,attributes:[]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});h.service.ordersService.create=jest.fn().mockResolvedValue({id:456,dailyOrderNumber:456});Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true,cart:[{productId:45606,code:15,name:menu[5].name,unitPrice:12000,quantity:1,attributes:[],note:'Bien caliente'}]});h.conv.sessionData.cart=[];return {h,menu};
}



const availability='Sí hay o no hay. Sí me la puede enviar o no me la puede enviar, confírmeme.';
for(const base of ['Pollo','Bowl'])for(const agent of [false,true])for(const order of ['combo-first','soup-first'])for(const recap of ['none','long','short'])for(const payment of ['cash','transfer'])it(`integrated initial replay ${base}/${agent}/${order}/${recap}/${payment}`,async()=>{
 const {h,menu}=setup(base,agent);
 const combo=`Bueno, mira, un favor, es que necesito un combo de ${base.toLowerCase()} frito y ${base.toLowerCase()} broster, que vale cincuenta y tres, algo así.`;
 const soup=payment==='cash'?'Y una sopa menudencia.':'Y también una sopa de menudencias.';
 for(const text of order==='combo-first'?[combo,soup]:[soup,combo])await h.sendQueued(text);
 expect(h.conv.sessionData.cart.map(p=>p.productId)).toEqual([45606]);
 expect(h.conv.sessionData.pendingAddOffer).toMatchObject({productId:45605,price:menu[4].price,quantity:1});
 if(recap!=='none'){
  const text=recap==='long'?`Amigo, es un combo, es un combo de ${base.toLowerCase()} que viene frito y broster, que vale 53 mil, me dijeron, y una sopa de menudencia.`:`Combo de ${base.toLowerCase()} que vale cincuenta y tres mil y una sopa de menudencia.`;
  const quoted=structuredClone(h.conv.sessionData);await h.sendQueued(text);expect(h.conv.sessionData).toEqual(quoted);
 }
 const before=structuredClone(h.conv.sessionData),replyStart=h.replies.length;await h.sendQueued(availability);expect(h.conv.sessionData).toEqual(before);const status=h.replies.slice(replyStart).join('\n');expect(status).toContain(menu[4].name);expect(status).toMatch(/disponible.*carta/i);expect((status.match(/\?/g)||[]).length).toBeLessThanOrEqual(1);
 const accepted=`El combo es el que viene con medio ${base.toLowerCase()} frito y medio ${base.toLowerCase()} broster, ¿sí? Ese sí, sí. Bueno, muchas gracias. Ya le mando la ubicación. Pago ${payment==='cash'?'en efectivo':'por Nequi'}.`;
 const start=h.replies.length;await h.sendQueued(accepted);expect(h.replies.slice(start).join('\n')).not.toMatch(/referencia.*restaurante|d[oó]nde.*restaurante|c[oó]mo pagas/i);
 expect(h.conv.sessionData.cart.map(p=>p.productId)).toEqual([45606,45605]);expect(h.conv.sessionData.cart.map(p=>p.quantity)).toEqual([1,1]);expect(h.conv.sessionData.paymentMethod).toBe(payment);expect(h.conv.sessionData.address).toBeFalsy();
 const added=structuredClone(h.conv.sessionData);await h.sendQueued(accepted);expect(h.conv.sessionData).toEqual(added);
 await h.sendQueued('no más');expect(h.conv.state).toBe('awaiting_address');await h.sendQueued('Calle 12 #23-45');expect(h.conv.state).toBe('awaiting_final_confirm');const waiting=structuredClone(h.conv.sessionData);await h.sendQueued(availability);expect(h.conv.sessionData).toEqual(waiting);expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map((i:any)=>i.productId)).toEqual([45606,45605]);expect(dto.items[1].attributes.map((a:any)=>a.attributeName+':'+a.attributeValue).sort()).toEqual(['Arepas:Blancas','Bebida:Colombiana']);expect(dto.deliveryFee).toBe(2000);expect(dto.address).toMatch(payment==='cash'?/efectivo|contraentrega/i:/transferencia/i);expect(h.conv.state).toBe('completed');
});

for(const guard of ['no-offer','quantity','multi-quote','changed-price','unavailable-offer','attribute-side','unavailable-side','existing-side','existing-offer','drink','side-note','extra-item','two-sides','question','condition','takeover','checkout','pending-option','pending-list','ambiguous-side'])it(`independent addition boundary ${guard}`,async()=>{
 const {h,menu}=setup('Pollo',false);h.conv.sessionData.pendingAddOffer={createdAt:Date.now(),productId:45605,name:menu[4].name,code:89,price:57000,quantity:1};let text='Y una sopa menudencia.';
 if(guard==='no-offer')delete h.conv.sessionData.pendingAddOffer;if(guard==='quantity')h.conv.sessionData.pendingAddOffer!.quantity=2;if(guard==='multi-quote')h.conv.sessionData.pendingAddOffer!.productIds=[45605,45604];if(guard==='changed-price')h.conv.sessionData.pendingAddOffer!.price=56000;
 if(guard==='unavailable-offer')h.service.catalogService.getMenuProducts.mockResolvedValue(menu.map((p,i)=>i===4?{...p,availableNow:false}:p));
 if(guard==='attribute-side')h.service.catalogService.getMenuProducts.mockResolvedValue(menu.map((p,i)=>i===5?{...p,hasAttributes:true,attributes:[{attributeName:'Tamaño',options:['Pequeña','Grande']}]}:p));
 if(guard==='unavailable-side')h.service.catalogService.getMenuProducts.mockResolvedValue(menu.map((p,i)=>i===5?{...p,availableNow:false}:p));
 if(guard==='existing-side')h.conv.sessionData.cart=[{productId:45606,code:15,name:menu[5].name,unitPrice:12000,quantity:1,attributes:[]}];
 if(guard==='existing-offer')h.conv.sessionData.cart=[{productId:45605,code:89,name:menu[4].name,unitPrice:57000,quantity:1,attributes:[]}];
 if(guard==='drink'){text='Y una limonada';h.service.catalogService.getMenuProducts.mockResolvedValue([...menu,{id:45607,name:'Limonada',code:70,price:5000,availableNow:true,attributes:[]}]);}
 if(guard==='side-note')text+=' sin sal';if(guard==='extra-item')text+=' y una papa';if(guard==='two-sides')text='Y dos sopas menudencias';if(guard==='question')text='¿Y una sopa menudencia?';if(guard==='condition')text='Y una sopa menudencia si no demora';if(guard==='takeover')Object.assign(h.conv,{humanTakeover:true});if(guard==='checkout')h.conv.state='awaiting_final_confirm';
 if(guard==='pending-option')h.conv.sessionData.pendingAttribute={productId:45605,name:menu[4].name,code:89,price:57000,quantity:1,attributes:menu[4].attributes,selected:[]};if(guard==='pending-list')h.conv.sessionData.pendingMatch={query:'pollo',candidates:menu.slice(0,2),intent:'order'};
 if(guard==='ambiguous-side')h.service.catalogService.getMenuProducts.mockResolvedValue([...menu,{...menu[5],id:45608}]);
 const before=structuredClone(h.conv.sessionData),turn={};expect(await h.service.tryAddIndependentDishKeepingOffer(h.conv,h.conv.phoneE164,h.conv.sessionData,text,h.cfg,turn)).toBe(false);expect(h.conv.sessionData).toEqual(before);expect(turn).toEqual({});expect(h.replies).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const base of ['Pollo','Bowl'])for(const agent of [false,true])it(`closed independent addition preserves offer ${base}/${agent}`,async()=>{
 const {h}=setup(base,agent);await h.sendQueued(`Quiero un combo de ${base.toLowerCase()} frito y broster que vale 53 mil`);const before=structuredClone(h.conv.sessionData);h.cfg.ignoreBusinessHours=false;h.service.businessService.getStatus=jest.fn().mockResolvedValue({isOpen:false});await h.sendQueued('También una sopa menudencia');expect(h.conv.sessionData).toEqual(before);expect(h.replies[h.replies.length-1]).toMatch(/cerrad/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])it(`ordinary unrelated order still retires old offer ${agent}`,async()=>{
 const {h}=setup('Pollo',agent);await h.sendQueued('Quiero un combo de pollo frito y broster que vale 53 mil');expect(h.conv.sessionData.pendingAddOffer).toBeTruthy();await h.sendQueued('Quiero una sopa de menudencias');expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();expect(h.conv.sessionData.cart.map(p=>p.productId)).toEqual([45606]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])for(const cancel of ['Quiero cancelar el pedido','No me envíe nada'])it(`cancel preserved offer and independent dish ${agent}/${cancel}`,async()=>{
 const {h}=setup('Pollo',agent);h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);await h.sendQueued('Quiero un combo de pollo frito y broster que vale 53 mil');await h.sendQueued('Y una sopa menudencia');expect(h.conv.sessionData.pendingAddOffer).toBeTruthy();expect(h.conv.sessionData.cart).toHaveLength(1);const reply=await h.sendQueued(cancel);expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();expect(reply).toMatch(/cancelad|vaci|descart/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
