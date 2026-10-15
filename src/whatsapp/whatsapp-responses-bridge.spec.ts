import { WhatsappResponsesBridge } from './whatsapp-responses-bridge';
import { BetaApiUsage } from '../../scripts/whatsapp-beta-api-usage';
const base={model:'gpt-6.1-sol',messages:[{role:'system',content:'Catálogo'},{role:'user',content:'Dos wraps'}],
  tools:[{type:'function',function:{name:'add_item',parameters:{type:'object',properties:{}}}}],tool_choice:'auto'};
describe('isolated Responses bridge',()=>{
  it('replays raw reasoning and results across rounds and prepares retries idempotently',()=>{
    const bridge=new WhatsappResponsesBridge();const prepared=bridge.prepare(base);
    expect(bridge.prepare(base)).toBe(prepared);
    const normalized=prepared.accept({status:'completed',output:[{type:'reasoning',id:'r',summary:[],encrypted_content:'opaque'},
      {type:'function_call',call_id:'c',name:'add_item',arguments:'{"quantity":2}'}]});
    const continuation={...base,messages:[...base.messages,normalized.choices[0].message,{role:'tool',tool_call_id:'c',content:'{"ok":true}'}]};
    const next=bridge.prepare(continuation);
    expect(next.body.input).toEqual(expect.arrayContaining([{type:'reasoning',id:'r',summary:[],encrypted_content:'opaque'},
      {type:'function_call_output',call_id:'c',output:'{"ok":true}'}]));
    expect(next.body.reasoning).toEqual({effort:'low'});
    expect(bridge.prepare(continuation)).toBe(next);
    const second=next.accept({status:'completed',output:[{type:'function_call',call_id:'c2',name:'add_item',arguments:'{"quantity":1}'}]});
    const final=bridge.prepare({...base,messages:[...continuation.messages,second.choices[0].message,{role:'tool',tool_call_id:'c2',content:'{"ok":true}'}]});
    expect(final.body.input.filter((i:any)=>i.type==='function_call_output').map((i:any)=>i.call_id)).toEqual(['c','c2']);
  });
  it('preserves forced tool selection and gives Luna no reasoning',()=>{
    const request=new WhatsappResponsesBridge().prepare({...base,model:'gpt-6-luna',tool_choice:{type:'function',function:{name:'add_item'}}}).body;
    expect(request.tool_choice).toEqual({type:'function',name:'add_item'});expect(request.reasoning).toEqual({effort:'none'});
  });
  it('accounts for Responses cache/reasoning usage without double billing reasoning',()=>{
    const usage=new BetaApiUsage();usage.requests=1;usage.record(200,{usage:{input_tokens:1000,input_tokens_details:{cached_tokens:400},
      output_tokens:100,output_tokens_details:{reasoning_tokens:80}}});
    expect(usage.summary('gpt-6.1-sol')).toMatchObject({promptTokens:1000,completionTokens:100,reasoningTokens:80,
      usageComplete:true,estimatedReportedCostUsd:0.00224});
  });
});
