import {WhatsappAgentService} from './whatsapp-agent.service';
import {WhatsappCatalogService} from './whatsapp-catalog.service';
const menu=[{id:601,code:601,name:'Bowl Campestre',description:'Arroz y vegetales',price:12000,availableNow:true,attributes:[],hasAttributes:false}];
const input={userMessage:'Quiero dos bowls campestres',products:menu,cart:[],recentMessages:[],sessionSummary:'Vacío',brandName:'Prueba',businessRulesBlock:''};
const original=globalThis.fetch;
afterEach(()=>{globalThis.fetch=original;});
it.each(['gpt-6.1-sol','gpt-6-luna'])('runs %s through Responses and applies successful tools exactly once',async model=>{
 const mock=jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({status:'completed',output:[{type:'reasoning',id:'r',summary:[],encrypted_content:'opaque'},
  {type:'function_call',call_id:'call1',name:'add_item',arguments:'{"productId":601,"quantity":2}'}]})))
  .mockResolvedValueOnce(new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Listo, dos bowls.'}]}]})));
 globalThis.fetch=mock;
 const agent=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline',openaiModel:model,localContext:{}})} as never,new WhatsappCatalogService({} as never));
 const result=await agent.runTurn(input);
 expect(result.error).toBeUndefined();expect(result.actions.addItems).toEqual([{productId:601,quantity:2}]);
 expect(mock.mock.calls.map(c=>c[0])).toEqual(['https://api.openai.com/v1/responses','https://api.openai.com/v1/responses']);
 const next=JSON.parse(mock.mock.calls[1][1].body);
 expect(next.store).toBe(false);expect(next.input).toEqual(expect.arrayContaining([{type:'reasoning',id:'r',summary:[],encrypted_content:'opaque'},
  expect.objectContaining({type:'function_call_output',call_id:'call1'})]));
});
it('rejects incomplete Responses proposals before applying any cart tool',async()=>{
 globalThis.fetch=jest.fn().mockResolvedValue(new Response(JSON.stringify({status:'incomplete',output:[{type:'function_call',call_id:'c',name:'add_item',arguments:'{"productId":601}'}]})));
 const agent=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline',openaiModel:'gpt-6.1-sol',localContext:{}})} as never,new WhatsappCatalogService({} as never));
 const result=await agent.runTurn(input);expect(result.actions.addItems).toBeUndefined();expect(result.error).toBe('exception');
});
