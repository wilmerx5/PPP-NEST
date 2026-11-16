import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { isDeliveryEtaInquiry } from './whatsapp-session-intents';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';
const call=(name:string,args:unknown)=>({id:'call-'+name,type:'function',function:{name,arguments:JSON.stringify(args)}});
const answer=(content:string|null,calls?:unknown[])=>new Response(JSON.stringify({choices:[{message:{content,tool_calls:calls}}]}),{status:200});
const menus=[{subject:'menudencia',plural:'menudencias',dish:'Sopa De Menudencias',combo:'Combo De Pollo Frito'},
 {subject:'vegetales',plural:'vegetales',dish:'Caldo De Vegetales',combo:'Combo De Tofu'}].map((data,index)=>({data,products:[
 {id:55001+index*10,code:1,name:data.dish,price:12000,availableNow:true,attributes:[]},
 {id:55002+index*10,code:2,name:data.dish+' Pequeña',price:10000,availableNow:true,attributes:[]},
 {id:55003+index*10,code:3,name:data.combo,price:53000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Ginger']},{attributeName:'Arepas',options:['Blancas','Fritas']}]},
]}));
const cfg={openaiApiKey:'synthetic',openaiModel:'gpt-4o-mini',systemPrompt:'',aiTemperature:0.2,localContext:{},paymentMethods:DEFAULT_PAYMENT_METHODS};
function setup(products=menus[0].products){
 const h=harness(products,true);h.conv.customerName='Reny';h.conv.sessionData={cart:[],orderType:'delivery'};
 h.service.settingsService.semanticRoutingEnabled=()=>true;
 h.service.agentService={runTurn:jest.fn().mockRejectedValue(new Error('A closed stock question requires no inference'))};
 h.service.conversationService.saveSemanticSession=jest.fn(async(_conv,expected,next,state,name)=>{
  if(h.conv.state!==expected.state||JSON.stringify(h.conv.sessionData)!==JSON.stringify(expected.session))return false;
  h.conv.sessionData=structuredClone(next);h.conv.state=state;if(name)h.conv.customerName=name;return true;
 });return h;
}
beforeEach(()=>jest.spyOn(global,'fetch').mockRejectedValue(new Error('Unexpected network in free regression')));
afterEach(()=>jest.restoreAllMocks());
for(const {data,products} of menus) for(const text of [`le queda ${data.subject}?`,`¿Le quedan ${data.plural}?`,`Todavía les queda ${data.subject} porfa`,`Buenas noches\nle queda ${data.subject}?`])
 for(const state of ['building_cart','awaiting_name','awaiting_address','awaiting_payment','awaiting_final_confirm']) it(`stock inquiry preserves checkout ${data.subject}/${state}/${text}`,async()=>{
  const h=setup(products);h.conv.state=state;
  if(state!=='building_cart')h.conv.sessionData.cart=[{productId:products[2].id,code:products[2].code,name:products[2].name,quantity:1,unitPrice:53000,attributes:[{attributeName:'Bebida',attributeValue:'Ginger'}]}];
  if(state==='awaiting_address')h.conv.sessionData.pendingMatch={query:'otra compra',intent:'order',quantity:1,candidates:products.slice(0,2)};
  const prior=structuredClone(h.conv.sessionData);const reply=await h.sendQueued(text);
  expect(reply).toContain(data.dish);expect(reply).not.toMatch(/aclaras qué quieres|no entend|demora|35-45|te lo agrego|escribe el número/i);
  if(text.startsWith('Buenas'))expect(reply).toMatch(/hola/i);
  expect(h.conv.sessionData).toEqual(prior);expect(h.conv.state).toBe(state);expect(h.service.agentService.runTurn).not.toHaveBeenCalled();expect(global.fetch).not.toHaveBeenCalled();
 });
for(const state of ['building_cart','awaiting_payment']) for(const subject of ['langosta','centolla']) it(`unknown stock subject is answered without a phantom item ${state}/${subject}`,async()=>{
 const h=setup();h.conv.state=state;const before=structuredClone(h.conv.sessionData);
 expect(await h.sendQueued(`le queda ${subject}?`)).toMatch(new RegExp(subject));
 expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
});
for(const text of ['le queda menudencia?','le quedan vegetales?','dónde queda el restaurante?','cuánto vale la menudencia?']) it(`delivery-time capability rejects an unrelated inquiry ${text}`,async()=>{
 const agent=new WhatsappAgentService({getEffectiveConfig:async()=>cfg} as never,new WhatsappCatalogService({} as never));
 const network=jest.spyOn(global,'fetch').mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'inquiry',productIds:[]}]})]))
  .mockResolvedValueOnce(answer(null,[call('delivery_time',{sourceText:'Cuánto tarda el domicilio?'})]))
  .mockResolvedValueOnce(answer('Respondo la consulta actual.'));
 const result=await agent.runTurn({semanticInterpretation:true,userMessage:text,products:menus[0].products,cart:[],sessionSummary:'',recentMessages:[],businessRulesBlock:'Abierto',brandName:'Restaurante'});
 expect(result.lookupDeliveryTime).toBe(false);expect(result.actions).toEqual({});
 expect(String(network.mock.calls[2][1]?.body)).toContain('delivery_time_not_requested');
});
for(const {text,recognized} of [{text:'Cuánto le queda al pedido?',recognized:true},{text:'Cuánto se demora el domicilio?',recognized:true},{text:'En cuánto llega?',recognized:true},{text:'A qué hora me lo llevarían?',recognized:false},{text:'Para cuándo más o menos?',recognized:false}]) it(`a real timing question retains the delivery capability ${text}`,async()=>{
 expect(isDeliveryEtaInquiry(text)).toBe(recognized);
 const agent=new WhatsappAgentService({getEffectiveConfig:async()=>cfg} as never,new WhatsappCatalogService({} as never));
 jest.spyOn(global,'fetch').mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'inquiry',productIds:[]}]})]))
  .mockResolvedValueOnce(answer(null,[call('delivery_time',{sourceText:text})]))
  .mockResolvedValueOnce(answer('El backend responde el tiempo.'));
 const result=await agent.runTurn({semanticInterpretation:true,userMessage:text,products:menus[0].products,cart:[],sessionSummary:'',recentMessages:[],businessRulesBlock:'Abierto',brandName:'Restaurante'});
 expect(result.lookupDeliveryTime).toBe(true);expect(result.actions).toEqual({});
});
for(const {data,products} of menus) it(`repeated stock questions then a new combo close once ${data.subject}`,async()=>{
 const h=setup(products);await h.sendQueued(`le queda ${data.subject}?`);await h.sendQueued(`le queda ${data.subject}?`);
 expect(h.conv.sessionData.cart).toEqual([]);
 h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>cfg} as never,new WhatsappCatalogService({} as never));
 const text=`me da un ${data.combo} con ginger por favor`;
 jest.spyOn(global,'fetch').mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[products[2].id]}]})]))
  .mockResolvedValueOnce(answer(null,[call('add_item',{sourceText:text,productId:products[2].id,quantity:1,attributes:[{attributeName:'Bebida',attributeValue:'Ginger'},{attributeName:'Arepas',attributeValue:'Blancas'}]})]))
  .mockResolvedValueOnce(answer('Listo'));
 await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:products[2].id,quantity:1,attributes:expect.arrayContaining([{attributeName:'Bebida',attributeValue:'Ginger'}])})]);
 await h.sendQueued('',{messageType:'location',latitude:4.6328523,longitude:-74.1525746});
 await h.sendQueued('319 7724400');await h.sendQueued('1');
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:550,dailyOrderNumber:550});
 await h.sendQueued('confirmar');expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(1);
});

it('stock results match catalogue words without matching a dessert substring',async()=>{
 const products=[{id:55090,code:90,name:'Filete De Res',categoryName:'Carnes',price:40000,availableNow:true,attributes:[]},
 {id:55091,code:91,name:'Flan De Caramelo',categoryName:'Postres',price:10000,availableNow:true,attributes:[]}];
 const h=setup(products as never);const reply=await h.sendQueued('le queda carne?');
 expect(reply).toContain('Filete De Res');expect(reply).not.toContain('Flan De Caramelo');expect(h.conv.sessionData.cart).toEqual([]);
});

for(const text of ['le queda menudencia? me da un combo de pollo frito','le queda menudencia? cambia la bebida a Ginger']) it(`mixed information and actions keep the whole semantic entry point ${text}`,async()=>{
 const h=setup();h.service.agentService.runTurn.mockResolvedValue({reply:'Revisar el alcance',actions:{},toolCalls:[],error:'synthetic_review'});
 await h.sendQueued(text);expect(h.service.agentService.runTurn).toHaveBeenCalledTimes(1);
 expect(h.service.agentService.runTurn.mock.calls[0][0].userMessage).toBe(text);expect(h.conv.sessionData.cart).toEqual([]);
});
for(const state of ['building_cart','awaiting_payment']) it(`unavailable stock is not presented as available ${state}`,async()=>{
 const products=menus[0].products.map(product=>({...product,availableNow:product.id===55003}));
 const h=setup(products);h.conv.state=state;const prior=structuredClone(h.conv.sessionData);
 const reply=await h.sendQueued('le queda menudencia?');expect(reply).toMatch(/no veo.*disponible/i);expect(reply).not.toMatch(/12[.]000|10[.]000|te lo agrego/i);
 expect(h.conv.sessionData).toEqual(prior);expect(h.conv.state).toBe(state);
});
