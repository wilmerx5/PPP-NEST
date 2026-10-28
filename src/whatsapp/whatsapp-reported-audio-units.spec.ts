import {harness,products} from './whatsapp-accuracy.test-support';
const pair='Quiero dos menús ejecutivos, uno con pierna pernil, el otro con pechuga ala, los dos con sopa de ajiaco, uno con limonada y el otro con colombiana.';
const combo='Quiero un pollito frito en combo con gaseosa colombiana con las arepas fritas.';
for(const agent of [false,true])for(const audio of [false,true]){
 const setup=()=>{
  const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('synthetic-audio'),mimeType:'audio/ogg'});h.service.conversationService.updateMessageBody=jest.fn();
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  const send=async(text:string)=>{if(!audio)return h.sendQueued(text);h.service.aiService.transcribeAudio=jest.fn().mockResolvedValue(text);return h.sendQueued('',{messageType:'audio',mediaId:'synthetic-audio',mimeType:'audio/ogg'});};return {h,send};
 };
 it(`recorded two-unit options survive explicit preparation choice ${agent}/${audio}`,async()=>{
  const {h,send}=setup();await send(pair);expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);expect(h.replies.at(-1)).toMatch(/Broaster/);expect(h.replies.at(-1)).toMatch(/Frito/);
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('2');const rows=h.conv.sessionData.cart;expect(rows.map(r=>[r.productId,r.quantity])).toEqual([[22,1],[22,1]]);
  expect(rows[0].attributes).toEqual(expect.arrayContaining([{attributeName:'Presa',attributeValue:'Pierna Pernil'},{attributeName:'Sopa',attributeValue:'Ajiaco'},{attributeName:'Bebida',attributeValue:'Limonada'}]));
  expect(rows[1].attributes).toEqual(expect.arrayContaining([{attributeName:'Presa',attributeValue:'Ala, pechuga'},{attributeName:'Sopa',attributeValue:'Ajiaco'},{attributeName:'Bebida',attributeValue:'Colombiana'}]));
  expect(h.replies.at(-1)).toMatch(/Limonada/);expect(h.replies.at(-1)).toMatch(/Ala, pechuga/);const before=structuredClone(rows);await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual(before.map(r=>({productId:r.productId,attributes:r.attributes,note:r.note})));
 });
 it(`recorded new combo cannot replace the two existing executives ${agent}/${audio}`,async()=>{
  const {h,send}=setup();h.conv.sessionData.cart=[{productId:18,code:18,name:'Ejecutivo Con Pollo Broaster',quantity:2,unitPrice:25000,note:'Sin cebolla',attributes:[{attributeName:'Presa',attributeValue:'Pierna Pernil'},{attributeName:'Sopa',attributeValue:'Ajiaco'},{attributeName:'Bebida',attributeValue:'Colombiana'}]}];const before=structuredClone(h.conv.sessionData.cart[0]);h.conv.sessionData.pendingQuantityHint={quantity:2,query:'pollo'};
  await send(combo);expect(h.conv.sessionData.cart[0]).toEqual(before);expect(h.conv.sessionData.cart.filter(r=>r.productId===99)).toHaveLength(1);expect(h.conv.sessionData.cart.reduce((n,r)=>n+r.quantity,0)).toBe(3);expect(h.replies.at(-1)).not.toMatch(/lo cambi[eé]/i);
 });
 it(`recorded de-combo phrasing cannot add a separate soda ${agent}/${audio}`,async()=>{
  const {h,send}=setup();await send('Quiero un pollito frito de combo con gaseosa colombiana y con las arepas fritas.');expect(h.conv.sessionData.cart.map(r=>r.productId)).toEqual([99]);expect(h.conv.sessionData.cart[0].attributes).toEqual(expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Colombiana'},{attributeName:'Arepas',attributeValue:'Fritas'}]));expect(h.conv.sessionData.cart[0].note||'').not.toMatch(/arepas/);
 });
}

const menus=[{name:'Bento Oriental',key:'Proteína',a:'Tofu',b:'Tempura'},{name:'Pasta Primavera',key:'Salsa',a:'Pesto',b:'Pomodoro'},{name:'Wrap Vegetal',key:'Proteína',a:'Tofu',b:'Garbanzos'}];
for(const m of menus)for(const agent of [false,true])for(const path of ['valid','unknown','conflict','interruption','removed','option changed','price changed','closed','cart limit','competing selection','direct confirmation'])it(`${m.name}/${agent}/${path}: staged per-unit purchase is atomic`,async()=>{
 const variant=(id:number,style:string)=>({id,code:id,name:`${m.name} ${style}`,price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:m.key,options:[m.a,m.b]},{attributeName:'Entrada',options:['Ensalada','Crema']},{attributeName:'Bebida',options:['Agua','Cola']}]});
 const menu=[variant(9751,'Broaster'),variant(9752,'Frito')];const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 if(path==='competing selection')h.conv.sessionData.pendingMatch={query:'otra selección',candidates:[menu[0]],intent:'order'};
 const before=structuredClone(h.conv.sessionData);
 const request=`Quiero dos ${m.name}, uno con ${m.a}, el otro con ${path==='unknown'?'Opcion Extraña':m.b}, los dos con Crema, uno con Agua y el otro con Cola${path==='conflict'?', uno con '+m.b:''}.`;
 await h.sendQueued(request);expect(h.conv.sessionData.cart).toEqual(before.cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 if(['unknown','conflict','competing selection'].includes(path)){expect(h.conv.sessionData).toEqual(before);expect(h.replies.at(-1)).toMatch(/validar|aclar|selecci[oó]n/i);return;}
 expect(h.conv.sessionData.pendingMatch?.unitAttributeGroups).toHaveLength(2);const held=structuredClone(h.conv.sessionData);
 if(path==='direct confirmation'){await h.service.tryConfirmOrder(h.conv,'customer',h.conv.sessionData,{skipFinalConfirm:true});expect(h.conv.sessionData).toEqual(held);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.replies.at(-1)).toMatch(/preparaci[oó]n/);return;}
 if(path==='interruption')for(const text of ['confirmar','sí','no broaster','quiero un combo de pollo frito','¿Cuánto vale?']){await h.sendQueued(text);expect(h.conv.sessionData).toEqual(held);expect(h.service.ordersService.create).not.toHaveBeenCalled();}
 if(path==='removed'){menu[0].availableNow=false;h.cfg.ignoreBusinessHours=false;}
 if(path==='option changed')menu[0].attributes[0].options=[m.a];
 if(path==='price changed')menu[0].price=21000;
 if(path==='cart limit')(h.cfg as any).maxTotalUnits=1;
 if(path==='closed'){h.cfg.ignoreBusinessHours=false;h.service.businessService.getStatus=jest.fn().mockResolvedValue({isOpen:false});}
 await h.sendQueued('1');
 if(path==='price changed'){expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingMatch?.unitAttributeGroups).toEqual(held.pendingMatch?.unitAttributeGroups);expect(h.replies.at(-1)).toMatch(/precio.*cambi[oó]/i);await h.sendQueued('1');}
 if(['removed','option changed','cart limit','closed'].includes(path)){expect(h.conv.sessionData).toEqual(held);expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.replies.at(-1)).toMatch(/no est[aá] disponible|opciones.*cambiaron|m[aá]ximo|l[ií]mite|unidades|cerrado/i);return;}
 const rows=h.conv.sessionData.cart;expect(rows.map(r=>[r.productId,r.quantity])).toEqual([[9751,1],[9751,1]]);expect(rows.map(r=>r.attributes?.find(a=>a.attributeName===m.key)?.attributeValue)).toEqual([m.a,m.b]);expect(rows.map(r=>r.attributes?.find(a=>a.attributeName==='Bebida')?.attributeValue)).toEqual(['Agua','Cola']);expect(rows.every(r=>r.attributes?.some(a=>a.attributeName==='Entrada'&&a.attributeValue==='Crema'))).toBe(true);
 const cart=structuredClone(rows);await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toEqual(cart.map(r=>({productId:r.productId,attributes:r.attributes,note:r.note})));
});

for(const id of [28,44,50])for(const agent of [false,true])it(`a separate preexisting drink remains separate ${id}/${agent}`,async()=>{
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);const p=products.find((p:any)=>p.id===id);h.conv.sessionData.cart=[{productId:id,name:p.name,code:p.code,quantity:1,unitPrice:p.price,note:'Sin hielo',attributes:[]}];const before=structuredClone(h.conv.sessionData.cart[0]);
 await h.sendQueued('Quiero un pollito frito de combo con gaseosa colombiana y con las arepas fritas.');expect(h.conv.sessionData.cart[0]).toEqual(before);expect(h.conv.sessionData.cart.filter(r=>r.productId===99)).toHaveLength(1);expect(h.conv.sessionData.cart).toHaveLength(2);
});

for(const agent of [false,true])it(`new combo retains side preparation and recipient agent=${agent}`,async()=>{
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('Hola Buenos dias me envias Un combo De Pollo broaster con papas saladas es Para los gemelos');expect(h.conv.sessionData.customerNotes).toMatch(/para los gemelos/i);expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:98,quantity:1,note:expect.stringMatching(/papas saladas/i)});expect(h.replies.at(-1)).toMatch(/papas saladas/i);
});

for(const agent of [false,true])it(`a separate box does not change combo identity agent=${agent}`,async()=>{
 const menu=[{id:9801,code:81,name:'Combo De Pollo Frito',price:30000,hasAttributes:false,availableNow:true,attributes:[]},{id:9802,code:82,name:'Medio Pollo Frito',price:15000,hasAttributes:false,availableNow:true,attributes:[]}];const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('Agradezco si me alistan un Combo De Pollo Frito pero medio pollo en caja diferente');expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:9801,quantity:1,note:expect.stringMatching(/caja diferente/i)});
});
