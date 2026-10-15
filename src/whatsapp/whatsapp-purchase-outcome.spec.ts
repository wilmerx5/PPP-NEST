import {readFileSync} from 'fs';
import {join} from 'path';
import {WhatsappAgentService} from './whatsapp-agent.service';
import {WhatsappCatalogService} from './whatsapp-catalog.service';

/** Real tool validation, synthetic provider responses; no network or order transport. */
describe('Purchase tool outcomes across model iterations',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 const source=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-contract-independent-office-1410.json'),'utf8'))[0].messages[0].text;
 const originalFetch=globalThis.fetch;
 afterEach(()=>{globalThis.fetch=originalFetch;jest.restoreAllMocks();});
 const input=(text=source)=>({userMessage:text,sessionSummary:'Carrito vacío',recentMessages:[],businessRulesBlock:'',brandName:'Carta de prueba',products:menu,cart:[]});
 const response=(message:unknown)=>({ok:true,json:async()=>({choices:[{message}]})});
 const call=(productId:number,quantity=1,attributes?:unknown[])=>({id:'tool-'+productId+'-'+quantity,type:'function',function:{name:'add_item',arguments:JSON.stringify({productId,quantity,attributes})}});
 const make=()=>new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline-key',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,new WhatsappCatalogService({} as never));
 it('reports every rejected tool, without treating a tool name as a successful purchase',async()=>{
  const fetchMock=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:[call(501,2),call(502,1,[{attributeName:'Salsa',attributeValue:'Tahini'}]),call(502,1,[{attributeName:'Salsa',attributeValue:'Yogur'}])]}))
   .mockResolvedValueOnce(response({content:'Necesito aclarar el pedido.'}));globalThis.fetch=fetchMock;
  const result=await make().runTurn(input());
  expect(result.actions.addItems).toBeUndefined();expect(result.purchaseAttempts).toEqual([
   {productId:501,accepted:false,reason:'dish_not_on_menu'},
   {productId:502,accepted:false,reason:'dish_not_on_menu'},
   {productId:502,accepted:false,reason:'dish_not_on_menu'}]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(result.purchaseAttempts)).not.toMatch(/Daniela|Camilo|Sara|Tahini|Yogur|offline-key/);
 });
 it('retains rejected outcomes when the next model response is malformed',async()=>{
  globalThis.fetch=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:[call(501,2)]})).mockResolvedValueOnce(response(undefined));
  const result=await make().runTurn(input());expect(result.error).toBe('empty_message');
  expect(result.purchaseAttempts).toEqual([{productId:501,accepted:false,reason:'dish_not_on_menu'}]);
 });
 it('records acceptance and a duplicate rejection separately',async()=>{
  globalThis.fetch=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:[call(503,1),call(503,1)]})).mockResolvedValueOnce(response({content:'Listo.'}));
  const result=await make().runTurn(input('Quiero una limonada de hierbabuena'));
  expect(result.actions.addItems).toHaveLength(1);expect(result.purchaseAttempts).toEqual([
   {productId:503,accepted:true},{productId:503,accepted:false,reason:'item_already_added_this_turn'}]);
 });
 it('does not carry rejected attempts into the next turn',async()=>{
  const agent=make();globalThis.fetch=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:[call(501,2)]})).mockResolvedValueOnce(response({content:'Aclaremos.'}));
  expect((await agent.runTurn(input())).purchaseAttempts).toHaveLength(1);
  globalThis.fetch=jest.fn().mockResolvedValueOnce(response({content:'Hola.'}));
  expect((await agent.runTurn(input('Hola vecino'))).purchaseAttempts||[]).toEqual([]);
 });
});
