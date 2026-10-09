/**
 * Ensayo de Agent V1 con OpenAI REAL y catálogo sintético.
 * Solo usa applyActions del orquestador; no instancia Meta, OrdersService ni repositorios de BD.
 * Requiere flag y key explícitos, también en el workflow de ensayos autorizado.
 *
 * OPENAI_API_KEY=<secret> WHATSAPP_BETA_LIVE=1 yarn beta:whatsapp:ai
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from '../src/whatsapp/whatsapp-orchestrator.service';
import { WhatsappActionGuardService } from '../src/whatsapp/whatsapp-action-guard.service';
import type { WhatsappSessionData } from '../src/whatsapp/types/whatsapp-session.types';
import { WhatsappAgentService } from '../src/whatsapp/whatsapp-agent.service';
import { WhatsappCatalogService, type WhatsappCatalogProduct } from '../src/whatsapp/whatsapp-catalog.service';
import { matchesExpectedCartLines, type ExpectedCartLine } from './whatsapp-beta-cart-assertions';
import { BetaApiUsage } from './whatsapp-beta-api-usage';

type HardScenario = {
 id:string;group:string;messages:string[];context?:string[];
 initialCart?:Array<{productId:number;quantity:number;note?:string;attributes?:Array<{attributeName:string;attributeValue:string}>}>;
 items:Record<string,number>;exclude?:number[];forbidNew?:number[];
 attrs?:Array<{id:number;key:string;value:string}>;note?:string[];customerNote?:string[];
 replyAny?:string[];maxReply:number;
 lineNotes?:Array<{id:number;contains:string[];forbid?:string[]}>;
 forbidActions?:string[];
 expectedLines?:ExpectedCartLine[];
 turnCarts?:Array<{turn:number;items:Record<string,number>;forbidActions?:string[]}>;
};
type HumanScenario = {
  id: string; group: string; message?: string; messages?: string[];
  any: string[]; all?: string[]; forbid?: string[];
  minMenu: number; facts?: 'configured' | 'missing';
};
type Scenario = {
  id: string;
  context?: string[];
  messages: string[];
  expectation: string;
  initialCart?: Array<{ productId: number; quantity: number }>;
};
const requireLive = process.env.WHATSAPP_BETA_LIVE === '1';
const token = process.env.OPENAI_API_KEY || '';
if (!requireLive || !token) {
  console.error('Safety gate: use WHATSAPP_BETA_LIVE=1 and OPENAI_API_KEY in a private environment.');
  process.exit(2);
}
const scenarioPath = join(process.cwd(), 'scripts/fixtures/whatsapp-beta-cases.json');
const catalogPath = join(process.cwd(), 'scripts/fixtures/whatsapp-beta-menu.json');
const cases = JSON.parse(readFileSync(scenarioPath, 'utf8')) as Scenario[];
const products = JSON.parse(readFileSync(catalogPath, 'utf8')) as WhatsappCatalogProduct[];
const model = process.env.WHATSAPP_BETA_MODEL || 'gpt-4o-mini';
const apiUsage = new BetaApiUsage();
const originalFetch = globalThis.fetch;
const requestIntervalMs = Math.max(0,Math.min(5000,Number(process.env.WHATSAPP_BETA_REQUEST_INTERVAL_MS)||0));
let lastRequestStart = 0;
let requestStartQueue = Promise.resolve();
// Only this isolated process: observe cloned responses without changing AgentV1.
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  const tracked = args[0] === 'https://api.openai.com/v1/chat/completions';
  if (tracked && requestIntervalMs) {
    const gate=requestStartQueue.then(async()=> {
      const delay=Math.max(0,requestIntervalMs-(Date.now()-lastRequestStart));
      if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
      lastRequestStart=Date.now();
    });
    requestStartQueue=gate.catch(()=>undefined);
    await gate;
  }
  if (tracked) apiUsage.requests++;
  const response = await originalFetch(...args);
  if (tracked) {
    let payload: unknown;
    try { payload = await response.clone().json(); } catch { /* Preserve the real response. */ }
    apiUsage.record(response.status,payload);
  }
  return response;
};
const settings = {
  getEffectiveConfig: async () => ({
    openaiApiKey: token,
    openaiModel: model,
    aiTemperature: 0.2,
    brandName: 'Pronto Pollo Portal (simulación)',
    localContext: { publicPhone: '' },
    systemPrompt: 'Eres un mesero colombiano. No inventes productos, precios ni pedidos. Pregunta si el pedido es ambiguo.',
  }),
};
const catalog = new WhatsappCatalogService({} as never);
const agent = new WhatsappAgentService(settings as never, catalog);
const cartApplier = Object.create(WhatsappOrchestratorService.prototype) as {
  catalogService: WhatsappCatalogService;
  applyActions: (...args: any[]) => Promise<{session: WhatsappSessionData}>;
};
cartApplier.catalogService = catalog;
const actionGuard = new WhatsappActionGuardService(catalog);
// Capture only synthetic rehearsal tool traffic; never log credentials/config.
const tracedAgent = agent as unknown as { executeTool: (...args: any[]) => string };
const executeTool = tracedAgent.executeTool.bind(agent);
let toolTrace: Array<{ name: string; args: unknown; result: unknown }> = [];
tracedAgent.executeTool = (name, args, ctx) => {
  const output = executeTool(name, args, ctx);
  toolTrace.push({ name, args, result: JSON.parse(output) });
  return output;
};
const humanMode = process.env.WHATSAPP_BETA_SUITE === 'human';
const hardMode = process.env.WHATSAPP_BETA_SUITE === 'hard';
const hardScenarios = JSON.parse(readFileSync(
  join(process.cwd(), 'scripts/fixtures/whatsapp-beta-hard-conversations.json'), 'utf8',
)) as HardScenario[];
const humanScenarios = JSON.parse(readFileSync(
  join(process.cwd(), 'scripts/fixtures/whatsapp-beta-human-intents.json'), 'utf8',
)) as HumanScenario[];
const maxCases = Math.max(1, Math.min(
  hardMode ? hardScenarios.length : humanMode ? humanScenarios.length : cases.length,
  Number(process.env.WHATSAPP_BETA_CASE_LIMIT || (hardMode ? 10 : humanMode ? 12 : cases.length)),
));
const offset = Math.max(0, Number(process.env.WHATSAPP_BETA_CASE_OFFSET || 0));
const repeats = Math.max(1, Math.min(3, Number(process.env.WHATSAPP_BETA_REPEATS || 1)));
const results: Array<Record<string, unknown>> = [];
async function runRehearsal(): Promise<void> {
if (hardMode) {
  for (let repetition = 1; repetition <= repeats; repetition++) {
  for (const scenario of hardScenarios.slice(offset, offset + maxCases)) {
    const cart = new Map<number, { productId: number; name: string; quantity: number;
      note?: string; attributes: Array<{attributeName:string;attributeValue:string}> }>();
    const initialLines: WhatsappSessionData['cart'] = [];
    for (const line of scenario.initialCart || []) {
      const product = products.find(p => p.id === line.productId);
      if (!product) throw new Error('Invalid initialCart productId '+line.productId);
      initialLines.push({ productId:line.productId,name:product.name,code:product.code,unitPrice:product.price,
        quantity:line.quantity,note:line.note,attributes:line.attributes || [] });
    }
    // Same SKU may have multiple flavors/notes. Do not collapse seeded lines by ID.
    let session: WhatsappSessionData = { orderType: 'pickup', cart: initialLines };
    const history = [...(scenario.context || [])];
    const turns: Array<Record<string,unknown>> = [];
    let customerNotes = '';
    for (const message of scenario.messages) {
      toolTrace = [];
      const result = await agent.runTurn({
        userMessage:message,sessionSummary:JSON.stringify(session),
        recentMessages:history,
        businessRulesBlock:'Pedidos reales simulados. Siempre usar ids del catálogo y respetar cantidades. Diferenciar atributo del producto (opciones enumeradas), nota de cocina (sin ensalada, extra ají) y nuevo producto. No confirmar órdenes ni ejecutar pagos. Respuestas breves y amables. Para atributos sin elección explícita usar primera opción válida.',
        brandName:'Pronto Pollo Portal (simulación)',products,
        cart:session.cart,
      });
      const actions = result.actions;
      const guarded = actionGuard.sanitize({actions:structuredClone(actions),products,businessOpen:true,allowMercadoPago:false});
      session = (await cartApplier.applyActions({}, session, guarded.actions, products, {}, message)).session;
      cart.clear();
      for (const line of session.cart) {
        const previous = cart.get(line.productId);
        cart.set(line.productId, {...line, attributes:line.attributes || [], quantity: (previous?.quantity || 0) + line.quantity});
      }
      customerNotes = session.customerNotes || '';
      const turn={user:message,reply:result.reply,actions,appliedActions:guarded.actions,guardWarnings:guarded.warnings,toolCalls:result.toolCalls,toolTrace,
        error:result.error || null,cart:session.cart};
      turns.push(structuredClone(turn));
      history.push('Cliente: '+message,'Bot: '+result.reply);
      if(result.error)break;
    }
    const finalCart=session.cart;
    const norm=(v:string)=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const expected=Object.entries(scenario.items);
    const problems:string[]=[];
    if (scenario.expectedLines) {
      if (!matchesExpectedCartLines(scenario.expectedLines, finalCart)) problems.push('wrong_variant_lines');
      if (scenario.expectedLines.length !== finalCart.length) problems.push('wrong_line_count');
      for (const line of scenario.expectedLines) {
        if (!finalCart.some(actual => actual.productId === line.id && actual.quantity === line.quantity &&
          (line.attrs || []).every(a => (actual.attributes || []).some(choice =>
            norm(choice.attributeName) === norm(a.key) && norm(choice.attributeValue) === norm(a.value))) &&
          (line.note || []).every(token => norm(actual.note || '').includes(norm(token)))))
          problems.push('missing_variant_line_' + line.id);
      }
    }
    if(turns.length!==scenario.messages.length)problems.push('turn_count');
    if(turns.some(t=>t.error))problems.push('agent_error');
    for (const expectation of scenario.turnCarts || []) {
      const lines = turns[expectation.turn]?.cart as WhatsappSessionData['cart'] | undefined;
      const quantities = new Map<number,number>();
      for (const line of lines || []) quantities.set(line.productId,(quantities.get(line.productId)||0)+line.quantity);
      if (!lines || quantities.size !== Object.keys(expectation.items).length ||
        Object.entries(expectation.items).some(([id,quantity])=>quantities.get(Number(id))!==quantity)) {
        problems.push('wrong_cart_after_turn_'+expectation.turn);
      }
      for (const action of expectation.forbidActions || []) {
        if (Object.prototype.hasOwnProperty.call(turns[expectation.turn]?.actions || {}, action))
          problems.push('forbidden_action_after_turn_'+expectation.turn+'_'+action);
      }
    }
    for (const action of scenario.forbidActions || []) {
      if (turns.some(t => Object.prototype.hasOwnProperty.call(t.actions, action)))
        problems.push('forbidden_action_' + action);
    }
    if(expected.length!==cart.size ||
      expected.some(([id,qty])=>cart.get(Number(id))?.quantity!==qty))problems.push('wrong_cart');
    for(const id of scenario.exclude || [])if(cart.has(id))problems.push('extra_'+id);
    for(const id of scenario.forbidNew || []){
      const seeded=scenario.initialCart?.find(c=>c.productId===id)?.quantity || 0;
      if((cart.get(id)?.quantity||0)>seeded)problems.push('duplicate_'+id);
    }
    for(const attr of scenario.attrs||[]){
      const values=finalCart.filter(line=>line.productId===attr.id).flatMap(line=>line.attributes || []).filter(a=>norm(a.attributeName)===norm(attr.key)).map(a=>norm(a.attributeValue));
      if(!values.includes(norm(attr.value)))problems.push('missing_attr_'+attr.id+'_'+attr.key);
    }
    const noteText=norm(finalCart.map(c=>c.note||'').join(' ')+' '+customerNotes);
    for(const token of [...(scenario.note||[]),...(scenario.customerNote||[])])
      if(!noteText.includes(norm(token)))problems.push('missing_note_'+token);
    for (const requirement of scenario.lineNotes || []) {
      const note = norm(cart.get(requirement.id)?.note || '');
      for (const value of requirement.contains)
        if (!note.includes(norm(value))) problems.push('missing_line_note_' + requirement.id + '_' + value);
      for (const value of requirement.forbid || [])
        if (note.includes(norm(value))) problems.push('misplaced_note_' + requirement.id + '_' + value);
    }
    for (const line of finalCart) {
      const product = products.find(p => p.id === line.productId)!;
      for (const choice of line.attributes || []) {
        const definition = product.attributes?.find(a => norm(a.attributeName) === norm(choice.attributeName));
        if (!definition?.options.some(o => norm(o) === norm(choice.attributeValue)))
          problems.push('non_catalog_attribute_' + line.productId);
      }
    }
    if(scenario.replyAny?.length){
      const answer=norm(turns.map(t=>String(t.reply)).join(' '));
      if(!scenario.replyAny.some(t=>answer.includes(norm(t))))problems.push('reply_intent');
    }
    for(const turn of turns){
      if(String(turn.reply).length>scenario.maxReply)problems.push('reply_too_long');
    }
    results.push({scenario:scenario.id,repetition,group:scenario.group,accepted:problems.length===0,
      problems,expected:scenario.items,finalCart,customerNotes,turns});
  }
  }
} else if (humanMode) {
  for (const scenario of humanScenarios.slice(offset, offset + maxCases)) {
    const messages = scenario.messages || [scenario.message || ''];
    const history: string[] = [];
    const turns: Array<Record<string, unknown>> = [];
    const facts = scenario.facts === 'configured'
      ? 'Datos ficticios de PRUEBA, no son datos reales del local: dirección CALLE BETA 123, Bogotá. Horario de cierre 21:00. Domicilio de prueba para Castilla: verificar cobertura antes de confirmar. Tiempo estimado: 35–45 minutos.'
      : 'No tenemos datos verificados de dirección, horario ni apertura actual. Nunca inventar esos datos; indicar que se necesita confirmación.';
    for (const message of messages) {
      const result = await agent.runTurn({
        userMessage: message,
        sessionSummary: 'carrito vacío, no hay pedidos creados',
        recentMessages: history,
        businessRulesBlock: [
          'Cliente está haciendo preguntas informativas, NO agregues artículos ni confirmes pedidos.',
          'Ofrece platos SOLO si existen en el catálogo de pruebas; no inventes precios, ingredientes ni disponibilidad.',
          'Para carne incluye cortes de res o cerdo (churrasco, sobrebarriga, costillas). Para dulce no inventes brownies ni helados.',
          'Para preguntas sobre local y horario SOLO utiliza estos datos de prueba:',
          facts,
        ].join('\n'),
        brandName: 'Pronto Pollo Portal (simulación)',
        products,
      });
      turns.push({user:message,reply:result.reply,actions:result.actions,toolCalls:result.toolCalls,error:result.error||null});
      history.push('Cliente: '+message,'Bot: '+result.reply);
      if (result.error) break;
    }
    const last = turns[turns.length - 1];
    const reply = String(last?.reply || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const normalize = (value: string) => value.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const matched = (terms: string[]) => terms.some(t => reply.includes(normalize(t)));
    const accepted = turns.length === messages.length &&
      turns.every(t => !t.error && !Object.keys(t.actions as object).some(k =>
        ['addItems','clearCart','removeProductIds','removeCartLines','updateCartLines','updateAttributes','setCustomerName','setAddress'].includes(k))) &&
      matched(scenario.any) && (scenario.all || []).every(t => reply.includes(normalize(t))) &&
      !(scenario.forbid || []).some(t => reply.includes(normalize(t)));
    results.push({scenario:scenario.id,group:scenario.group,accepted,turns,
      checks:{matchedAny:matched(scenario.any),forbidden:(scenario.forbid||[]).filter(t=>reply.includes(normalize(t)))}});
  }
} else {
for (const scenario of cases.slice(offset, offset + maxCases)) {
  const history = [...(scenario.context || [])];
  const cart = new Map<number, { productId: number; name: string; quantity: number }>();
  for (const initial of scenario.initialCart || []) {
    const product = products.find((p) => p.id === initial.productId);
    if (!product) throw new Error('Unknown seeded product id');
    cart.set(initial.productId, {
      productId: product.id,
      name: product.name,
      quantity: initial.quantity,
    });
  }
  const turns: Array<Record<string, unknown>> = [];
  for (const message of scenario.messages) {
    const summary = JSON.stringify({ cart: [...cart.values()] });
    const result = await agent.runTurn({
      userMessage: message,
      sessionSummary: summary,
      recentMessages: history,
      businessRulesBlock: 'Simulación: no ejecutar pagos ni crear órdenes. Solo proponer acciones válidas para productos del catálogo proporcionado.',
      brandName: 'Pronto Pollo Portal',
      products,
      cart: [...cart.values()],
    });
    const turnLines = [...cart.values()];
    for (const removal of result.actions.removeCartLines || []) {
      if (turnLines[removal.cartLineIndex]?.productId === removal.productId) cart.delete(removal.productId);
    }
    for (const update of result.actions.updateCartLines || []) {
      if (turnLines[update.cartLineIndex]?.productId === update.productId && update.quantity !== undefined && cart.has(update.productId)) {
        cart.set(update.productId, {...cart.get(update.productId)!,quantity:update.quantity});
      }
    }
    for (const id of result.actions.removeProductIds || []) cart.delete(id);
    if (result.actions.clearCart) cart.clear();
    for (const item of result.actions.addItems || []) {
      if (!products.some((p) => p.id === item.productId)) throw new Error('Non-catalog product: '+item.productId);
      const old = cart.get(item.productId);
      const quantity = Math.max(1, item.quantity || 1);
      cart.set(item.productId, {
        productId: item.productId,
        name: products.find((p) => p.id === item.productId)!.name,
        quantity: (old?.quantity || 0) + quantity,
      });
    }
    const turn = { user: message, reply: result.reply, actions: result.actions,
      toolCalls: result.toolCalls, error: result.error || null, cart: [...cart.values()] };
    turns.push(turn);
    history.push('Cliente: '+message, 'Bot: '+result.reply);
    if (result.error) break;
  }
  // Guardarraíles de aceptación: ejecución correcta de OpenAI no basta.
  // Si el carrito final contiene productos ajenos, la prueba debe fallar.
  const finalCart = [...cart.values()];
  let accepted: boolean | null = null;
  if (scenario.id === 'sopas-correccion') {
    accepted = finalCart.length === 2 &&
      finalCart.some((p) => p.productId === 20 && p.quantity === 2) &&
      finalCart.some((p) => p.productId === 38 && p.quantity === 2);
  } else if (scenario.id === 'arroz-pechuga-yuca') {
    const first = turns[0]?.actions as { addItems?: Array<{ productId: number }>; setCustomerNotes?: string } | undefined;
    const address = turns[1]?.actions as { addItems?: Array<{ productId: number }>; setAddress?: string } | undefined;
    // Un pedido no se debe "recuperar" artificialmente cuando el cliente
    // solo informa la dirección, y "pechuga" no elige plancha/gratinada.
    accepted = !!first?.addItems?.some((item) => item.productId === 23) &&
      !!first.setCustomerNotes?.match(/yuca/i) &&
      !(first.addItems || []).some((item) => item.productId === 25 || item.productId === 61) &&
      !!address?.setAddress &&
      !(address.addItems?.length) &&
      finalCart.some((p) => p.productId === 23) &&
      !finalCart.some((p) => p.productId === 25 || p.productId === 61);
  } else if (scenario.id === 'arroz-chino-familia') {
    const browseReply = String(turns[0]?.reply || '').toLowerCase();
    const styleReply = String(turns[1]?.reply || '').toLowerCase();
    accepted = turns.length === 2 &&
      /arroz chino/.test(browseReply) && /cu[aá]l|opci[oó]n|presentaci[oó]n/.test(browseReply) &&
      /broaster/.test(styleReply) && !/no (?:manejamos|tenemos|ofrecemos)/.test(styleReply) &&
      turns.every((turn) => !(turn.actions as { addItems?: unknown[] } | undefined)?.addItems?.length) &&
      finalCart.length === 0;
  } else if (scenario.id === 'ejecutivo-estilo') {
    const reply = String(turns[0]?.reply || '').toLowerCase();
    accepted = (
      finalCart.length === 1 && finalCart[0].productId === 22 && finalCart[0].quantity === 1
    ) || (
      finalCart.length === 0 &&
      /ejecutivo con pollo frito/.test(reply) && /presa/.test(reply) && /sopa/.test(reply)
    );
  } else if (scenario.id === 'nota-aji') {
    const action = turns[0]?.actions as { setCustomerNotes?: string; setCustomerName?: string; addItems?: unknown[] } | undefined;
    accepted = !!action?.setCustomerNotes?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/aji/i) &&
      !action.setCustomerName && !(action.addItems?.length) &&
      finalCart.length === 1 && finalCart[0].productId === 23;
  } else if (scenario.id === 'sopas-por-codigos') {
    accepted = finalCart.length === 2 &&
      finalCart.some((p) => p.productId === 20 && p.quantity === 2) &&
      finalCart.some((p) => p.productId === 38 && p.quantity === 2);
  }
  if (accepted === null) throw new Error('Scenario has no acceptance assertion: '+scenario.id);
  results.push({ scenario: scenario.id, expectation: scenario.expectation, accepted, turns });
}
}
const report = { kind: hardMode ? 'isolated-hard-dialogues' : humanMode ? 'isolated-human-intents' : 'isolated-agent-rehearsal', model, date: new Date().toISOString(),
  caveat: 'Hard cases use AgentV1, ActionGuard and real orchestrator applyActions. Not the full inbound router, Meta, DB, or order creation.',
  apiUsage: apiUsage.summary(model), scenarios: results };
mkdirSync(join(process.cwd(), 'tmp'), { recursive: true });
writeFileSync(join(process.cwd(), 'tmp/whatsapp-beta-ai-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ scenarios: results.length, model,
  report: 'tmp/whatsapp-beta-ai-report.json',
  errors: results.flatMap((x) => (x.turns as Array<{error:string|null}>).filter(t=>t.error).map(t=>t.error)),
  accepted: results.filter(x => x.accepted === true).length,
  rejected: results.filter(x => x.accepted === false).map(x => x.scenario) },null,2));
console.log('API_USAGE_SUMMARY '+JSON.stringify(apiUsage.summary(model)));
for (const rejected of results.filter(x => x.accepted === false)) {
  console.log('REJECTED_SCENARIO ' + JSON.stringify(rejected));
}
if (!results.length || results.some(x => x.accepted === false)) process.exitCode = 1;
}
void runRehearsal().catch((err: unknown) => {
  console.error('Beta rehearsal failed:', err instanceof Error ? err.message : 'unknown');
  process.exitCode = 1;
}).finally(()=>{globalThis.fetch=originalFetch;});
