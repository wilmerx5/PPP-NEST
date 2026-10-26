import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { requestWhatsappInference } from './whatsapp-openai-request';
import { writeFileSync } from 'fs';
jest.mock('./whatsapp-openai-request',()=>({requestWhatsappInference:jest.fn()}));
jest.mock('./whatsapp-agent-model',()=>({resolveWhatsappAgentModel:(configured:string)=>configured}));
// Desired budget contract, not a measurement of live model quality or invoice.
for(const model of ['gpt-4o-mini','gpt-6.1-sol']) for(const [i,name] of ['Bowl De Tofu','Pizza Vegetariana'].entries()) for(const length of [419,420,421]) {
 it(`complete answer should not require a cosmetic retry ${model}/${i}/${length}`,async()=>{
  const prefix=`${name}: incluye verduras; cuesta $20.000. `;
  const answer=prefix+'Detalles de ingredientes disponibles. '.repeat(20).slice(0,length-prefix.length);
  const request=jest.mocked(requestWhatsappInference);request.mockReset();
  request.mockResolvedValue({ok:true,json:async()=>model.startsWith('gpt-6')?{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:answer}]}]}:{choices:[{message:{content:answer}}]}} as Response);
  const service=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'mock-only',openaiModel:model,localContext:{}})} as never,new WhatsappCatalogService({} as never));
  const result=await service.runTurn({userMessage:'Qué opciones tienes para almorzar?',sessionSummary:'carrito vacío',recentMessages:[],businessRulesBlock:'reglas',brandName:'Ficticio',products:[{id:99101,code:91,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]}]});
  writeFileSync(`/tmp/ppp-198-cost-${model}-${i}-${length}.json`,JSON.stringify({requests:request.mock.calls.length,requestBytes:request.mock.calls.map(c=>Buffer.byteLength(c[0])),reply:result.reply,actions:result.actions},null,2));
  expect(result.actions).toEqual({});
  expect(result.reply).toContain(name);
  expect(result.reply).toContain('$20.000');
  expect(request).toHaveBeenCalledTimes(1);
 });
}
