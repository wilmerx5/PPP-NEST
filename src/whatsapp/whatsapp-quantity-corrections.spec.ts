import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
import { omitRedundantAttributeNote, parseCartQuantityCorrection } from './whatsapp-quantity-correction';

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
describe('Corrections preserve the rest of an existing cart', () => {
  it('changes only the chicken quantity in the reported conversation', async () => {
    const h = harness();
    const initial = structuredClone(h.session.cart);
    expect(await h.send('Solo era Un pollo')).toBe(true);
    expect(h.session.cart).toEqual(initial.map(c => c.productId === 1 ? { ...c, quantity: 1 } : c));
    expect(h.session.pendingMatch).toBeUndefined();
    expect(h.service.reply.mock.calls[0][2]).not.toMatch(/cu[aá]l variante|c[oó]mo lo quieres/i);
  });
  it.each(['building_cart', 'awaiting_attribute', 'awaiting_name', 'awaiting_address', 'awaiting_payment', 'awaiting_final_confirm', 'confirming'])('uses the real inbound router with Agent V1 in %s', async state => {
    const h = harness(); h.conv.state = state;
    const initial = structuredClone(h.session.cart);
    await h.inbound('Solo era Un pollo');
    expect(h.session.cart).toEqual(initial.map(c => c.productId === 1 ? { ...c, quantity: 1 } : c));
    expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it('invalidates the old checkout preference and final-confirmation prompt after a quantity change', async () => {
    const h = harness(); h.session.mpPreferenceId = 'synthetic-old-price'; h.session.awaitingField = 'confirm';
    await h.send('Solo era un pollo');
    expect(h.session.mpPreferenceId).toBeUndefined(); expect(h.session.awaitingField).toBeUndefined();
    expect(h.conv.state).toBe('building_cart');
  });
  it.each([
    ['Solamente era un pollo', 1, 1], ['Únicamente eran dos pollos', 1, 2],
    ['Del pollo solo uno', 1, 1], ['Deja solo un pollo', 1, 1],
    ['Que queden dos pollos en total', 1, 2], ['No eran tres pollos, era uno', 1, 1],
    ['Solo eran dos churrascos', 17, 2], ['Eran una mojarra', 14, 1],
    ['Deja dos churrascos en total, no dos más.', 17, 2],
  ])('corrects %s without changing any other fields', async (text, id, qty) => {
    const h = harness(); const initial = structuredClone(h.session.cart);
    expect(await h.send(text as string)).toBe(true);
    expect(h.session.cart).toEqual(initial.map(c => c.productId === id ? { ...c, quantity: qty } : c));
  });
  it('is idempotent when the customer repeats the same quantity correction', async () => {
    const h = harness(); await h.send('Solo era un pollo'); const first = structuredClone(h.session);
    await h.send('Solo era un pollo'); expect(h.session).toEqual(first);
  });
  it.each([
    [line(4, 2)], [line(1, 2, undefined, [{ attributeName: 'Arepas', attributeValue: 'Blancas' }])],
    [line(1, 2, 'sin sal', [{ attributeName: 'Arepas', attributeValue: 'Fritas' }])],
  ])('asks which existing line and applies only the numeric selection', async extra => {
    const h = harness([...harness().session.cart, extra]);
    const initial = structuredClone(h.session.cart);
    await h.inbound('Solo era un pollo'); expect(h.session.cart).toEqual(initial);
    expect(h.session.pendingCartQuantity?.options).toHaveLength(2);
    await h.inbound('2');
    expect(h.session.cart).toEqual(initial.map((c, i) => i === 3 ? { ...c, quantity: 1 } : c));
    expect(h.session.pendingCartQuantity).toBeUndefined();
  });
  it('narrows preparation explicitly without choosing an unrelated chicken dish', async () => {
    const h = harness([...harness().session.cart, line(4, 2)]);
    await h.send('Solo era un pollo broaster');
    expect(h.session.cart.map(c => [c.productId, c.quantity])).toEqual([[17, 3], [14, 2], [1, 3], [4, 1]]);
  });
  it('does not mistake rice with chicken for the chicken dish being corrected', async () => {
    const h = harness([...harness().session.cart, line(23, 2)]);
    await h.inbound('Solo era un pollo');
    expect(h.session.cart.map(c => [c.productId, c.quantity])).toEqual([[17, 3], [14, 2], [1, 1], [23, 2]]);
    expect(h.session.pendingCartQuantity).toBeUndefined();
  });
  it('keeps an open catalog choice from re-adding the selected existing product', async () => {
    const h = harness(); h.session.pendingMatch = { query: 'pollo', candidates: products.filter(p => [1, 4].includes(p.id)), quantity: 3 };
    await h.inbound('Solo era un pollo');
    expect(h.session.cart.map(c => [c.productId, c.quantity])).toEqual([[17, 3], [14, 2], [1, 1]]);
    expect(h.session.pendingMatch).toBeUndefined();
  });
  it('rejects an invalid line selection while preserving every existing line', async () => {
    const h = harness([...harness().session.cart, line(4, 2)]);
    await h.inbound('Solo era un pollo'); const initial = structuredClone(h.session.cart);
    await h.inbound('9'); expect(h.session.cart).toEqual(initial); expect(h.session.pendingCartQuantity).toBeDefined();
  });
  it('does not use an old numeric selection after a concurrent cart edit', async () => {
    const h = harness([...harness().session.cart, line(4, 2)]);
    await h.send('Solo era un pollo'); h.session.cart.reverse();
    const edited = structuredClone(h.session.cart);
    await h.send('1'); expect(h.session.cart).toEqual(edited); expect(h.session.pendingCartQuantity).toBeUndefined();
  });
  it.each(['0', '31', '100'])('does not mutate a cart for invalid quantity %s', async qty => {
    const h = harness(); const initial = structuredClone(h.session.cart);
    await h.send(`Solo eran ${qty} pollos`); expect(h.session.cart).toEqual(initial);
  });
  it('respects configured order limits without partially changing the cart', async () => {
    const h = harness(); const initial = structuredClone(h.session.cart);
    await h.send('Eran diez pollos', { maxUnitsPerItem: 5 }); expect(h.session.cart).toEqual(initial);
  });
  it('does not add an absent dish as a quantity correction', async () => {
    const h = harness(); const initial = structuredClone(h.session.cart);
    await h.send('Solo eran dos ajiacos'); expect(h.session.cart).toEqual(initial);
  });
  it.each(['Solo quiero un pollo', 'Solo te pedí un combo', 'Vacía el carrito', 'Agrega un pollo',
    'Solo era un pollo y dos mojarras', '¿Son dos pollos?', 'Quita un pollo', '1', 'Sin ensalada',
    'Deja solo un ajiaco, los otros dos no', 'Era un pollo, pero agrega dos limonadas'])('leaves other intents to their existing handlers: %s', text => {
    expect(parseCartQuantityCorrection(text)).toBeNull();
  });
  it.each(['con las arepas fritas', 'Arepas fritas', 'fritas'])('omits a duplicated chosen attribute note: %s', note => {
    expect(omitRedundantAttributeNote(note, [{ attributeName: 'Arepas', attributeValue: 'Fritas' }])).toBeUndefined();
  });
  it.each(['arepas aparte', 'con arepas fritas y sin ensalada', 'papas bien crocantes', 'sin arroz',
    'con las arepas blancas', 'las arepas fritas aparte'])('keeps meaningful or differing kitchen notes: %s', note => {
    expect(omitRedundantAttributeNote(note, [{ attributeName: 'Arepas', attributeValue: 'Fritas' }])).toBe(note);
  });
});
