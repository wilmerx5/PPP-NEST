import {WhatsappAiService} from './whatsapp-ai.service';
const beforeFetch=global.fetch;const beforeModel=process.env.WHATSAPP_ASSIST_MODEL;
afterEach(()=>{global.fetch=beforeFetch;if(beforeModel===undefined)delete process.env.WHATSAPP_ASSIST_MODEL;else process.env.WHATSAPP_ASSIST_MODEL=beforeModel;});
it.each(['classify','generate'])('selects independent Luna assistant model for %s with bounded JSON output',async role=>{
 process.env.WHATSAPP_ASSIST_MODEL='gpt-6-luna';
 const payload=role==='classify'?{intent:'chitchat',normalizedText:'Hola',address:null,hasFoodItems:false,confidence:1}:{reply:'Hola, ¿qué deseas pedir?',actions:{}};
 const mock=jest.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(payload)}}]})});global.fetch=mock;
 const service=new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:'offline',openaiModel:'gpt-4.1-2025-04-14'})} as never);
 if(role==='classify')expect(await service.classifyMessage({userMessage:'Hola',cartLength:0})).toMatchObject({intent:'chitchat'});
 else expect(await service.generateTurn({userMessage:'Hola',businessRulesBlock:'',menuDetailedText:'',sessionSummary:'',recentMessages:[],customerHint:''})).toMatchObject({reply:payload.reply,actions:{}});
 const body=JSON.parse(mock.mock.calls[0][1].body);expect(body).toMatchObject({model:'gpt-6-luna',reasoning_effort:'none',max_completion_tokens:role==='classify'?220:1200});
 expect(mock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);expect(body).not.toHaveProperty('max_tokens');
});
