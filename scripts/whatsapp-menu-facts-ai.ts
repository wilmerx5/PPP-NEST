/** Focused paid inference: synthetic chats, three verified PPP dishes, no Meta/DB/orders. */
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { WhatsappAgentService } from '../src/whatsapp/whatsapp-agent.service';
import { WhatsappCatalogService, WhatsappCatalogProduct } from '../src/whatsapp/whatsapp-catalog.service';
import { BetaApiUsage } from './whatsapp-beta-api-usage';

const model = 'gpt-4.1-2025-04-14';
const apiKey = process.env.OPENAI_API_KEY || '';
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== 'wilmerx5/PPP-NEST' ||
    process.env.GITHUB_REF !== 'refs/heads/fix/whatsapp-regression-baseline' ||
    !['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME || '') ||
    process.env.WHATSAPP_MENU_FACTS_LIVE !== '1' || !apiKey || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  console.error('MENU_FACTS_EXECUTION_NOT_AUTHORIZED');
  process.exit(2);
}
const menu = JSON.parse(readFileSync(join(process.cwd(), 'scripts/fixtures/whatsapp-beta-menu.json'), 'utf8')) as WhatsappCatalogProduct[];
const names = ['Churrasco', 'Sobrebarriga', 'Costillas De Cerdo'];
const products = names.map(name => {
  const product = menu.find(item => item.name === name);
  if (!product) throw Error('MENU_FACTS_FIXTURE_MISSING');
  return product;
});
const expected = [
  { name: 'Churrasco', price: 38000, sides: ['papa francesa', 'ensalada', 'arroz'] },
  { name: 'Sobrebarriga', price: 33000, sides: ['papa francesa', 'ensalada', 'arroz'] },
  { name: 'Costillas De Cerdo', price: 29500, sides: ['papa francesa', 'yuca frita', 'arroz'] },
];
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
for (const facts of expected) {
  const product = products.find(item => item.name === facts.name)!;
  if (Number(product.price) !== facts.price || !facts.sides.every(side => normalize(product.description || '').includes(side))) {
    throw Error('MENU_FACTS_FIXTURE_DIFFERS_FROM_VERIFIED_CATALOG');
  }
}
const usage = new BetaApiUsage();
const originalFetch = globalThis.fetch;
let lastStart = 0;
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  if (args[0] !== 'https://api.openai.com/v1/chat/completions') throw Error('MENU_FACTS_UNEXPECTED_NETWORK_TARGET');
  if (usage.requests >= 48) throw Error('MENU_FACTS_REQUEST_BUDGET_EXCEEDED');
  const delay = Math.max(0, 1500 - (Date.now() - lastStart));
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  lastStart = Date.now();
  usage.requests++;
  let response: Response;
  try { response = await originalFetch(...args); }
  catch (error) { usage.recordTransportFailure(error); throw error; }
  try { usage.record(response.status, await response.clone().json()); }
  catch { usage.record(response.status); }
  return response;
};
const settings = { getEffectiveConfig: async () => ({
  openaiApiKey: apiKey, openaiModel: model, aiTemperature: 0.2,
  systemPrompt: 'Eres un mesero colombiano. No inventes productos, precios ni ingredientes.',
  localContext: { publicPhone: '' },
}) };
const catalog = new WhatsappCatalogService({} as never);
const agent = new WhatsappAgentService(settings as never, catalog);
const cases = [
  { id: 'lunch-meat-offer', message: 'Hola, ¿qué tienen para almorzar? ¿Hay algo con carne?', kind: 'browse' },
  { id: 'compare-different-sides', message: '¿El churrasco y las costillas de cerdo traen los mismos acompañamientos?', kind: 'compare' },
  { id: 'ribs-salad-question', message: '¿Las costillas de cerdo traen ensalada?', kind: 'salad' },
  { id: 'three-dishes-composition', message: '¿Qué acompañamientos traen el churrasco, la sobrebarriga y las costillas de cerdo?', kind: 'composition' },
];
async function main() {
  const results: Array<{ id: string; repetition: number; accepted: boolean; problems: string[]; reply: string }> = [];
  for (let repetition = 1; repetition <= 3; repetition++) {
    for (const test of cases) {
      if (usage.blockingProviderErrorCode || usage.requests >= 48) break;
      const result = await agent.runTurn({
        userMessage: test.message, sessionSummary: 'Carrito vacío; consulta informativa; no existe pedido.',
        recentMessages: [], brandName: 'Pronto Pollo Portal (prueba)', products,
        businessRulesBlock: 'Local abierto. Consulta informativa: no agregar artículos ni crear pedidos. Usar únicamente la carta proporcionada.',
      });
      const reply = normalize(result.reply);
      const problems: string[] = [];
      if (result.error) problems.push('agent_error');
      if (Object.keys(result.actions).length) problems.push('unexpected_cart_action');
      if (!result.reply.trim() || result.reply.length > 420) problems.push('reply_not_concise');
      if (/(?<!no )\b(?:todos|ambos|los tres|los dos)\s+(?:vienen|traen|incluyen|llevan|estan acompanados)(?:\s+con)?\s+(?:papa francesa,?\s*(?:y\s+)?)?(?:ensalada|yuca)\b/.test(reply)) problems.push('unsupported_shared_side');
      if (test.kind === 'browse') {
        const offers = ['churrasco', 'sobrebarriga', 'costillas'].filter(name => reply.includes(name));
        if (offers.length < 2) problems.push('insufficient_meat_options');
        if (/\b(?:ensalada|yuca|arroz|papa)\b/.test(reply)) problems.push('unsolicited_composition');
        for (const facts of expected) {
          const name = facts.name === 'Costillas De Cerdo' ? 'costillas' : normalize(facts.name);
          const price = String(facts.price);
          const formatted = Number(facts.price).toLocaleString('es-CO');
          if (reply.includes(name) && !reply.includes(price) && !reply.includes(formatted)) problems.push('missing_verified_price');
        }
      } else {
        if (!reply.includes('costilla') || !reply.includes('yuca')) problems.push('missing_ribs_fact');
        if (test.kind === 'salad' && !/\bno\b/.test(reply)) problems.push('missing_negative_answer');
        if (['compare', 'composition'].includes(test.kind) && (!reply.includes('churrasco') || !reply.includes('ensalada'))) problems.push('missing_distinct_churrasco_fact');
        if (test.kind === 'composition' && !reply.includes('sobrebarriga')) problems.push('missing_third_dish');
      }
      results.push({ id: test.id, repetition, accepted: !problems.length, problems, reply: result.reply });
    }
  }
  const report = { model, expectedExecutions: 12, executions: results.length,
    passed: results.filter(row => row.accepted).length, apiUsage: usage.summary(model), results,
    limits: 'Curated three-dish catalog, synthetic histories, no deployed Meta or kitchen verification.' };
  mkdirSync('tmp', { recursive: true });
  writeFileSync('tmp/whatsapp-menu-facts-report.json', JSON.stringify(report, null, 2));
  // Only synthetic food queries/replies: useful for checking associations beyond lexical assertions.
  for (const row of results) console.log(JSON.stringify({ menuFactCase: row }));
  console.log(JSON.stringify({ model, executions: report.executions, passed: report.passed, apiUsage: report.apiUsage }));
  process.exitCode = results.length === 12 && results.every(row => row.accepted) ? 0 : 1;
}
main().catch(() => { console.error('MENU_FACTS_EVALUATION_FAILED'); process.exitCode = 1; });
