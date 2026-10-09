/**
 * Ensayo de Agent V1 con OpenAI REAL y catálogo sintético.
 * NO importa el orquestador, Meta, OrdersService ni repositorios de BD.
 * NUNCA ejecutar automáticamente en CI; requiere flag y key explícitos.
 *
 * OPENAI_API_KEY=<secret> WHATSAPP_BETA_LIVE=1 yarn beta:whatsapp:ai
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { WhatsappAgentService } from '../src/whatsapp/whatsapp-agent.service';
import { WhatsappCatalogService, type WhatsappCatalogProduct } from '../src/whatsapp/whatsapp-catalog.service';

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
const maxCases = Math.max(1, Math.min(cases.length, Number(process.env.WHATSAPP_BETA_CASE_LIMIT || cases.length)));
const results: Array<Record<string, unknown>> = [];
async function runRehearsal(): Promise<void> {
for (const scenario of cases.slice(0, maxCases)) {
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
const report = { kind: 'isolated-agent-rehearsal', model, date: new Date().toISOString(),
  caveat: 'Agent suggestions only. Not the full orchestrator, not WhatsApp Meta, no DB/order write.',
  scenarios: results };
mkdirSync(join(process.cwd(), 'tmp'), { recursive: true });
writeFileSync(join(process.cwd(), 'tmp/whatsapp-beta-ai-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ scenarios: results.length, model,
  report: 'tmp/whatsapp-beta-ai-report.json',
  errors: results.flatMap((x) => (x.turns as Array<{error:string|null}>).filter(t=>t.error).map(t=>t.error)),
  accepted: results.filter(x => x.accepted === true).length,
  rejected: results.filter(x => x.accepted === false).map(x => x.scenario) },null,2));
if (results.some(x => x.accepted === false)) process.exitCode = 1;
}
void runRehearsal().catch((err: unknown) => {
  console.error('Beta rehearsal failed:', err instanceof Error ? err.message : 'unknown');
  process.exitCode = 1;
});
