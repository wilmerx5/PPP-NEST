import {harness} from './whatsapp-accuracy.test-support';
function setup(base:string,agent:boolean){
 const menu=[{id:45501,code:1,name:`1 ${base} Frito`,price:44000,availableNow:true,attributes:[]},{id:45502,code:4,name:`1 ${base} Broaster`,price:46000,availableNow:true,attributes:[]},{id:45503,code:99,name:`Combo De ${base} Frito`,price:53000,availableNow:true,attributes:[]},{id:45504,code:98,name:`Combo De ${base} Broaster`,price:55000,availableNow:true,attributes:[]},{id:45505,code:89,name:`Combo De ${base} Mixto`,price:base==='Pollo'?57000:63000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Manzana']},{attributeName:'Arepas',options:['Blancas','Fritas']}]},{id:45506,code:15,name:'Sopa De Menudencias',price:12000,availableNow:true,attributes:[]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});h.service.ordersService.create=jest.fn().mockResolvedValue({id:455,dailyOrderNumber:455});Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true,cart:[{productId:45506,code:15,name:menu[5].name,unitPrice:12000,quantity:1,attributes:[],note:'Bien caliente'}]});return {h,menu};
}


const questions = [
 'Sí hay o no hay. Sí me la puede enviar o no me la puede enviar, confírmeme.',
 '¿Hay o no hay? Me confirma porfa.',
 'Sí me lo pueden enviar o no, confírmeme.',
];
async function open(h:any, base:string, context:string) {
 await h.sendQueued(`Quiero un combo de ${base.toLowerCase()} frito y broster que vale 53 mil`);
 expect(h.conv.sessionData.pendingAddOffer).toMatchObject({productId:45505});
 if(context==='list') {
  // The real abbreviated follow-up must preserve an ambiguous choice, never choose by53.000.
  delete h.conv.sessionData.pendingAddOffer;
  h.conv.sessionData.pendingMatch={query:`combo de ${base.toLowerCase()}`,candidates:(await h.service.catalogService.getMenuProducts()).slice(2,5),intent:'order',quantity:1};
 }
}
async function ask(h:any,text:string) {
 const before=structuredClone(h.conv.sessionData),state=h.conv.state,start=h.replies.length;
 await h.sendQueued(text);const reply=h.replies.slice(start).join('\n');
 expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);
 expect(reply).toMatch(/disponible.*carta|carta.*disponible/i);
 expect(reply).not.toMatch(/pedido (?:qued[oó] )?(?:registrado|confirmado)|s[ií][, ]+llegamos|te (?:lo|la) enviamos|no entend[ií]/i);
 expect((reply.match(/\?/g)||[]).length).toBeLessThanOrEqual(1);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();return reply;
}
async function close(h:any,payment:string,drink='Colombiana') {
 expect(h.conv.sessionData.cart.map((p:any)=>p.productId)).toEqual([45506,45505]);
 expect(h.conv.sessionData.cart.map((p:any)=>p.quantity)).toEqual([1,1]);
 await h.sendQueued('no más');expect(h.conv.state).toBe('awaiting_address');
 await h.sendQueued('Calle 12 #23-45');expect(h.conv.state).toBe('awaiting_final_confirm');
 await confirm(h,payment,drink);
}
async function confirm(h:any,payment:string,drink='Colombiana') {
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map((i:any)=>i.productId)).toEqual([45506,45505]);
 expect(dto.items[0].note).toMatch(/Bien caliente/i);
 expect(dto.items[1].attributes.map((a:any)=>a.attributeName+':'+a.attributeValue).sort()).toEqual(['Arepas:Blancas','Bebida:'+drink]);
 expect(dto.deliveryFee).toBe(2000);expect(dto.address).toMatch(payment==='cash'?/efectivo|contraentrega/i:/transferencia/i);expect(h.conv.state).toBe('completed');
}
for(const base of ['Pollo','Bowl'])for(const agent of [false,true])for(const context of ['offer','list'])for(const [index,text] of questions.entries())it(`availability demand preserves decision ${base}/${agent}/${context}/${index}`,async()=>{
 const {h,menu}=setup(base,agent),payment=index===1?'transfer':'cash';h.conv.sessionData.paymentMethod=payment;await open(h,base,context);
 const reply=await ask(h,text);expect(reply).toContain(menu[4].name);expect(reply).toMatch(/direcci[oó]n completa/i);
 if(context==='offer'){expect(reply).toMatch(base==='Pollo'?/57[.,]000/:/63[.,]000/);expect(reply).toMatch(/agrego/i);await ask(h,text);await h.sendQueued('sí');}
 else {expect(reply).toContain(menu[2].name);expect(reply).toContain(menu[3].name);expect(reply).toMatch(/elige|n[uú]mero/i);await ask(h,text);await h.sendQueued('#89');expect(h.conv.sessionData.pendingAttribute).toBeTruthy();await h.sendQueued('Manzana');}
 await close(h,payment,context==='offer'?'Colombiana':'Manzana');
});
for(const base of ['Pollo','Bowl'])for(const agent of [false,true])for(const [index,text] of questions.entries())it(`availability demand never confirms checkout ${base}/${agent}/${index}`,async()=>{
 const {h,menu}=setup(base,agent);h.conv.sessionData.paymentMethod='cash';await open(h,base,'offer');await h.sendQueued('sí');await h.sendQueued('no más');expect(h.conv.state).toBe('awaiting_address');let reply=await ask(h,text);expect(reply).toContain(menu[4].name);expect(reply).toContain(menu[5].name);expect(reply).toMatch(/direcci[oó]n/i);await h.sendQueued('Calle 12 #23-45');expect(h.conv.state).toBe('awaiting_final_confirm');reply=await ask(h,text);expect(reply).toMatch(/confirmar/i);await confirm(h,'cash');
});
for(const agent of [false,true])for(const context of ['offer','list'])for(const stock of ['unavailable','missing'])it(`availability demand checks current catalog ${agent}/${context}/${stock}`,async()=>{
 const {h,menu}=setup('Pollo',agent);await open(h,'Pollo',context);h.service.catalogService.getMenuProducts.mockResolvedValue(stock==='missing'?menu.slice(0,2).concat(menu.slice(5)):menu.map((p,i)=>i>=2&&i<=4?{...p,availableNow:false}:p));const before=structuredClone(h.conv.sessionData),start=h.replies.length;await h.sendQueued(questions[0]);expect(h.conv.sessionData).toEqual(before);const reply=h.replies.slice(start).join('\n');expect(reply).toMatch(/no (?:figura|figuran|est[aá]|est[aá]n).*disponible|ninguna.*disponible/i);expect(reply).not.toMatch(/te agrego|s[ií].*disponible|pedido (?:registrado|confirmado)/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])for(const context of ['offer','list'])it(`closed availability demand preserves draft ${agent}/${context}`,async()=>{
 const {h}=setup('Pollo',agent);await open(h,'Pollo',context);h.cfg.ignoreBusinessHours=false;h.service.businessService.getStatus=jest.fn().mockResolvedValue({isOpen:false});const before=structuredClone(h.conv.sessionData);await h.sendQueued(questions[0]);expect(h.conv.sessionData).toEqual(before);expect(h.replies[h.replies.length-1]).toMatch(/cerrad/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])it(`availability demand reports changed price without accepting it ${agent}`,async()=>{
 const {h,menu}=setup('Pollo',agent);await open(h,'Pollo','offer');h.service.catalogService.getMenuProducts.mockResolvedValue(menu.map((p,i)=>i===4?{...p,price:59000}:p));const before=structuredClone(h.conv.sessionData),start=h.replies.length;await h.sendQueued(questions[0]);expect(h.conv.sessionData).toEqual(before);const reply=h.replies.slice(start).join('\n');expect(reply).toMatch(/59[.,]000/);expect(reply).toMatch(/cambi[oó]|actualizar|revisar/i);expect(reply).not.toMatch(/te agrego/i);await h.sendQueued('sí');expect(h.conv.sessionData.pendingAddOffer).toMatchObject({price:59000});expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const guard of ['completed','takeover','attribute','multi','address-conflict','price','edit','info','approval','correction','new-product','contact','merchant','empty','legacy-list','multi-quote'])it(`availability demand boundary ${guard}`,async()=>{
 const {h,menu}=setup('Pollo',false);h.conv.sessionData.pendingAddOffer={createdAt:Date.now(),productId:45505,name:menu[4].name,code:89,price:57000,quantity:1};let text=questions[0];
 if(guard==='completed')h.conv.state='completed';if(guard==='takeover')Object.assign(h.conv,{humanTakeover:true});
 if(guard==='attribute')h.conv.sessionData.pendingAttribute={productId:45505,name:menu[4].name,code:89,price:57000,quantity:1,attributes:menu[4].attributes,selected:[]};
 if(guard==='multi')h.conv.sessionData.pendingMultiOrder={confident:[],ambiguous:[],needsAttributes:[],unresolved:['sopa']};
 if(guard==='address-conflict')h.conv.sessionData.pendingAddressConflict={} as any;
 if(guard==='price')h.conv.sessionData.pendingPriceInquiry={cartSignature:'x',state:h.conv.state,productIds:[45505]};
 if(guard==='edit')h.conv.sessionData.pendingCartQuantity={quantity:2,options:[],cartSignature:'x'};
 if(guard==='info'){delete h.conv.sessionData.pendingAddOffer;h.conv.sessionData.pendingMatch={query:'combo',candidates:[menu[4]],intent:'info'};}
 if(guard==='approval')text='Sí, confirma mi pedido';if(guard==='correction')text+=' pero sin sopa';if(guard==='new-product')text+=' y agrega una papa';if(guard==='contact')text+=' pago en Nequi';if(guard==='merchant')text='¿Me confirma si hay datáfono?';if(guard==='empty'){delete h.conv.sessionData.pendingAddOffer;h.conv.sessionData.cart=[];}
 if(guard==='legacy-list'){delete h.conv.sessionData.pendingAddOffer;h.conv.sessionData.pendingMatch={query:'combo',intent:'order'} as any;}if(guard==='multi-quote')h.conv.sessionData.pendingAddOffer!.productIds=[45505,45506];
 const before=structuredClone(h.conv.sessionData);expect(await h.service.tryAnswerPendingAvailabilityDemand(h.conv,h.conv.phoneE164,h.conv.sessionData,text,h.cfg)).toBe(false);expect(h.conv.sessionData).toEqual(before);expect(h.replies).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for(const agent of [false,true])it(`availability demand lists only current available options ${agent}`,async()=>{
 const {h,menu}=setup('Pollo',agent);await open(h,'Pollo','list');h.service.catalogService.getMenuProducts.mockResolvedValue(menu.map((p,i)=>i===2?{...p,availableNow:false}:p));const reply=await ask(h,questions[0]);expect(reply).not.toContain(menu[2].name);expect(reply).toContain(menu[3].name);expect(reply).toContain(menu[4].name);expect(reply).toMatch(/algunas.*no.*disponibles/i);
});
for(const agent of [false,true])for(const stock of ['unavailable','missing'])it(`availability demand rechecks registered cart ${agent}/${stock}`,async()=>{
 const {h,menu}=setup('Pollo',agent);await open(h,'Pollo','offer');await h.sendQueued('sí');h.service.catalogService.getMenuProducts.mockResolvedValue(stock==='missing'?menu.filter(p=>p.id!==45505):menu.map((p,i)=>i===4?{...p,availableNow:false}:p));const before=structuredClone(h.conv.sessionData),start=h.replies.length;await h.sendQueued(questions[0]);expect(h.conv.sessionData).toEqual(before);const reply=h.replies.slice(start).join('\n');expect(reply).toContain(menu[4].name);expect(reply).toMatch(/no figura disponible/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for(const agent of [false,true])for(const context of ['offer','cart'])for(const mode of ['outside','pickup'])it(`availability does not promise delivery ${agent}/${context}/${mode}`,async()=>{
 const {h}=setup('Pollo',agent);await open(h,'Pollo','offer');if(context==='cart')await h.sendQueued('sí');if(mode==='outside'){h.conv.sessionData.address='Calle lejana #1-2';h.conv.sessionData.deliveryOutOfCoverage=true;}else h.conv.sessionData.orderType='pickup';const reply=await ask(h,questions[0]);expect(reply).toMatch(mode==='outside'?/fuera de cobertura/i:/sigue para recoger/i);expect(reply).not.toMatch(/confirmar para enviarlo/i);expect(h.conv.sessionData.orderType).toBe(mode==='outside'?'delivery':'pickup');
});
