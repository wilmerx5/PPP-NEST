/** Per-turn Responses transport bridge. Business tools still execute in the agent. */
import { WhatsappResponsesEvaluation } from './whatsapp-responses-evaluation';
type Json = Record<string, any>;
export class WhatsappResponsesBridge {
  private continuations: Array<{prefix:string;length:number;session:WhatsappResponsesEvaluation}> = [];
  private prepared = new Map<string,{body:Json;accept:(response:Json)=>Json}>();
  prepare(chat:Json): {body:Json;accept:(response:Json)=>Json} {
    const key=JSON.stringify(chat);const cached=this.prepared.get(key);if(cached)return cached;
    const previous=[...this.continuations].reverse().find(entry=>JSON.stringify(chat.messages.slice(0,entry.length))===entry.prefix);
    let session:WhatsappResponsesEvaluation;
    if(previous){
      session=previous.session;
      const delta=chat.messages.slice(previous.length);
      const toolResults=delta.filter((m:Json)=>m.role==='tool');
      if(toolResults.length)session.toolResults(toolResults.map((m:Json)=>({callId:m.tool_call_id,output:m.content})));
      session.appendMessages(delta.filter((m:Json)=>m.role!=='tool'));
    } else {
      session=new WhatsappResponsesEvaluation(chat.model,chat.messages,chat.tools);
    }
    const toolChoice=typeof chat.tool_choice==='object'
      ? {type:'function' as const,name:chat.tool_choice.function.name} : chat.tool_choice;
    const body=session.request({maxOutputTokens:3000,reasoningEffort:chat.model==='gpt-6-luna'?'none':'low',toolChoice});
    const entry={body,accept:(response:Json)=>{
      const result=session.accept(response);
      const message={role:'assistant',content:result.text || null,
        ...(result.calls.length?{tool_calls:result.calls.map(call=>({id:call.callId,type:'function',
          function:{name:call.name,arguments:JSON.stringify(call.arguments)}}))}:{})};
      const transcript=[...chat.messages,message];
      this.continuations.push({prefix:JSON.stringify(transcript),length:transcript.length,session});
      return {choices:[{message,finish_reason:result.calls.length?'tool_calls':'stop'}],usage:response.usage};
    }};
    this.prepared.set(key,entry);return entry;
  }
}
