/** Real configured model + full inbound router, with isolated persistence/transports. */
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappSettingsService } from '../src/whatsapp/whatsapp-settings.service';
import { WhatsappAgentService } from '../src/whatsapp/whatsapp-agent.service';
import { WhatsappAiService } from '../src/whatsapp/whatsapp-ai.service';
import { WhatsappOrchestratorService } from '../src/whatsapp/whatsapp-orchestrator.service';
import { WhatsappCatalogService } from '../src/whatsapp/whatsapp-catalog.service';
import { WhatsappActionGuardService } from '../src/whatsapp/whatsapp-action-guard.service';
import { WhatsappPointsService } from '../src/whatsapp/whatsapp-points.service';
import { WhatsappTurnTelemetryService } from '../src/whatsapp/whatsapp-turn-telemetry.service';
import { DEFAULT_PAYMENT_METHODS } from '../src/whatsapp/whatsapp-payment-methods';
import type { WhatsappSessionData } from '../src/whatsapp/types/whatsapp-session.types';
import { BetaApiUsage } from './whatsapp-beta-api-usage';
import { matchesExpectedCartLines, type ExpectedCartLine } from './whatsapp-beta-cart-assertions';

type Expectation = { replyAny?: string[]; replyAll?: string[]; replyForbid?: string[]; lines?: ExpectedCartLine[]; items?: Record<string, number>; state?: string; address?: string; payment?: string; orderCount?: number; cashContains?: string; attrs?: Array<{id:number;key:string;value:string}> };
type Scenario = { id: string; initialCart?: Array<{id:number;quantity:number;note?:string;attributes?:Array<{attributeName:string;attributeValue:string}>}>; messages: Array<{text:string;expect:Expectation}> };
if (process.env.WHATSAPP_BETA_LIVE !== '1' || !process.env.OPENAI_API_KEY) throw Error('Explicit live flag and private API key required');
Logger.overrideLogger(false);
const model = process.env.WHATSAPP_BETA_MODEL || 'gpt-4o-mini';
const usage = new BetaApiUsage();
const originalFetch = globalThis.fetch;
const requestIntervalMs = Math.max(0,Math.min(5000,Number(process.env.WHATSAPP_BETA_REQUEST_INTERVAL_MS ?? 1500)));
let lastRequestStart=0;
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  if (args[0] !== 'https://api.openai.com/v1/chat/completions') throw Error('Only isolated OpenAI inference is permitted');
  const delay=Math.max(0,requestIntervalMs-(Date.now()-lastRequestStart));
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  lastRequestStart=Date.now();
  usage.requests++;
  try {
    const response = await originalFetch(...args);
    let body:unknown; try { body = await response.clone().json(); } catch { /* Account for missing usage. */ }
    usage.record(response.status, body);
    return response;
  } catch(error) { usage.recordTransportFailure(error); throw error; }
};
const products = JSON.parse(readFileSync(join(process.cwd(),'scripts/fixtures/whatsapp-beta-menu.json'),'utf8'));
const scenarios:Scenario[] = JSON.parse(readFileSync(join(process.cwd(),'scripts/fixtures/whatsapp-live-router-cases.json'),'utf8'));
const row = {id:1,enabled:true,agentV1Enabled:true,ignoreBusinessHours:true,openaiApiKey:process.env.OPENAI_API_KEY,
  openaiModel:model,systemPrompt:process.env.WHATSAPP_BETA_SYSTEM_PROMPT || null,aiTemperature:0.2,
  restaurantName:'Pronto Pollo Portal (simulación)',allowMercadoPago:false,paymentMethods:DEFAULT_PAYMENT_METHODS,
  defaultDeliveryFee:2000,deliveryFeeMode:'fixed',maxUnitsPerItem:10,maxTotalUnits:30,maxCartLines:20};
const settings = new WhatsappSettingsService({findOne:async()=>row} as never,new ConfigService());
const catalog = new WhatsappCatalogService({getMenuProducts:async()=>products} as never);
catalog.getMenuProducts = async () => structuredClone(products);
const repeats = Number(process.env.WHATSAPP_BETA_REPEATS || 1);
const selected = process.env.WHATSAPP_BETA_CASE_IDS?.split(',');
const cases = selected ? scenarios.filter(c=>selected.includes(c.id)) : scenarios;
if (!cases.length || !Number.isInteger(repeats) || repeats<1 || repeats>3) throw Error('Nonempty cases and 1–3 repetitions required');
const results:any[]=[];

function harness(scenario:Scenario) {
  let count=0;
  const cart=(scenario.initialCart||[]).map(line=>{const p=products.find(p=>p.id===line.id);if(!p)throw Error('Unknown fixture SKU');return {productId:p.id,name:p.name,code:p.code,unitPrice:p.price,quantity:line.quantity,note:line.note,attributes:structuredClone(line.attributes||[])};});
  const conv:any={id:1,waId:'synthetic-live-router',phoneE164:'+573000000001',customerName:'Cliente Sintético',state:'building_cart',sessionData:{cart,orderType:'delivery'}};
  const history:string[]=[];const replies:string[]=[];const orders:any[]=[];let agentTurns=0;const agentErrors:string[]=[];const agentResults:any[]=[];
  const conversations:any={
    findOrCreateConversation:async()=>conv,touchInbound:async()=>{},claimInboundMessage:async()=>({id:++count}),
    reloadConversation:async()=>structuredClone(conv),getSession:()=>structuredClone(conv.sessionData),
    saveSession:async(_conv:any,patch:Partial<WhatsappSessionData>,state?:string)=>{conv.sessionData=JSON.parse(JSON.stringify({...conv.sessionData,...patch}));if(state)conv.state=state;return conv;},
    countInboundMessages:async()=>count+1,getRecentMessageTexts:async()=>history.slice(-24),getLastOutboundBody:async()=>replies.at(-1)||null,
    updateCustomerName:async(_conv:any,name:string)=>{conv.customerName=name;},
    resetOrderSession:async(_conv:any,state:string)=>{conv.sessionData={cart:[],orderType:'delivery',ignorePriorOrderHistory:true};conv.state=state;},
    findUserByPhone:async()=>null,
  };
  const agent=new WhatsappAgentService(settings,catalog);
  const run=agent.runTurn.bind(agent);agent.runTurn=async input=>{agentTurns++;const result=await run(input);agentResults.push({reply:result.reply,actions:result.actions,toolCalls:result.toolCalls});if(result.error)agentErrors.push(result.error);return result;};
  const service=new WhatsappOrchestratorService(settings,{sendText:async()=>{throw Error('Meta must stay isolated');}} as never,
    catalog,new WhatsappAiService(settings),conversations,{getStatus:async()=>({isOpen:true,message:'Abierto',openTime:'00:00',closeTime:'23:59'})} as never,
    {create:async(dto:any)=>{orders.push(structuredClone(dto));return {id:orders.length,dailyOrderNumber:orders.length};}} as never,
    {createPreference:async()=>{throw Error('Payments must stay isolated');}} as never,new WhatsappActionGuardService(catalog),
    new WhatsappPointsService({} as never),{quoteDeliveryFee:async()=>({ok:false,reason:'no_api_key',message:'Synthetic fixed delivery fee'})} as never,
    agent,new WhatsappTurnTelemetryService()) as any;
  service.reply=async(_conv:any,_waId:string,body:string)=>{replies.push(body);history.push('Bot: '+body);};
  const send=async(text:string)=>{
    const beforeReplies=replies.length;
    history.push('Cliente: '+text);
    await service.handleIncomingUnlocked({waId:conv.waId,phoneE164:conv.phoneE164,messageId:`synthetic-${count}`,messageType:'text',text,raw:{}});
    return {session:structuredClone(conv.sessionData),state:conv.state,replies:replies.slice(beforeReplies),orders:structuredClone(orders),agentTurns,agentErrors:[...agentErrors],agentResults:structuredClone(agentResults)};
  };
  return {send};
}

async function main(){
  outer:for(let repetition=1;repetition<=repeats;repetition++)for(const scenario of cases){
    if(usage.blockingProviderErrorCode)break outer;
    const h=harness(scenario);const turns:any[]=[];const problems:string[]=[];const requestsBefore=usage.requests;
    for(let i=0;i<scenario.messages.length;i++){
      const step=scenario.messages[i];
      try {
        const actual=await h.send(step.text);turns.push({text:step.text,...actual});
        const expected=step.expect;
        if(expected.items){const items:Record<string,number>={};for(const line of actual.session.cart)items[line.productId]=(items[line.productId]||0)+line.quantity;
          if(JSON.stringify(Object.entries(items).sort())!==JSON.stringify(Object.entries(expected.items).sort()))problems.push(`turn_${i}:cart`);}
        if(expected.lines && !matchesExpectedCartLines(expected.lines,actual.session.cart))problems.push(`turn_${i}:variant_lines`);
        if(expected.state && actual.state!==expected.state)problems.push(`turn_${i}:state:${actual.state}`);
        if(expected.address && !(actual.session.address||'').toLowerCase().includes(expected.address.toLowerCase()))problems.push(`turn_${i}:address`);
        if(expected.payment && actual.session.paymentMethod!==expected.payment)problems.push(`turn_${i}:payment`);
        if(expected.attrs?.some(attr=>!actual.session.cart.some(line=>line.productId===attr.id && line.attributes?.some(a=>a.attributeName===attr.key && a.attributeValue===attr.value))))problems.push(`turn_${i}:attributes`);
        if(expected.cashContains && !(actual.session.cashChangeFor||'').includes(expected.cashContains))problems.push(`turn_${i}:cash`);
        if(expected.orderCount!==undefined && actual.orders.length!==expected.orderCount)problems.push(`turn_${i}:order_count`);
        if(actual.agentErrors.length)problems.push(`turn_${i}:agent_error`);
        const normalizeReply = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        const replyText = normalizeReply(actual.replies.join(' '));
        if(expected.replyAny?.length && !expected.replyAny.some(value=>replyText.includes(normalizeReply(value))))problems.push(`turn_${i}:reply_missing_any`);
        if(expected.replyAll?.some(value=>!replyText.includes(normalizeReply(value))))problems.push(`turn_${i}:reply_missing_fact`);
        if(expected.replyForbid?.some(value=>replyText.includes(normalizeReply(value))))problems.push(`turn_${i}:reply_forbidden_fact`);
        if(!actual.replies.length)problems.push(`turn_${i}:no_reply`);
      }catch(error){problems.push(`turn_${i}:exception:${(error as Error).message}`);break;}
      if(usage.blockingProviderErrorCode){problems.push('provider_blocked');break;}
    }
    results.push({id:scenario.id,repetition,accepted:!problems.length,problems,requests:usage.requests-requestsBefore,turns});
    console.log(JSON.stringify({id:scenario.id,repetition,accepted:!problems.length,problems,requests:usage.requests-requestsBefore}));
    mkdirSync('tmp',{recursive:true});writeFileSync('tmp/whatsapp-live-router-report.json',JSON.stringify({model,planned:cases.length*repeats,results,apiUsage:usage.summary(model)},null,2));
  }
  const accepted=results.filter(r=>r.accepted).length;
  console.log(JSON.stringify({accepted,executed:results.length,planned:cases.length*repeats,apiUsage:usage.summary(model)}));
  if(results.length!==cases.length*repeats || accepted!==results.length || !usage.successfulResponses)process.exitCode=1;
}
main().catch(()=>{console.error('LIVE_ROUTER_REHEARSAL_FAILED');process.exitCode=1;}).finally(()=>{globalThis.fetch=originalFetch;});
