import { readWhatsappInferenceUsage, type WhatsappInferenceAttempt } from './whatsapp-inference-usage';
import { requestWhatsappInference } from './whatsapp-openai-request';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
jest.mock('./whatsapp-agent-model',()=>({resolveWhatsappAgentRoute:(configured:string)=>({model:configured,reason:'primary'})}));
const responsesUsage={input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:50,cache_write_tokens:25},output_tokens_details:{reasoning_tokens:5}};
const chatUsage={prompt_tokens:100,completion_tokens:20,prompt_tokens_details:{cached_tokens:50,cache_write_tokens:25},completion_tokens_details:{reasoning_tokens:5}};
for(const api of ['responses','chat/completions'] as const) {
 const usage=api==='responses'?responsesUsage:chatUsage;
 it(`reads only normalized counters ${api}`,()=>expect(readWhatsappInferenceUsage({usage,secret:'private'},api)).toEqual({inputTokens:100,outputTokens:20,cachedInputTokens:50,cacheWriteTokens:25,reasoningTokens:5}));
 for(const bad of [undefined,null,{}, {input_tokens:10}, {prompt_tokens:10}, {input_tokens:-1,output_tokens:2},{input_tokens:'10',output_tokens:2},{prompt_tokens:NaN,completion_tokens:2}]) {
  it(`unknown rather than free ${api}/${JSON.stringify(bad)}`,()=>expect(readWhatsappInferenceUsage({usage:bad},api)).toBeNull());
 }
 it(`counts received body once and preserves it ${api}`,async()=>{
  const events:WhatsappInferenceAttempt[]=[];
  const raw={usage,output:[],choices:[],privateCustomer:'do not log'};
  const fetcher=jest.fn().mockResolvedValue(new Response(JSON.stringify(raw)));
  const result=await requestWhatsappInference('{"messages":["private text"]}','secret',{api,fetcher,onAttempt:e=>events.push(e)});
  expect(await result.json()).toEqual(raw);expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({attempt:1,status:200,api,usage:{inputTokens:100,outputTokens:20}});
  expect(JSON.stringify(events)).not.toMatch(/secret|private|messages|output_tokens/);
 });
}
it('zero reported usage differs from absent counters',()=>{
 expect(readWhatsappInferenceUsage({usage:{input_tokens:0,output_tokens:0}},'responses')).toEqual({inputTokens:0,outputTokens:0,cachedInputTokens:null,cacheWriteTokens:null,reasoningTokens:null});
});
it('rejects impossible breakdowns while preserving totals',()=>{
 expect(readWhatsappInferenceUsage({usage:{input_tokens:10,output_tokens:2,input_tokens_details:{cached_tokens:11,cache_write_tokens:-1},output_tokens_details:{reasoning_tokens:3}}},'responses')).toEqual({inputTokens:10,outputTokens:2,cachedInputTokens:null,cacheWriteTokens:null,reasoningTokens:null});
});
it('temporary rejection and retry have one request ID and separate attempts',async()=>{
 const events:WhatsappInferenceAttempt[]=[];
 const fetcher=jest.fn().mockResolvedValueOnce(new Response('{"error":{"code":"rate_limit_exceeded"}}',{status:429})).mockResolvedValueOnce(new Response(JSON.stringify({usage:responsesUsage})));
 await requestWhatsappInference('{}','secret',{api:'responses',fetcher,wait:async()=>{},random:()=>0,onAttempt:e=>events.push(e)});
 expect(events.map(e=>[e.attempt,e.status,e.usage?.inputTokens??null])).toEqual([[1,429,null],[2,200,100]]);
 expect(new Set(events.map(e=>e.requestId)).size).toBe(1);
});
it('timeout usage stays unknown even if retry succeeds',async()=>{
 const events:WhatsappInferenceAttempt[]=[];
 const fetcher=jest.fn().mockRejectedValueOnce(new DOMException('private server body','TimeoutError')).mockResolvedValueOnce(new Response(JSON.stringify({usage:responsesUsage})));
 await requestWhatsappInference('{}','secret',{api:'responses',fetcher,wait:async()=>{},random:()=>0,onAttempt:e=>events.push(e)});
 expect(events.map(e=>e.outcome)).toEqual(['timeout','response']);expect(events[0].usage).toBeNull();expect(JSON.stringify(events)).not.toContain('private');
});
it('transport failure is measured without leaking error text',async()=>{
 const onAttempt=jest.fn();const fetcher=jest.fn().mockRejectedValue(new Error('secret payload'));
 await expect(requestWhatsappInference('{}','secret',{fetcher,onAttempt})).rejects.toThrow('secret payload');
 expect(onAttempt).toHaveBeenCalledTimes(1);expect(onAttempt.mock.calls[0][0]).toMatchObject({status:null,outcome:'transport_error',usage:null});
 expect(JSON.stringify(onAttempt.mock.calls)).not.toContain('secret');
});
it('broken telemetry never interrupts response processing',async()=>{
 const fetcher=jest.fn().mockResolvedValue(new Response('{"ok":true}'));
 const response=await requestWhatsappInference('{}','secret',{fetcher,onAttempt:()=>{throw new Error('sink');}});
 expect(await response.json()).toEqual({ok:true});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('malformed provider body is returned unchanged with unknown usage',async()=>{
 const events:WhatsappInferenceAttempt[]=[];
 const response=await requestWhatsappInference('{}','secret',{fetcher:jest.fn().mockResolvedValue(new Response('invalid json')),onAttempt:e=>events.push(e)});
 expect(await response.text()).toBe('invalid json');expect(events[0].usage).toBeNull();
});
for(const model of ['gpt-4o-mini','gpt-6.1-sol']) {
 it(`agent correlates tool rounds without customer content ${model}`,async()=>{
  const raw=(text:string)=>model.startsWith('gpt-6')?{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],usage:responsesUsage}:{choices:[{message:{content:text}}],usage:chatUsage};
  const tool = model.startsWith('gpt-6')
   ? {status:'completed',output:[{type:'function_call',call_id:'lookup',name:'search_menu',arguments:'{"query":"almuerzo"}'}],usage:responsesUsage}
   : {choices:[{message:{content:null,tool_calls:[{id:'lookup',type:'function',function:{name:'search_menu',arguments:'{"query":"almuerzo"}'}}]}}],usage:chatUsage};
  const fetcher=jest.spyOn(global,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(tool))).mockResolvedValueOnce(new Response(JSON.stringify(raw('Tenemos opciones. ¿Cuál prefieres?'))));
  const service=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'secret',openaiModel:model,localContext:{}})} as never,new WhatsappCatalogService({} as never));
  const log=jest.spyOn((service as any).logger,'log').mockImplementation(()=>{});
  try {
   const result=await service.runTurn({conversationId:123,userMessage:'Qué tienes para almorzar?',sessionSummary:'private customer',recentMessages:[],businessRulesBlock:'reglas',brandName:'Ficticio',products:[]});
   expect(result.reply).toBe('Tenemos opciones. ¿Cuál prefieres?');expect(result.actions).toEqual({});
   const events=log.mock.calls.map(c=>JSON.parse(c[0] as string));
   expect(events).toHaveLength(2);expect(events.map(e=>e.reason)).toEqual(['initial','tool_results']);
   expect(new Set(events.map(e=>e.inferenceTurnId)).size).toBe(1);
   expect(new Set(events.map(e=>e.requestId)).size).toBe(2);
   expect(events.every(e=>e.conversationId===123&&e.model===model&&e.usage.inputTokens===100)).toBe(true);
   expect(JSON.stringify(events)).not.toMatch(/private|secret|almorzar|Almuerzos/);
  } finally {fetcher.mockRestore();log.mockRestore();}
 });
}
