import {harness} from './whatsapp-accuracy.test-support';
function menu(){return [
 {id:8501,code:85,name:'Combo Arroz Chino Con Costillas De Cerdo',price:56000,description:'Arroz chino para 2 a 4 personas, costillas de cerdo de 400 gramos, papa francesa y bebida de 1.5L.',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Manzana','Pepsi']}]},
 {id:8502,code:97,name:'Combo Arroz Chino Con Medio Pollo',price:54000,description:'Arroz chino para 2 a 4 personas con medio pollo, papa francesa y bebida de 1.5L.',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Manzana','Pepsi']},{attributeName:'Pollo',options:['Frito','Broaster']}]},
 {id:8503,code:26,name:'Arroz Chino',price:38000,description:'Caja para 2 a 4 personas con papa francesa.',availableNow:true,attributes:[]},
 {id:8601,code:28,name:'Gaseosa 400ml',price:4000,description:'Botella personal de 400ml.',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Colombiana','Pepsi']}]},
 {id:8701,code:53,name:'Papa Francesa',price:8000,description:'Porcion individual de papa francesa.',availableNow:true,attributes:[]},
 {id:8602,code:42,name:'Gaseosa 1.5L',price:8000,description:'Botella de litro y medio.',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Colombiana','Pepsi']}]},
 ];}
function setup(agent=true,cart=true){const products=menu(),h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:518,dailyOrderNumber:518});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 if(cart){h.conv.sessionData.cart=[{productId:8502,code:97,name:products[1].name,unitPrice:54000,quantity:1,note:'Salsas aparte',attributes:[{attributeName:'Bebida',attributeValue:'Colombiana'},{attributeName:'Pollo',attributeValue:'Frito'}]}];h.conv.sessionData.productFocus={productId:8502,name:products[1].name};}
 return {h,products};}
for(const text of ['Que otro sabor de gaseosa tienes?','Cambio bebida','Cambio de gaseosa','No.. Arreglar','Si'])test(`unsafe model edit cannot change an unchosen option ${text}`,async()=>{
 const {h}=setup();h.agent.runTurn.mockResolvedValue({reply:'Listo, cambié la opción.',actions:{updateUnitOptions:[{productId:8502,cartLineIndex:0,affectedQuantity:1,attributes:[{attributeName:text.includes('Arreglar')?'Pollo':'Bebida',attributeValue:text.includes('Arreglar')?'Broaster':'Pepsi'}]}]},toolCalls:['update_item']});
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
test('generic combo quote lists both preparations and follow-up retains those products',async()=>{
 const {h}=setup(false,false);const reply=await h.sendQueued('me gustaría sabe a que precio tienes el combo de arroz chino');
 expect(reply).toMatch(/Costillas/);expect(reply).toMatch(/Medio Pollo/);expect(h.conv.sessionData.cart).toEqual([]);
 const follow=await h.sendQueued('y como vienes ?');expect(follow).toMatch(/Costillas/);expect(follow).toMatch(/Medio Pollo/);expect(follow).not.toMatch(/38[.,]000/);expect(h.conv.sessionData.cart).toEqual([]);
});
test('one-person portion inquiry gives actual catalog detail instead of fallback',async()=>{
 const {h}=setup(false,false);const reply=await h.sendQueued('Una porción de arroz chino con pollo pero para una sola persona tienes');
 expect(reply).toMatch(/2 a 4 personas/);expect(reply).not.toMatch(/No entend[ií]|ll[aá]manos/i);expect(h.conv.sessionData.cart).toEqual([]);
});
for(const agent of [false,true])test(`reported chat preserves every actual choice through checkout ${agent}`,async()=>{
 const {h}=setup(agent,false);Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 const first=await h.sendQueued('me gustaría sabe a que precio tienes el combo de arroz chino');expect(first).toMatch(/Costillas/);expect(first).toMatch(/Medio Pollo/);
 const second=await h.sendQueued('y como vienes ?');expect(second).toMatch(/Costillas/);expect(second).toMatch(/Medio Pollo/);expect(second).not.toMatch(/38[.,]000/);
 await h.sendQueued('Ya no viene con pollo ??');expect(h.conv.sessionData.cart).toEqual([]);
 const piece=await h.sendQueued('No venia con pierna pernil ?');expect(piece).toMatch(/medio pollo/i);expect(piece).not.toMatch(/viene con una pierna|pierna pernil sola/i);
 const acceptance=await h.sendQueued('Si');expect(h.conv.sessionData.cart).toEqual([]);expect(acceptance).toMatch(/Frito/);expect(acceptance).toMatch(/Broaster/);await h.sendQueued('Frito');expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.cart[0]).toMatchObject({productId:8502,quantity:1});
 const before=structuredClone(h.conv.sessionData.cart);
 for(const text of ['No.. Arreglar','Que otro sabor de gaseosa tienes?','Cambio bebida','Cambio de gaseosa','Si']){await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(before);}
 await h.sendQueued('Con pepsi');expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Pepsi'});expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Pollo',attributeValue:'Frito'});
 await h.sendQueued('Nada mas');await h.sendQueued('efectivo');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
});
for(const agent of [false,true])for(const state of ['building_cart','awaiting_final_confirm'])for(const answer of ['3','Con Pepsi'])test(`a drink choice needs a value ${agent} ${state} ${answer}`,async()=>{
 const {h}=setup(agent);h.conv.state=state;const before=structuredClone(h.conv.sessionData.cart);
 const prompt=await h.sendQueued('Cambio de gaseosa');expect(prompt).toMatch(/Colombiana/);expect(prompt).toMatch(/Manzana/);expect(prompt).toMatch(/Pepsi/);expect(prompt).not.toMatch(/Algo más/i);
 expect(h.conv.sessionData.cart).toEqual(before);
 for(const question of ['cuanto vale?','que trae el combo?','Si']){await h.sendQueued(question);expect(h.conv.sessionData.cart).toEqual(before);}
 await h.sendQueued(answer);expect(h.conv.state).toBe(state);expect(h.conv.sessionData.cart[0]).toMatchObject({...before[0],attributes:[{attributeName:'Pollo',attributeValue:'Frito'},{attributeName:'Bebida',attributeValue:'Pepsi'}]});
 expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
});
for(const scenario of ['cancel','cart changed','options changed','price changed','unavailable','expired'])test(`a stale drink list is never applied ${scenario}`,async()=>{
 const {h,products}=setup();await h.sendQueued('Cambio bebida');
 if(scenario==='cart changed')h.conv.sessionData.cart[0].quantity=2;
 if(scenario==='options changed')products[1].attributes![0].options.reverse();
 if(scenario==='price changed')products[1].price+=1000;
 if(scenario==='unavailable')products[1].availableNow=false;
 if(scenario==='expired')h.conv.sessionData.pendingCartOptionChoice!.createdAt-=11*60*1000;
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(scenario==='cancel'?'cancela ese cambio':'1');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
});
for(const agent of [false,true])test(`several meals require the drink owner first ${agent}`,async()=>{
 const {h,products}=setup(agent);h.conv.sessionData.cart.push({productId:8501,code:85,name:products[0].name,unitPrice:56000,quantity:2,attributes:[{attributeName:'Bebida',attributeValue:'Manzana'}],note:'Otra persona'});
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Cambio bebida');expect(h.conv.sessionData.cart).toEqual(before);
 await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('3');expect(h.conv.sessionData.cart[0]).toEqual(before[0]);expect(h.conv.sessionData.cart[1]).toMatchObject({...before[1],attributes:[{attributeName:'Bebida',attributeValue:'Pepsi'}]});
});
for(const agent of [false,true])for(const choose of ['2','Gaseosa 1.5L','#42'])test(`ambiguous purchase survives price and content questions ${agent} ${choose}`,async()=>{
 const {h}=setup(agent);Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 const before=structuredClone(h.conv.sessionData.cart);const request=await h.sendQueued('cambia el combo arroz chino con medio pollo a broaster y agrega dos gaseosas y una Papa Francesa');
 expect(request).toMatch(/Gaseosa 400ml/);expect(request).toMatch(/Gaseosa 1.5L/);expect(h.conv.sessionData.cart).toEqual(before);
 const pending=structuredClone(h.conv.sessionData.pendingCartReplacement);
 const price=await h.sendQueued('cuanto vale la segunda opcion?');expect(price).toMatch(/8[.,]000/);expect(h.conv.sessionData.pendingCartReplacement).toEqual(pending);
 const contents=await h.sendQueued('que trae la segunda opcion?');expect(contents).toMatch(/litro y medio/);expect(h.conv.sessionData.pendingCartReplacement).toEqual(pending);expect(h.conv.sessionData.cart).toEqual(before);
 await h.sendQueued('Si');expect(h.conv.sessionData.cart).toEqual(before);
 const flavor=await h.sendQueued(choose);expect(flavor).toMatch(/Sabor/i);expect(h.conv.sessionData.cart).toEqual(before);
 const waiting=structuredClone(h.conv.sessionData.pendingCartReplacement);const meal=await h.sendQueued('que trae el combo arroz chino con medio pollo?');expect(meal).toMatch(/medio pollo/);expect(h.conv.sessionData.pendingCartReplacement).toEqual(waiting);
 await h.sendQueued('Pepsi');expect(h.conv.sessionData.cart).toHaveLength(3);expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Pollo',attributeValue:'Broaster'});
 expect(h.conv.sessionData.cart.find(line=>line.productId===8602)).toMatchObject({quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Pepsi'}]});expect(h.conv.sessionData.cart.find(line=>line.productId===8701)).toMatchObject({quantity:1});
 await h.sendQueued('nada mas');await h.sendQueued('efectivo');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(4);
});
for(const agent of [false,true])test(`source inquiry does not select a cart line ${agent}`,async()=>{
 const {h}=setup(agent);h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[0]),note:'Otra persona'});const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('cambia el combo arroz chino con medio pollo a broaster y agrega dos gaseosas y una Papa Francesa');
 const pending=structuredClone(h.conv.sessionData.pendingCartReplacement);const price=await h.sendQueued('cuanto vale la segunda?');expect(price).toMatch(/54[.,]000/);expect(h.conv.sessionData.pendingCartReplacement).toEqual(pending);expect(h.conv.sessionData.cart).toEqual(before);
 await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('Pepsi');
 expect(h.conv.sessionData.cart[0]).toEqual(before[0]);expect(h.conv.sessionData.cart[1].attributes).toContainEqual({attributeName:'Pollo',attributeValue:'Broaster'});expect(h.conv.sessionData.cart.find(line=>line.productId===8601)).toMatchObject({quantity:2});
});
for(const scenario of ['cancel','whole cancel','expired','cart changed','candidate price','candidate unavailable','invalid','question','plain yes'])test(`ambiguous product choice guard ${scenario}`,async()=>{
 const {h,products}=setup();await h.sendQueued('cambia el combo arroz chino con medio pollo a broaster y agrega dos gaseosas y una Papa Francesa');
 expect(h.conv.sessionData.pendingCartReplacement?.mixedPurchase?.choosing).toBe('product');
 if(scenario==='expired')h.conv.sessionData.pendingCartReplacement!.mixedPurchase!.createdAt-=11*60*1000;
 if(scenario==='cart changed')h.conv.sessionData.cart[0].quantity=2;
 if(scenario==='candidate price')products.find(p=>p.id===8602)!.price+=1000;
 if(scenario==='candidate unavailable')products.find(p=>p.id===8602)!.availableNow=false;
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(scenario==='cancel'?'cancela ese cambio':scenario==='whole cancel'?'cancelar pedido':scenario==='invalid'?'99':scenario==='question'?'¿2?':scenario==='plain yes'?'Si':'2');
 expect(h.service.ordersService.create).not.toHaveBeenCalled();if(scenario==='whole cancel')expect(h.conv.sessionData.cart).toEqual([]);else expect(h.conv.sessionData.cart).toEqual(before);
});
for(const agent of [false,true])test(`an explicit individual product is preferred for a one-person inquiry ${agent}`,async()=>{
 const {h,products}=setup(agent,false);products.push({id:8801,code:88,name:'Porcion Individual Arroz Chino Con Pollo',price:18000,description:'Porcion para una persona con papa francesa.',availableNow:true,attributes:[]});
 const reply=await h.sendQueued('Una porción de arroz chino con pollo pero para una sola persona tienes');expect(reply).toMatch(/Individual/);expect(reply).toMatch(/18[.,]000/);expect(reply).not.toMatch(/2 a 4 personas/);expect(h.conv.sessionData.cart).toEqual([]);
});
for(const kind of ['updateAttributes','updateUnitOptions'])for(const text of ['Si','No.. Arreglar','Cambio bebida','Que otro sabor de gaseosa tienes?','que trae el combo con Pepsi?','Manzana 5 casa 20'])test(`guard rejects invented catalog-valid preferences ${kind} ${text}`,()=>{
 const {h,products}=setup();const actions=kind==='updateAttributes'?{updateAttributes:[{productId:8502,cartLineIndex:0,attributeName:'Bebida',attributeValue:text.startsWith('Manzana')?'Manzana':'Pepsi'}]}:
  {updateUnitOptions:[{productId:8502,cartLineIndex:0,affectedQuantity:1,attributes:[{attributeName:'Bebida',attributeValue:text.startsWith('Manzana')?'Manzana':'Pepsi'}]}]};
 const result=h.service.actionGuard.sanitize({actions,products,cart:h.conv.sessionData.cart,sourceText:text,businessOpen:true,allowMercadoPago:false});expect(result.actions).toBeUndefined();expect(result.requiresOptionChoice).toBe(true);
});
for(const text of ['con Pepsi','cámbialo a Pepsi','Pepsi'])test(`guard keeps a genuinely stated preference ${text}`,()=>{
 const {h,products}=setup();const result=h.service.actionGuard.sanitize({actions:{updateAttributes:[{productId:8502,cartLineIndex:0,attributeName:'Bebida',attributeValue:'Pepsi'}]},products,cart:h.conv.sessionData.cart,sourceText:text,businessOpen:true,allowMercadoPago:false});expect(result.actions?.updateAttributes).toHaveLength(1);
});
test('different stated choices in one grouped edit remain valid',()=>{
 const {h,products}=setup();h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[0]),note:'Otro plato'});
 const actions={updateUnitOptions:[{productId:8502,cartLineIndex:0,affectedQuantity:1,attributes:[{attributeName:'Bebida',attributeValue:'Pepsi'}]},
 {productId:8502,cartLineIndex:1,affectedQuantity:1,attributes:[{attributeName:'Bebida',attributeValue:'Manzana'}]}]};
 const result=h.service.actionGuard.sanitize({actions,products,cart:h.conv.sessionData.cart,sourceText:'el primero con Pepsi y el segundo con Manzana',businessOpen:true,allowMercadoPago:false});expect(result.actions?.updateUnitOptions).toHaveLength(2);
});
for(const agent of [false,true])test(`a different restaurant retains generic combo alternatives ${agent}`,async()=>{
 const products=[{id:9101,code:31,name:'Combo Falafel Con Hummus',price:19000,description:'Falafel con hummus y limonada.',availableNow:true,attributes:[]},{id:9102,code:32,name:'Combo Falafel Con Tabule',price:21000,description:'Falafel con tabule y té.',availableNow:true,attributes:[]}];
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
 const first=await h.sendQueued('cuanto cuesta el combo falafel');expect(first).toMatch(/Hummus/);expect(first).toMatch(/Tabule/);expect(h.conv.sessionData.cart).toEqual([]);
 const second=await h.sendQueued('y como viene?');expect(second).toMatch(/hummus/);expect(second).toMatch(/tabule/);expect(h.conv.sessionData.cart).toEqual([]);
 await h.sendQueued('Si');expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const agent of [false,true])test(`two generic purchases remain separate until both flavors are chosen ${agent}`,async()=>{
 const {h}=setup(agent);const before=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('cambia el combo arroz chino con medio pollo a broaster y agrega dos gaseosas y una gaseosa');expect(h.conv.sessionData.cart).toEqual(before);
 await h.sendQueued('1');await h.sendQueued('Pepsi');expect(h.conv.sessionData.cart).toEqual(before);
 const prompt=await h.sendQueued('2');expect(prompt).toMatch(/Sabor/i);expect(h.conv.sessionData.cart).toEqual(before);
 await h.sendQueued('Colombiana');expect(h.conv.sessionData.cart).toHaveLength(3);
 expect(h.conv.sessionData.cart.find(line=>line.productId===8601)).toMatchObject({quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Pepsi'}]});
 expect(h.conv.sessionData.cart.find(line=>line.productId===8602)).toMatchObject({quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Colombiana'}]});
});
for(const agent of [false,true])test(`an accompaniment question keeps the existing information route ${agent}`,async()=>{
 const {h,products}=setup(agent);h.conv.sessionData.cart.push({productId:8503,code:26,name:products[2].name,unitPrice:38000,quantity:1,attributes:[]});
 h.agent.runTurn.mockResolvedValue({reply:'Sí, las papas están incluidas en el combo.',actions:{},toolCalls:['search_menu']});const before=structuredClone(h.conv.sessionData.cart);
 const reply=await h.sendQueued('Antes de pagar, el combo trae papas o se cobran aparte?');expect(reply).not.toMatch(/Cuál presentación quieres consultar/);expect(h.conv.sessionData.pendingCatalogInquiry).toBeUndefined();expect(h.conv.sessionData.cart).toEqual(before);
});
