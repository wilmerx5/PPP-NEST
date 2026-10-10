import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
import { parseScopedCartNote, editScopedCartNote } from './whatsapp-cart-note';

const products = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));
const catalog = new WhatsappCatalogService({} as never);
function line(id: number, quantity: number, note?: string, attributes: any[] = []) {
  const p = products.find(p => p.id === id);
  return { productId: id, name: p.name, code: p.code, unitPrice: p.price, quantity, note, attributes };
}
describe('Scoped dish notes through the inbound router', () => {
  const cart = () => [line(17, 2, 'sin ensalada'),
    line(13, 1, undefined, [{ attributeName: 'Seleccion', attributeValue: 'Asada' }])];
  it.each([
    'A los churrascos ponles también papas bien crocantes.',
    'Al churrasco ponle papas bien crocantes',
    'Para los churrascos anótales también papas crocantes',
  ])('adds the requested note while preserving the exclusion and other dish: %s', async text => {
    const initial = cart(); const h = harness(initial); await h.inbound(text);
    expect(h.session.cart[0].note).toMatch(/^sin ensalada; papas (bien )?crocantes$/);
    expect(h.session.cart[0].quantity).toBe(2); expect(h.session.cart[1]).toEqual(initial[1]);
    expect(h.session.customerNotes).toBeUndefined(); expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it('uses the variant in the target and preserves the other preparation instead of changing its attribute',async()=>{
    const initial=[line(1,2,undefined,[{attributeName:'Arepas',attributeValue:'Blancas'}]),
      line(1,1,undefined,[{attributeName:'Arepas',attributeValue:'Fritas'}])];
    const h=harness(initial);
    await h.inbound('A los pollos de arepas blancas ponles sin salsa. El de arepas fritas déjalo igual');
    expect(h.session.cart[0]).toEqual({...initial[0],note:'sin salsa'});
    expect(h.session.cart[1]).toEqual(initial[1]);
  });
  it('does not parse an additional sentence that requests another modification as a preservation',()=>{
    expect(parseScopedCartNote('A los pollos ponles sin salsa. Agrega dos bebidas')).toBeNull();
  });
  it('adds and then removes only the cooking note in consecutive turns', async () => {
    const initial = cart(); const h = harness(initial);
    await h.inbound('A los churrascos ponles también papas bien crocantes.');
    await h.inbound('Quita la nota de papas crocantes de los churrascos y conserva sin ensalada.');
    expect(h.session.cart).toEqual(initial); expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it('removes an exclusion without removing the dish or changing its quantity', async () => {
    const initial = [line(60, 2, 'sin arroz; ají aparte'), ...cart()]; const h = harness(initial);
    await h.inbound('Quita solamente la nota sin arroz de las costillas.');
    expect(h.session.cart[0]).toEqual({ ...initial[0], note: 'ají aparte' });
    expect(h.session.cart.slice(1)).toEqual(initial.slice(1));
  });
  it('clears the last note instead of creating a redundant default note', async () => {
    const initial = [line(60, 1, 'sin arroz'), ...cart()]; const h = harness(initial);
    await h.inbound('Quita solamente la nota sin arroz de las costillas.');
    expect(h.session.cart[0].note).toBeUndefined(); expect(h.session.cart).toHaveLength(3);
  });
  it('deduplicates a repeated additive instruction', async () => {
    const h = harness(cart()); const text = 'A los churrascos ponles también papas bien crocantes.';
    await h.inbound(text); const after = structuredClone(h.session); await h.inbound(text);
    expect(h.session).toEqual(after);
  });
  it('asks for preparation when two existing variants match', async () => {
    const initial = [line(17, 1, 'sin ensalada'), line(17, 1, 'sin arroz')]; const h = harness(initial);
    await h.inbound('A los churrascos ponles también papas crocantes.');
    expect(h.session.cart).toEqual(initial); expect(h.service.reply.mock.calls.at(-1)[2]).toMatch(/varias líneas/);
  });
  it('keeps a payable order snapshot unchanged', async () => {
    const h = harness(cart()); h.conv.state = 'awaiting_mp_payment'; h.session.mpPreferenceId = 'synthetic-payable';
    const before = structuredClone(h.session); await h.inbound('A los churrascos ponles también papas crocantes.');
    expect(h.session).toEqual(before); expect(h.conv.state).toBe('awaiting_mp_payment');
  });
  it('invalidates a stale final confirmation after editing the note', async () => {
    const h = harness(cart()); h.conv.state = 'awaiting_final_confirm'; h.session.awaitingField = 'confirm';
    h.session.mpPreferenceId = 'synthetic-stale'; await h.inbound('A los churrascos ponles también papas crocantes.');
    expect(h.conv.state).toBe('building_cart'); expect(h.session.awaitingField).toBeUndefined();
    expect(h.session.mpPreferenceId).toBeUndefined();
  });
  it('does not convert a declared preparation into a note', async () => {
    const h = harness([line(1, 1, undefined, [{ attributeName: 'Arepas', attributeValue: 'Blancas' }])]);
    expect(await h.send('Al pollo frito ponle arepas fritas aparte')).toBe(false);
    expect(h.session.cart[0].note).toBeUndefined();
  });
  it('does not delete a whole mixed clause to remove one substring', async () => {
    const initial = [line(17, 2, 'sin ensalada y papas crocantes'), cart()[1]]; const h = harness(initial);
    await h.inbound('Quita la nota de papas crocantes de los churrascos y conserva sin ensalada.');
    expect(h.session.cart).toEqual(initial); expect(h.service.reply.mock.calls.at(-1)[2]).toMatch(/aclarar/);
  });
  it('does not silently truncate an existing long note', async () => {
    const initial = [line(17, 2, 'x'.repeat(195)), cart()[1]]; const h = harness(initial);
    await h.inbound('A los churrascos ponles también papas crocantes.'); expect(h.session.cart).toEqual(initial);
  });
  it.each([
    '¿A los churrascos ponles papas crocantes?',
    'No, a los churrascos ponles papas crocantes',
    'A los churrascos ponles dos limonadas',
    'A los churrascos ponles papas crocantes y dos limonadas',
    'A los churrascos ponles papas crocantes; agrega una limonada',
    'A los churrascos ponles papas crocantes y agrega una limonada',
    'A uno de los churrascos ponle papas crocantes',
    'Quita la nota sin arroz de las costillas y agrega una limonada',
  ])('defers questions, negation, partial quantities and compound orders: %s', text => {
    expect(parseScopedCartNote(text)).toBeNull();
  });
});
describe('Quoted purchase context through the inbound router', () => {
  it('accepts two quoted units without inventing a SKU or relying on a model reply', async () => {
    const h = harness([]);
    h.service.conversationService.getLastOutboundBody = jest.fn(async () =>
      'La Sopa De Ajiaco cuesta $10.500; dos serían $21.000. ¿Quieres agregarlas al pedido?');
    await h.inbound('Sí, agrégame las dos');
    expect(h.session.cart.map(item => [item.productId,item.quantity])).toEqual([[38,2]]);
    expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
  it('asks which existing dish a demonstrative means instead of opening an unrelated product list', async () => {
    const initial = [line(38,2),line(17,1)]; const h = harness(initial);
    await h.inbound('Ponle otra unidad a ese');
    expect(h.session.cart).toEqual(initial);
    expect(h.session.pendingMatch).toBeUndefined();
    expect(h.service.reply.mock.calls.at(-1)[2]).toMatch(/cuál producto/);
    expect(h.service.agentService.runTurn).not.toHaveBeenCalled();
  });
});
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
  service.agentService = { runTurn: jest.fn(() => { throw Error('Scoped dish note must not call OpenAI'); }) };
  service.reply = jest.fn(async () => undefined);
  return { service, conv, get session() { return session; },
    send: (text: string, cfg = {}) => service.tryHandleScopedCartNote(conv, 'synthetic', session, text, cfg),
    inbound: (text: string) => service.handleIncomingUnlocked({ waId: 'synthetic', phoneE164: 'synthetic', messageId: 'synthetic-id', messageType: 'text', text }),
  };
}
