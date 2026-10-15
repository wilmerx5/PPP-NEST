/** Explicit paid media evaluation; no Meta, database, orders or geocoding. */
import {readFileSync,writeFileSync} from 'fs';
import {execFileSync} from 'child_process';
import {WhatsappAiService} from '../src/whatsapp/whatsapp-ai.service';
import {BetaApiUsage} from './whatsapp-beta-api-usage';
import {Logger} from '@nestjs/common';
if(process.env.WHATSAPP_BETA_LIVE!=='1'||!process.env.OPENAI_API_KEY)throw Error('Explicit live opt-in and private key required');
const limit=Number(process.env.WHATSAPP_BETA_MAX_REQUESTS);
if(!Number.isSafeInteger(limit)||limit<1)throw Error('Explicit request budget required');
const manifest=JSON.parse(readFileSync(process.env.WHATSAPP_MEDIA_MANIFEST!,'utf8'));
const reportPath=process.env.WHATSAPP_MEDIA_REPORT!;if(!reportPath)throw Error('Report path required');
const budgetPath='docs/whatsapp-model-budget.json';
const initial=JSON.parse(readFileSync(budgetPath,'utf8'));if(initial.remainingRequests<limit)throw Error('Shared budget insufficient');
const original=globalThis.fetch;const usage=new BetaApiUsage();const network:any[]=[];const results:any[]=[];
let spent=0;
Logger.overrideLogger(false);
globalThis.fetch=async(url,options)=>{
 if(!['https://api.openai.com/v1/chat/completions','https://api.openai.com/v1/audio/transcriptions'].includes(String(url)))throw Error('External effects forbidden');
 if(spent>=limit)throw Error('Media request budget exhausted');
 const b=JSON.parse(readFileSync(budgetPath,'utf8'));
 if(b.usedRequests!==initial.usedRequests+spent||b.remainingRequests<1)throw Error('Shared budget changed');
 b.usedRequests++;b.remainingRequests--;b.lastAttemptAt=new Date().toISOString();
 const serialized=JSON.stringify(b,null,2)+'\n';writeFileSync(budgetPath,serialized);
 if(process.env.WHATSAPP_BUDGET_MIRROR)writeFileSync(process.env.WHATSAPP_BUDGET_MIRROR,serialized);
 spent++;const started=Date.now();
 try{
  const res=await original(url,options);let payload:any;try{payload=await res.clone().json();}catch{}
  if(String(url).endsWith('chat/completions')){usage.requests++;usage.record(res.status,payload);}
  network.push({endpoint:String(url).split('/v1/')[1],status:res.status,latencyMs:Date.now()-started,
    model:payload?.model||null,usage:payload?.usage||null});
  return res;
 }catch(error){network.push({endpoint:String(url).split('/v1/')[1],transportError:(error as Error).name});throw error;}
};
const service=new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:process.env.OPENAI_API_KEY,openaiModel:'gpt-4.1-2025-04-14'})} as never);
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const menu='1 Pollo Frito #1; Churrasco #17; Sopa De Ajiaco #38; Combo De Pollo Broaster #98; Ramen De Miso #801; Maki Vegetal #802; Té De Jazmín #803';
async function main(){
 const selected=(process.env.WHATSAPP_MEDIA_IDS||'').split(',').filter(Boolean);
 for(const kind of ['images','audios','classifications','generations'])for(const fixture of (manifest[kind] || [])){
  if(selected.length&&!selected.includes(fixture.id+':'+kind))continue;
  const started=Date.now();const before=network.length;let output:any;let problems:string[]=[];let durationSeconds:number|undefined;
  if(kind==='images'){
   output=await service.analyzeOrderImage({buffer:readFileSync(fixture.file),mimeType:'image/png',menuSummary:menu});
   if(output.kind!==fixture.kind)problems.push('kind');
   const text=normalize(output.textForBot||'');for(const term of fixture.terms)if(!text.includes(normalize(term)))problems.push('missing:'+term);
   if(fixture.kind!=='order'&&output.textForBot)problems.push('unexpected_order_text');
  }else if(kind==='audios'){
   durationSeconds=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',fixture.file],{encoding:'utf8'}));
   output=await service.transcribeAudio(readFileSync(fixture.file),'audio/ogg',['Alitas Broaster','Pepsi','Ramen de miso','Té de jazmín','Bocadillo','Madurito']);
   const text=normalize(output||'');if(fixture.empty&&text)problems.push('hallucinated_silence');for(const term of fixture.terms)if(!text.includes(normalize(term)))problems.push('missing:'+term);
  }
  if(kind==='classifications'){
   output=await service.classifyMessage({userMessage:fixture.text,cartLength:2});
   if(output?.intent!==fixture.intent)problems.push('intent');
  }
  if(kind==='generations'){
   output=await service.generateTurn({userMessage:fixture.text,businessRulesBlock:'Un saludo no autoriza compras ni cambios.',
     menuDetailedText:menu,sessionSummary:'Carrito vacío',recentMessages:[],customerHint:'Solo saludar, no modificar el pedido.'});
   if(!output.reply || output.actions?.addItems?.length || output.actions?.setAddress || output.actions?.setCustomerName)problems.push('greeting_mutation');
  }
  const requests=network.slice(before);if(requests.some(r=>r.status!==200))problems.push('provider_error');
  const reportedSeconds=requests.find(r=>r.usage?.type==='duration' && Number.isFinite(r.usage.seconds))?.usage.seconds;
  results.push({id:fixture.id,kind,reportedSeconds,audioCostBasis:reportedSeconds===undefined?'fixture_duration_estimate':'provider_duration',accepted:!problems.length,problems,latencyMs:Date.now()-started,durationSeconds,
    estimatedAudioCostUsd:durationSeconds===undefined?undefined:(reportedSeconds ?? durationSeconds)/60*0.0045,output,requests});
  writeFileSync(reportPath,JSON.stringify({syntheticFixtures:true,visionModel:process.env.WHATSAPP_VISION_MODEL,audioModel:process.env.WHATSAPP_AUDIO_MODEL,
    spent,results,visionUsage:usage.summary(process.env.WHATSAPP_VISION_MODEL||'unknown')},null,2));
  console.log(JSON.stringify({id:fixture.id,kind,accepted:!problems.length,problems}));
  if(problems.length){process.exitCode=1;return;}
 }
}
main().catch(()=>{console.error('MEDIA_EVALUATION_FAILED');process.exitCode=1;}).finally(()=>{globalThis.fetch=original;});
