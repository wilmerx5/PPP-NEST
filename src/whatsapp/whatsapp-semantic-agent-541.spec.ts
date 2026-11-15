import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menu = ['Arroz Con Pollo','Lasaña Vegetal'].map((name,index)=>({id:54101+index,code:11+index,name,price:10000,availableNow:true,hasAttributes:false,attributes:[]}));
const call = (name: string,args: unknown) => ({id:`call-${name}`,type:'function',function:{name,arguments:JSON.stringify(args)}});
const answer = (content: string|null, calls?: unknown[]) => new Response(JSON.stringify({choices:[{message:{content,tool_calls:calls}}]}),{status:200});
function service() {
  return new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'synthetic-key',openaiModel:'gpt-4o-mini',
    systemPrompt:'test',aiTemperature:0.2,localContext:{},paymentMethods:DEFAULT_PAYMENT_METHODS})} as never,new WhatsappCatalogService({} as never));
}
const input = (text: string) => ({semanticInterpretation:true,userMessage:text,sessionSummary:'Carrito vacío. Pedido activo.',
  recentMessages:[],businessRulesBlock:'Abierto.',brandName:'Restaurante',products:menu,cart:[]});
afterEach(()=>jest.restoreAllMocks());

for (const product of menu) it(`literal intent precedes a purchase despite an unfamiliar introduction ${product.name}`,async()=>{
  const text=`Bueno, a ver si hoy sí me animo: dos ${product.name}`;
  const source=`dos ${product.name}`;
  const fetchMock=jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[
      {text:'Bueno, a ver si hoy sí me animo',role:'conversation',productIds:[]},{text:source,role:'purchase',productIds:[product.id]},
    ]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{productId:product.id,quantity:2,sourceText:source})]))
    .mockResolvedValueOnce(answer(''));
  const result=await service().runTurn(input(text));
  expect(result.error).toBeUndefined();
  expect(result.actions.addItems).toEqual([expect.objectContaining({productId:product.id,quantity:2})]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  const body=JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(body.tool_choice.function.name).toBe('interpret_message');
});

for (const role of ['inquiry','conversation','unclear']) it(`a later tool cannot turn ${role} into a purchase`,async()=>{
  const text='Estoy preguntando por el arroz con pollo';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role,productIds:[]}]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{productId:54101,quantity:1,sourceText:text})]))
    .mockResolvedValueOnce(answer('Lo añadí'));
  const result=await service().runTurn(input(text));
  expect(result.error).toBe('semantic_contract_rejected');expect(result.actions).toEqual({});
});

it('the model cannot drop a negation or replace an existing interpretation',async()=>{
  const text='No quiero otro arroz con pollo';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text:'quiero otro arroz con pollo',role:'purchase',productIds:[54101]}]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{productId:54101,quantity:1,sourceText:'quiero otro arroz con pollo'})]))
    .mockResolvedValueOnce(answer('Agregado'));
  const result=await service().runTurn(input(text));
  expect(result.actions).toEqual({});expect(result.error).toBe('semantic_contract_rejected');
});

it('provider failure after proposing an addition discards the whole proposal',async()=>{
  const text='Dos arroz con pollo';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[54101]}]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{productId:54101,quantity:2,sourceText:text})]))
    .mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'synthetic_failure'}}),{status:400}));
  const result=await service().runTurn(input(text));
  expect(result.error).toBe('openai_400');expect(result.actions).toEqual({});
});

it('checkout details retain separate literal name, phone and payment',async()=>{
  const text='Soy Natalia Campos, 3123456789, pago por nequi';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'checkout',productIds:[]}]})]))
    .mockResolvedValueOnce(answer(null,[call('set_checkout_details',{sourceText:text,customerName:'Natalia Campos',contactPhone:'3123456789',paymentMethod:'nequi'})]))
    .mockResolvedValueOnce(answer('Datos recibidos'));
  const result=await service().runTurn(input(text));
  expect(result.error).toBeUndefined();expect(result.checkoutDetails).toEqual({customerName:'Natalia Campos',contactPhone:'3123456789'});
  expect(result.actions.setPaymentMethod).toBe('transfer');
});

it('an invented payment or name cannot enter checkout details',async()=>{
  const text='Para la calle 10 #20-30';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'checkout',productIds:[]}]})]))
    .mockResolvedValueOnce(answer(null,[call('set_checkout_details',{sourceText:text,customerName:'Falso Nombre',paymentMethod:'nequi'})]))
    .mockResolvedValueOnce(answer('Datos guardados'));
  const result=await service().runTurn(input(text));
  expect(result.actions).toEqual({});expect(result.checkoutDetails).toBeUndefined();expect(result.error).toBe('semantic_contract_rejected');
});

it('a plan cannot silently omit one of the requested products',async()=>{
  const text='Un arroz con pollo y una lasaña vegetal';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[
      {text:'Un arroz con pollo',role:'purchase',productIds:[54101]},{text:'y una lasaña vegetal',role:'purchase',productIds:[54102]},
    ]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{productId:54101,quantity:1,sourceText:'Un arroz con pollo'})]))
    .mockResolvedValueOnce(answer('Listo'));
  const result=await service().runTurn(input(text));
  expect(result.error).toBe('incomplete_semantic_plan');expect(result.actions).toEqual({});
});

it('an ambiguous purchase offers a persisted catalog selection instead of guessing a SKU',async()=>{
  const text='Me gustaría dos de esos platos';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[54101]}]})]))
    .mockResolvedValueOnce(answer(null,[call('offer_products',{productIds:[54101,54102],quantity:2,sourceText:text})]))
    .mockResolvedValueOnce(answer('Elige el plato'));
  const result=await service().runTurn(input(text));
  expect(result.error).toBeUndefined();expect(result.actions).toEqual({});
  expect(result.offeredProducts).toEqual({productIds:[54101,54102],quantity:2});
  expect(result.fulfilledSemanticSegments).toEqual([text.toLowerCase()]);
});

it('a conversational introduction cannot become a missing product search',async()=>{
  const text='Bueno veci, lo que intentaba decirte, una lasaña vegetal';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[
      {text:'Bueno veci, lo que intentaba decirte',role:'conversation',productIds:[]},{text:'una lasaña vegetal',role:'purchase',productIds:[54102]},
    ]})]))
    .mockResolvedValueOnce(answer(null,[call('search_menu',{query:'lo que intentaba decirte',sourceText:'Bueno veci, lo que intentaba decirte'})]));
  const result=await service().runTurn(input(text));
  expect(result.error).toBe('semantic_contract_rejected');expect(result.actions).toEqual({});
  expect(result.reply).not.toMatch(/no (?:tenemos|manejamos)/i);
});

it('one accepted tool cannot conceal other targets in the same source clause',async()=>{
  const text='Un arroz con pollo y una lasaña vegetal';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[54101,54102]}]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{productId:54101,quantity:1,sourceText:text})]))
    .mockResolvedValueOnce(answer('Listo'));
  const result=await service().runTurn(input(text));
  expect(result.error).toBe('incomplete_semantic_plan');expect(result.actions).toEqual({});
});

it('a tool cannot add a SKU outside its interpreted target set',async()=>{
  const text='Una lasaña vegetal';
  jest.spyOn(global,'fetch')
    .mockResolvedValueOnce(answer(null,[call('interpret_message',{segments:[{text,role:'purchase',productIds:[54102]}]})]))
    .mockResolvedValueOnce(answer(null,[call('add_item',{productId:54101,quantity:1,sourceText:text})]));
  const result=await service().runTurn(input(text));
  expect(result.error).toBe('semantic_contract_rejected');expect(result.actions).toEqual({});
});
