import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
import { parseScopedCartRemoval } from './whatsapp-cart-removal';

const products = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));
const catalog = new WhatsappCatalogService({} as never);
function line(id: number, quantity: number, note?: string, attributes: any[] = []) {
  const p = products.find(p => p.id === id);
  return { productId: id, name: p.name, code: p.code, unitPrice: p.price, quantity, note, attributes };
}
function harness(cart: WhatsappSessionData['cart'] = [line(17, 3, 'sin ensalada'), line(14, 2),
  line(1, 3, 'arepas aparte', [{ attributeName: 'Arepas', attributeValue: 'Fritas' }])]) {
  const service = Object.create(WhatsappOrchestratorService.prototype) as any;
  service.catalogService = new WhatsappCatalogService({} as never);
  service.catalogService.getMenuProducts = jest.fn(async () => products);
  let session: WhatsappSessionData = { cart, orderType: 'pickup' };
  const conv = { id: 1, state: 'building_cart', humanTakeover: false, sessionData: session };
  service.conversationService = {
    saveSession: jest.fn(async (_conv, next, state) => { session = structuredClone(next); conv.sessionData = session; if (state) conv.state = state; }),
    findOrCreateConversation: jest.fn(async () => conv), touchInbound: jest.fn(),
    claimInboundMessage: jest.fn(async () => ({ id: '1' })),
    reloadConversation: jest.fn(async () => conv), getSession: () => session,
    countInboundMessages: jest.fn(async () => 2),
  };
  service.claimedInboundIdsByWaId = new Map();
  service.settingsService = { getEffectiveConfig: async () => ({ enabled: true, agentV1Enabled: true, ignoreBusinessHours: true, paymentMethods: [] }) };
  service.businessService = { getStatus: async () => ({ isOpen: true }) };
  service.agentService = { runTurn: jest.fn(() => { throw Error('Quantity correction must not call OpenAI'); }) };
  service.reply = jest.fn(async () => undefined);
  return { service, conv, get session() { return session; },
    send: (text: string, cfg = {}) => service.tryHandleCartModification(conv, 'synthetic', session, text, products, cfg),
    inbound: (text: string) => service.handleIncomingUnlocked({ waId: 'synthetic', phoneE164: 'synthetic', messageId: 'synthetic-id', messageType: 'text', text }),
  };
}
describe('Explicit removals through the real inbound router', () => {
  const cart = () => [line(17, 2, 'sin ensalada'),
    line(13, 1, undefined, [{attributeName:'Seleccion',attributeValue:'Asada'}]),
    line(13, 1, undefined, [{attributeName:'Seleccion',attributeValue:'En Salsa'}])];
  it.each([
    'Quita la sobrebarriga en salsa; conserva la asada y los churrascos.',
    'Elimina solamente la sobrebarriga en salsa, deja la asada y los churrascos',
    'Retira la sobrebarriga en salsa por favor',
  ])('removes only the named variant without calling OpenAI: %s', async text => {
    const initial = cart(); const h = harness(initial);
    await h.inbound(text);
    expect(h.session.cart).toEqual(initial.slice(0,2));
    expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it('keeps an explicitly protected line when the instruction contradicts itself', async () => {
    const initial = cart(); const h = harness(initial);
    await h.inbound('Quita la sobrebarriga asada; conserva la asada');
    expect(h.session.cart).toEqual(initial);
    expect(h.service.reply.mock.calls.at(-1)[2]).toMatch(/conservar|aclar/i);
    expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it('asks for a choice when the dish has two existing preparations', async () => {
    const initial = cart(); const h = harness(initial);
    await h.inbound('Quita la sobrebarriga');
    expect(h.session.cart).toEqual(initial);
    expect(h.session.pendingCartRemoval?.options).toHaveLength(2);
    expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it('removes only the chosen existing variant after the clarification', async () => {
    const initial = cart(); const h = harness(initial);
    await h.inbound('Quita la sobrebarriga'); await h.inbound('2');
    expect(h.session.cart).toEqual(initial.slice(0,2));
    expect(h.session.pendingCartRemoval).toBeUndefined();
    expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it('does not apply an old numeric selection to a changed cart', async () => {
    const h = harness(cart()); await h.inbound('Quita la sobrebarriga');
    h.session.cart.reverse(); const changed = structuredClone(h.session.cart);
    await h.inbound('2'); expect(h.session.cart).toEqual(changed);
    expect(h.session.pendingCartRemoval).toBeUndefined();
  });
  it.each(['0', '9'])('rejects an invalid removal selection %s', async selection => {
    const initial = cart(); const h = harness(initial);
    await h.inbound('Quita la sobrebarriga'); await h.inbound(selection);
    expect(h.session.cart).toEqual(initial);
    expect(h.session.pendingCartRemoval?.options).toHaveLength(2);
    expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it('keeps the payable order snapshot intact', async () => {
    const h = harness(cart()); h.conv.state = 'awaiting_mp_payment'; h.session.mpPreferenceId = 'synthetic-payable-link';
    const initial = structuredClone(h.session);
    await h.inbound('Quita la sobrebarriga en salsa');
    expect(h.session).toEqual(initial); expect(h.conv.state).toBe('awaiting_mp_payment');
  });
  it('invalidates the old checkout total after a successful removal', async () => {
    const h = harness(cart()); h.conv.state = 'awaiting_final_confirm';
    h.session.mpPreferenceId = 'synthetic-old-price'; h.session.awaitingField = 'confirm';
    await h.inbound('Quita la sobrebarriga en salsa');
    expect(h.session.cart).toHaveLength(2); expect(h.session.mpPreferenceId).toBeUndefined();
    expect(h.session.awaitingField).toBeUndefined(); expect(h.conv.state).toBe('building_cart');
  });
  it.each([
    'Quita el pollo broaster; conserva el pollo frito, las mojarras y los churrascos.',
    'Quita el pollo broaster, conserva el pollo frito, las mojarras y los churrascos.',
  ])('preserves a comma-separated dish list through the full inbound router: %s', async text => {
    const initial = [line(17, 3, 'sin ensalada'), line(14, 2),
      line(1, 1, undefined, [{attributeName:'Arepas',attributeValue:'Fritas'}]),
      line(4, 1, undefined, [{attributeName:'Arepas',attributeValue:'Blancas'}])];
    const h = harness(initial); await h.inbound(text);
    expect(h.session.cart).toEqual(initial.slice(0,3));
    expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it.each([
    'No quites la sobrebarriga', '¿Quita la sobrebarriga?',
    'Quita solamente la nota sin arroz de las costillas.',
    'Quita la nota de papas crocantes de los churrascos y conserva sin ensalada.',
    'Quita el arroz y agrega una limonada', 'Quita la sobrebarriga; agrega una limonada',
    'Quita todo el carrito', 'Quita la sobrebarriga sin ensalada',
    'Quita el pollo frito, el pollo broaster',
    'Quita el pollo broaster; conserva el pollo frito, agrega una limonada',
    'Quita el pollo broaster; conserva el pollo frito y agrega una limonada',
  ])('defers compound, negated, note and question intents: %s', text => {
    expect(parseScopedCartRemoval(text)).toBeNull();
  });
});
