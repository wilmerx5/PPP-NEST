import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';
import { canonicalStreetAddress } from './whatsapp-address-parts';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const call=(name:string,args:unknown)=>({id:'call-'+name,type:'function',function:{name,arguments:JSON.stringify(args)}});
const answer=(content:string|null,calls?:unknown[])=>new Response(JSON.stringify({choices:[{message:{content,tool_calls:calls}}]}),{status:200});
const menus=[
  {host:'Pollo',known:'Broaster',missing:'asado',spoken:'broster'},
  {host:'Tofu',known:'Plancha',missing:'broaster',spoken:'plancha'},
].map(config=>({config,products:[
  {id:54704,code:4,name:`1 ${config.host} ${config.known}`,price:46000,availableNow:true,hasAttributes:true,
    attributes:[{attributeName:'Arepas',options:['Blancas','Fritas']}]},
  {id:54701,code:1,name:`1 ${config.host} Frito`,price:44000,availableNow:true,hasAttributes:true,
    attributes:[{attributeName:'Arepas',options:['Blancas','Fritas']}]},
]}));
function setup(products=menus[0].products){
  const h=harness(products,true);h.conv.sessionData={cart:[],orderType:'delivery'};
  h.service.settingsService.semanticRoutingEnabled=()=>true;
  h.service.conversationService.getRecentMessageTexts=jest.fn().mockResolvedValue([]);
  h.service.conversationService.saveSemanticSession=jest.fn(async(_conv,expected,next,state,name)=>{
    if(h.conv.state!==expected.state || JSON.stringify(h.conv.sessionData)!==JSON.stringify(expected.session))return false;
    h.conv.sessionData=structuredClone(next);h.conv.state=state;if(name)h.conv.customerName=name;return true;
  });
  h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'synthetic-key',openaiModel:'gpt-4o-mini',
    systemPrompt:'',aiTemperature:0.2,localContext:{},paymentMethods:DEFAULT_PAYMENT_METHODS})} as never,new WhatsappCatalogService({} as never));
  return h;
}
beforeEach(()=>jest.spyOn(global,'fetch').mockRejectedValue(new Error('Network blocked in free regression')));
afterEach(()=>jest.restoreAllMocks());

for(const {config,products} of menus) for(const missingQty of [1,2]) for(const missingFirst of [true,false]) it(`mixed missing preparation keeps a choice and reaches checkout ${config.host}/${missingQty}/${missingFirst}`,async()=>{
  const h=setup(products);
  const missing=`${missingQty} ${config.host.toLowerCase()} ${config.missing}`;
  const known=config.host==='Pollo'?config.spoken:config.host+' '+config.spoken;
  const text=missingFirst ? `Me hace el favor y me regala ${missing} y uno ${known}\nPor favor`
    : `Me hace el favor y me regala un ${config.host} ${config.spoken} y ${missing}\nPor favor`;
  const query=`${config.host.toLowerCase()} ${config.missing}`;
  const network=jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[]}]})]))
    .mockResolvedValueOnce(answer(null,[call('resolve_multi_order',{text,sourceText:text})]))
    .mockResolvedValueOnce(answer(null,[call('search_menu',{query,sourceText:text})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{sourceText:text,productId:54704,quantity:1})]))
    .mockResolvedValueOnce(answer('Agregué el disponible. La otra preparación está ausente.'));
  const first=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:54704,quantity:1})]);
  expect(h.conv.sessionData.pendingMatch).toMatchObject({quantity:missingQty,intent:'order',semanticOffer:true});
  expect(first).toMatch(/no tenemos/i);expect(first).toContain(config.known);expect(first).toContain('Frito');
  expect(first).not.toMatch(/aclaras qué quieres|Algo más/i);
  const note='Con ají';
  network.mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text:note,role:'edit',productIds:[54704]}]})]))
    .mockResolvedValueOnce(answer(null,[call('update_item',{sourceText:note,productId:54704,cartLineIndex:0,note})]))
    .mockResolvedValueOnce(answer('Anotado'));
  const second=await h.sendQueued(note);
  expect(h.conv.sessionData.cart[0].note).toMatch(/ají/i);expect(h.conv.sessionData.pendingMatch.quantity).toBe(missingQty);
  expect(second).not.toMatch(/aclaras qué quieres|Algo más/i);
  const pending=structuredClone(h.conv.sessionData.pendingMatch);
  h.service.agentService={runTurn:jest.fn().mockResolvedValue({reply:'',actions:{},toolCalls:[],error:'semantic_contract_rejected'})};
  const unclear=await h.sendQueued('El plato muy bien cocido');
  expect(unclear).toMatch(/Frito/);expect(unclear).not.toMatch(/aclaras qué quieres/i);
  expect(h.conv.sessionData.pendingMatch).toEqual(pending);
  const index=h.conv.sessionData.pendingMatch.candidates.findIndex(item=>item.id===54701)+1;
  await h.sendQueued(String(index));
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart.find(item=>item.productId===54701).quantity).toBe(missingQty);
  expect(h.conv.sessionData.cart.find(item=>item.productId===54704).quantity).toBe(1);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:547,dailyOrderNumber:547});
  await h.sendQueued('No señor');await h.sendQueued('Carrera 79 c 6 a 08');await h.sendQueued('Nequi');
  expect(await h.sendQueued('Confírmar')).toMatch(/registrado/i);
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(missingQty+1);
});

it('a repeated word with a vowel hesitation is normalized only for the catalogue lookup',async()=>{
  const h=setup();const text='Me hace el favor y me regala un pollo asadouuu asado y uno broster\nPor favor';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[]}]})]))
    .mockResolvedValueOnce(answer(null,[call('resolve_multi_order',{text,sourceText:text})]))
    .mockResolvedValueOnce(answer(null,[call('search_menu',{query:'pollo asadouuu asado',sourceText:text})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{sourceText:text,productId:54704,quantity:1})]))
    .mockResolvedValueOnce(answer('No tenemos asado.'));
  const reply=await h.sendQueued(text);
  expect(reply).toMatch(/no tenemos \*pollo asado\*/i);
  expect(h.conv.sessionData.pendingMatch).toMatchObject({query:text,quantity:1});
  expect(h.conv.sessionData.cart).toHaveLength(1);
});

for(const confirmed of [false,true]) it(`a landmark supplements the written street ${confirmed}`,async()=>{
  const h=setup();h.conv.state='awaiting_address';
  h.conv.sessionData={cart:[{productId:54704,name:'1 Pollo Broaster',code:4,quantity:1,unitPrice:46000,attributes:[]}],
    orderType:'delivery',address:'Carrera 79 c 6 a 08',addressConfirmed:confirmed,fulfillmentChosen:true,
    ...(confirmed?{deliveryLat:4.63,deliveryLng:-74.15,deliveryFeeCalculated:2000,deliveryDistanceKm:0.8}:{})};
  const reply=await h.sendQueued('Al frente del conjunto villagalante');
  expect(h.conv.sessionData.address).toMatch(/79 c 6 a 08/i);
  expect(h.conv.sessionData.address).toMatch(/frente.*villagalante/i);
  expect(h.conv.sessionData.cart).toHaveLength(1);expect(reply).not.toMatch(/Encontré este posible lugar|aclaras qué quieres/i);
  expect(global.fetch).not.toHaveBeenCalled();
});

for(const written of ['Carrera 79 c 6 a 08','CR 79C #6A-8','Cra 079C #006A-008']) {
  it(`canonical street normalizes numeric padding ${written}`,()=>expect(canonicalStreetAddress(written)).toBe('Carrera 79C # 6A-8'));
  for(const supplied of ['Carrera 79C #6A-8','Carrera 79C #6A-08','Carrera 79C #6A-80','Carrera 79D #6A-8','Carrera 79C #6B-8','Carrera 79C #6A-8 Sur']) {
    it(`street agreement preserves exact identity ${written}/${supplied}`,()=>{
      const service=new WhatsappDeliveryRoutingService({get:()=> 'fixture-key'} as never) as any;
      expect(service.resultMatchesNamedPlace(written,{formatted_address:supplied,partial_match:false})).toBe(
        supplied==='Carrera 79C #6A-8' || supplied==='Carrera 79C #6A-08');
    });
  }
}

it('a missing-style price inquiry cannot become a pending purchase',async()=>{
  const h=setup();const text='Cuánto cuesta un pollo asado';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'inquiry',productIds:[]}]})]))
    .mockResolvedValueOnce(answer(null,[call('search_menu',{query:'pollo asado',sourceText:text})]))
    .mockResolvedValueOnce(answer('Por ahora no tenemos pollo asado. Tenemos frito y broaster.'));
  const reply=await h.sendQueued(text);
  expect(reply).toMatch(/no tenemos pollo asado/i);expect(h.conv.sessionData.cart).toHaveLength(0);
  expect(h.conv.sessionData.pendingMatch).toBeUndefined();
});

it('a conditional fallback does not create a second purchase for the unavailable dish',async()=>{
  const h=setup();const text='Si no hay pollo asado quiero uno broaster y una porción';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[]}]})]))
    .mockResolvedValueOnce(answer(null,[call('resolve_multi_order',{text,sourceText:text})]))
    .mockResolvedValueOnce(answer(null,[call('search_menu',{query:'pollo asado',sourceText:text})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{sourceText:text,productId:54704,quantity:1})]))
    .mockResolvedValueOnce(answer('Listo'));
  await h.sendQueued(text);
  expect(h.conv.sessionData.pendingMatch).toBeUndefined();
  expect(h.conv.sessionData.cart.filter(item=>item.productId===54701)).toHaveLength(0);
});

for(const {config,products} of menus) it(`search-only results must resolve the available purchase ${config.host}`,async()=>{
  const h=setup(products);const known=config.host==='Pollo'?config.spoken:config.host+' '+config.spoken;
  const text=`Me regala un ${config.host} ${config.missing} y uno ${known}`;
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[]}]})]))
    .mockResolvedValueOnce(answer(null,[call('search_menu',{sourceText:text,query:config.host+' '+config.missing})]))
    .mockResolvedValueOnce(answer('Hay otra preparación. ¿Quieres pedir alguno?'))
    .mockResolvedValueOnce(answer(null,[call('add_item',{sourceText:text,productId:54704,quantity:1})]))
    .mockResolvedValueOnce(answer('La compra disponible está lista.'));
  const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:54704,quantity:1})]);
  expect(h.conv.sessionData.pendingMatch).toMatchObject({quantity:1,semanticOffer:true});
  expect(reply).not.toMatch(/aclaras qué quieres|Algo más/i);
});

for (const {config,products} of menus) for (const text of ['1 frito','frito']) it(`pending preparation answer owns the offered purchase ${config.host}/${text}`,async()=>{
  const h=setup(products);
  h.conv.sessionData.cart=[{productId:54704,name:products[0].name,code:4,quantity:1,unitPrice:46000,note:'Con ají',attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]}];
  h.conv.sessionData.pendingMatch={intent:'order',semanticOffer:true,quantity:1,query:`${config.host} ${config.missing}`,candidates:products};
  h.service.agentService={runTurn:jest.fn().mockRejectedValue(new Error('An offered short choice must use its existing owner'))};
  await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart.find(item=>item.productId===54701)).toMatchObject({quantity:1});
  expect(h.conv.sessionData.cart.find(item=>item.productId===54704)).toMatchObject({quantity:1,note:'Con ají'});
  expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
});

for (const text of ['no frito','sin frito','que trae frito','frito?','pollo','2 frito','frito y broaster','cambia frito']) it(`a pending name resolver declines ambiguous or different intent ${text}`,()=>{
  const h=setup();
  const pending={intent:'order',semanticOffer:true,quantity:1,query:'pollo asado',candidates:menus[0].products};
  expect(h.service.resolvePendingPurchaseName(text,pending)).toBeNull();
});
