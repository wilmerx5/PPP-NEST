import { WhatsappResponsesEvaluation } from './whatsapp-responses-evaluation';
const tools = [{type:'function' as const,function:{name:'add_item',parameters:{type:'object',properties:{quantity:{type:'integer'}}}}}];
const create = () => new WhatsappResponsesEvaluation('gpt-6.1-sol',[{role:'system',content:'Solo catálogo'},{role:'user',content:'Dos bowls sin cebolla'}],tools);
const call = (id='call_1',args='{"quantity":2}') => ({type:'function_call',call_id:id,name:'add_item',arguments:args,status:'completed'});
const message = (text='Listo') => ({type:'message',role:'assistant',content:[{type:'output_text',text}]});
const completed = (...output: Record<string,unknown>[]) => ({status:'completed',output});
describe('Responses evaluation boundary (no network or cart execution)',()=> {
  it('uses explicit non-strict tool schemas and Responses fields without altering caller definitions',()=> {
    const before=JSON.stringify(tools);const request=create().request({maxOutputTokens:2000,reasoningEffort:'low'});
    expect(request).toMatchObject({store:false,model:'gpt-6.1-sol',max_output_tokens:2000,reasoning:{effort:'low'},
      tools:[{type:'function',name:'add_item',strict:false}]});
    for(const field of ['messages','max_tokens','max_completion_tokens','temperature']) expect(request).not.toHaveProperty(field);
    expect(JSON.stringify(tools)).toBe(before);
  });
  it('preserves reasoning, call IDs, quantities, notes and both rounds of tool results',()=> {
    const session=create();const reasoning={type:'reasoning',id:'r1',summary:[],encrypted_content:'opaque'};
    const first=session.accept(completed(reasoning,call('c1','{"quantity":2,"note":"sin cebolla"}')));
    expect(first.calls).toEqual([{callId:'c1',name:'add_item',arguments:{quantity:2,note:'sin cebolla'}}]);
    expect(()=>session.request({maxOutputTokens:2000})).toThrow('tool_results_required');
    session.toolResults([{callId:'c1',output:'{"ok":true}'}]);
    expect(session.request({maxOutputTokens:2000}).input).toEqual(expect.arrayContaining([reasoning,
      {type:'function_call_output',call_id:'c1',output:'{"ok":true}'}]));
    session.accept(completed(call('c2','{"quantity":1}')));session.toolResults([{callId:'c2',output:'{"ok":false}'}]);
    expect(session.accept(completed(message('Solo añadí los dos bowls')))).toEqual({text:'Solo añadí los dos bowls',calls:[]});
  });
  it.each(['incomplete','failed','in_progress',undefined])('rejects %s status without exposing partial tools',status=> {
    const session=create();expect(()=>session.accept({status,output:[call()]})).toThrow('response_incomplete');
    expect((session.request({maxOutputTokens:2000}).input as unknown[])).toHaveLength(2);
  });
  it.each(['{','[]','null','2'])('rejects invalid tool arguments %s atomically',args=> {
    const session=create();expect(()=>session.accept(completed(call(),call('c2',args)))).toThrow('invalid_tool_arguments');
    expect((session.request({maxOutputTokens:2000}).input as unknown[])).toHaveLength(2);
  });
  it('rejects unknown tools and duplicate call IDs',()=> {
    expect(()=>create().accept(completed({...call(),name:'confirm_external_order'}))).toThrow('invalid_tool_call');
    expect(()=>create().accept(completed(call(),call()))).toThrow('invalid_tool_call');
  });
  it.each([{results:[]},{results:[{callId:'wrong',output:'{}'}]},{results:[{callId:'c1',output:'{}'},{callId:'c1',output:'{}'}]}])('rejects mismatched tool results $results',({results})=> {
    const session=create();session.accept(completed(call('c1')));
    expect(()=>session.toolResults(results)).toThrow('results_mismatch');
    session.toolResults([{callId:'c1',output:'{"ok":true}'}]);
  });
  it('refusals and unsupported output cannot commit an earlier tool call',()=> {
    const session=create();expect(()=>session.accept(completed(call(),{type:'message',role:'assistant',content:[{type:'refusal',refusal:'No'}]}))).toThrow('refused');
    expect(()=>session.accept(completed({type:'computer_call'}))).toThrow('unsupported_output');
    expect(()=>session.accept(completed({type:'reasoning',summary:[]}))).toThrow('empty_response');
  });
  it('isolates returned requests, provider objects and pending call state from caller mutation',()=> {
    const session=create();const request=session.request({maxOutputTokens:2000});(request.input as unknown[]).pop();
    const output=completed(call());const accepted=session.accept(output);output.output[0].arguments='{}';accepted.calls[0].callId='changed';
    session.toolResults([{callId:'call_1',output:'{}'}]);
    expect((session.request({maxOutputTokens:2000}).input as any[])[2].arguments).toBe('{"quantity":2}');
  });
  it('requires explicit positive output budget',()=> {
    expect(()=>create().request({maxOutputTokens:0})).toThrow('output_budget_required');
  });
});
