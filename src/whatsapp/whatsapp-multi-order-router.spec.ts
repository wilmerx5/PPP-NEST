import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { applyLocalGlossary } from './whatsapp-local-glossary';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
const products = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));
const catalog = new WhatsappCatalogService({} as never);
async function route(raw: string) {
  const service = Object.create(WhatsappOrchestratorService.prototype) as any;
  service.catalogService = catalog;
  let session: WhatsappSessionData = { cart: [], orderType: 'pickup' };
  const conv = { id: 1, state: 'building_cart', customerName: 'Cliente Prueba', sessionData: session };
  service.conversationService = {
    saveSession: jest.fn(async (_conv, next, state) => { session = structuredClone(next); conv.sessionData = session; if (state) conv.state = state; }),
    reloadConversation: jest.fn(async () => conv), getSession: () => session,
  };
  service.reply = jest.fn(async () => undefined);
  service.ensureDeliveryFeeQuoted = jest.fn(async value => ({ session: value }));
  const text = applyLocalGlossary(raw);
  const multi = catalog.resolveMultiProductOrder(text, products);
  expect(multi?.ambiguous).toEqual([]); expect(multi?.unresolved).toEqual([]);
  expect(await service.tryHandleMultiProductOrder(conv, 'synthetic', session, multi, { paymentMethods: [] }, text, products, text)).toBe(true);
  return session;
}
describe('Resolved multi orders persisted through the real router path', () => {
  it.each([
    'Quiero un churrasco sin ensalada y dos sobrebarrigas: una asada y otra en salsa.',
    'Un churrasco sin ensalada y 2 sobrebarrigas: 1 asada y 1 en salsa.',
  ])('keeps each preparation, quantity and dish note: %s', async text => {
    const session = await route(text);
    expect(session.cart).toHaveLength(3);
    expect(session.cart.map(c => c.quantity)).toEqual([1, 1, 1]);
    expect(session.cart.find(c => c.productId === 17)?.note).toContain('sin ensalada');
    expect(session.cart.filter(c => c.productId === 13).map(c => c.attributes?.[0].attributeValue)).toEqual(['Asada', 'En Salsa']);
    expect(session.cart.filter(c => c.productId === 13).every(c => !c.note)).toBe(true);
  });
  it('preserves uneven quantities in separately named variants', async () => {
    const session = await route('Tres sobrebarrigas: dos asadas y una en salsa.');
    expect(session.cart.map(c => c.quantity)).toEqual([2, 1]);
    expect(session.cart.map(c => c.attributes?.[0].attributeValue)).toEqual(['Asada', 'En Salsa']);
  });
  it.each([
    ['Dos sobrebarrigas asadas y una sobrebarriga en salsa', 13, 'Seleccion', ['Asada', 'En Salsa'], [2, 1]],
    ['Una trucha asada y otra trucha frita', 12, 'Seleccion', ['Asada', 'Frita'], [1, 1]],
  ])('scopes choices of repeated products: %s', async (text, id, key, choices, quantities) => {
    const session = await route(text as string);
    expect(session.cart).toHaveLength(2);
    expect(session.cart.every(c => c.productId === id)).toBe(true);
    expect(session.cart.map(c => c.quantity)).toEqual(quantities);
    expect(session.cart.map(c => c.attributes?.find(a => a.attributeName === key)?.attributeValue)).toEqual(choices);
  });
  it('keeps packaging on chicken while preserving a different dish exclusion', async () => {
    const session = await route('Dos churrascos sin ensalada y un pollo broaster con arepas fritas aparte');
    expect(session.cart.map(c => [c.productId, c.quantity])).toEqual([[17, 2], [4, 1]]);
    expect(session.cart[0].note).toContain('sin ensalada');
    expect(session.cart[1].attributes).toContainEqual({ attributeName: 'Arepas', attributeValue: 'Fritas' });
    expect(session.cart[1].note).toContain('aparte');
    expect(session.cart[1].note).not.toContain('ensalada');
  });
  it('does not add a paid arepa portion when selecting the included chicken accompaniment', async () => {
    const session = await route('Tres churrascos sin ensalada, dos mojarras asadas y tres pollos fritos con las arepas fritas.');
    expect(session.cart.map(c => [c.productId, c.quantity])).toEqual([[17, 3], [14, 2], [1, 3]]);
    expect(session.cart[0].note).toBe('sin ensalada');
    expect(session.cart[1].attributes).toContainEqual({attributeName:'Seleccion',attributeValue:'Asada'});
    expect(session.cart[2].attributes).toContainEqual({attributeName:'Arepas',attributeValue:'Fritas'});
    expect(session.cart[2].note).toBeUndefined();
  });
  it.each(['con las arepas blancas', 'con las arepas blancas aparte'])('keeps declared accompaniments on broaster: %s', async choice => {
    const session = await route('Dos churrascos sin ensalada y dos pollos broaster ' + choice);
    expect(session.cart.map(c => [c.productId, c.quantity])).toEqual([[17,2],[4,2]]);
    expect(session.cart[1].attributes).toContainEqual({attributeName:'Arepas',attributeValue:'Blancas'});
    expect(session.cart[0].note).toBe('sin ensalada');
    if (choice.endsWith('aparte')) expect(session.cart[1].note).toContain('aparte');
  });
  it('still adds an explicitly ordered separate arepa portion', async () => {
    const session = await route('Un churrasco y un pollo frito con una porción de arepas fritas.');
    expect(session.cart.map(c => [c.productId,c.quantity]).sort((a,b)=>a[0]-b[0])).toEqual([[1,1],[11,1],[17,1]]);
    expect(session.cart.find(c=>c.productId===11)?.attributes).toContainEqual({attributeName:'Arepas',attributeValue:'Fritas'});
  });
});
