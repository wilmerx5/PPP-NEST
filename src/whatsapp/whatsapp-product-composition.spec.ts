import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { catalogAccompanimentReply } from './whatsapp-product-composition';
import { readFileSync } from 'fs';
import { join } from 'path';

const products = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));
const catalog = new WhatsappCatalogService({} as never);

describe('Accompaniment facts use the named dish, not the previous suggestion', () => {
  it.each([
    '¿Las costillas de cerdo traen ensalada?', 'Las costillas de cerdo tienen ensalada',
    '¿Las costillas de cerdo incluyen ensalada?', '¿Las costillas de cerdo vienen con ensalada?',
    '¿Las costillas de cerdo llevan ensalada?', '¿Las costillas de cerdo contienen ensalada?',
  ])('recognizes the composition inquiry %s', text => {
    expect(catalog.isProductDescriptionInquiry(text)).toBe(true);
  });
  it.each([
    '¿Las costillas de cerdo traen ensalada?', 'Las costillas de cerdo tienen ensalada',
    '¿Las costillas de cerdo incluyen ensalada?', '¿Las costillas de cerdo vienen con ensalada?',
  ])('does not inherit churrasco accompaniments for %s', async text => {
    const service = new WhatsappAgentService({ getEffectiveConfig: async () => ({}) } as never, catalog);
    const response = await service.runTurn({ userMessage: text, products, cart: [],
      brandName: 'Test Restaurant', businessRulesBlock: '', sessionSummary: '',
      recentMessages: ['Bot: El churrasco trae papa francesa, ensalada y arroz.'] });
    expect(response.reply).toMatch(/costillas de cerdo/i);
    expect(response.reply).toMatch(/no incluye ensalada/i);
    expect(response.reply).toMatch(/yuca frita/i);
    expect(response.actions).toEqual({}); expect(response.toolCalls).toEqual([]);
    expect(response.error).toBeUndefined();
  });
  it.each(['¿El churrasco trae ensalada?', '¿La sobrebarriga incluye ensalada?'])('answers positive inclusion %s', text => {
    expect(catalogAccompanimentReply(text, products, catalog)).toMatch(/^Sí,.*incluye ensalada/);
  });
  it('answers its own yuca inclusion and preserves all existing cart data', async () => {
    const service = new WhatsappAgentService({ getEffectiveConfig: async () => ({}) } as never, catalog);
    const cart = [{ productId: 17, name: 'Churrasco', quantity: 3, note: 'sin ensalada' }];
    const response = await service.runTurn({ userMessage: '¿Las costillas de cerdo traen yuca?', products, cart,
      brandName: 'Test', businessRulesBlock: '', sessionSummary: '', recentMessages: [] });
    expect(response.reply).toMatch(/^Sí,.*incluye yuca/);
    expect(response.actions).toEqual({}); expect(cart[0].quantity).toBe(3); expect(cart[0].note).toBe('sin ensalada');
  });
  it('does not invent missing descriptions or turn attribute choices into included accompaniments', () => {
    const item = { ...products.find(p => p.id === 60), description: '' };
    expect(catalogAccompanimentReply('¿Las costillas de cerdo traen ensalada?', [item], catalog)).toMatch(/no confirma/);
    item.description = 'Acompañadas con arroz';
    item.attributes = [{ attributeName: 'Acompañamiento', options: ['Ensalada', 'Papas'] }];
    expect(catalogAccompanimentReply('¿Las costillas de cerdo traen ensalada?', [item], catalog)).toMatch(/depende de la elección/);
  });
  it('respects explicitly excluded ingredients and ignores unavailable dishes', () => {
    const item = { ...products.find(p => p.id === 60), description: 'Sin ensalada. Con yuca y arroz' };
    expect(catalogAccompanimentReply('¿Las costillas de cerdo traen ensalada?', [item], catalog)).toMatch(/no incluye ensalada/);
    expect(catalogAccompanimentReply('¿Las costillas de cerdo traen ensalada?', [{ ...item, availableNow: false }], catalog)).toBeNull();
  });
  it.each([
    'Agrega unas costillas de cerdo sin arroz', 'Quiero costillas de cerdo con ensalada',
    'Cambia las costillas de cerdo por churrasco', '¿Las costillas y el churrasco traen ensalada?',
    '¿El plato inexistente trae ensalada?', '¿El churrasco trae gluten?',
  ])('leaves unrelated, compound and allergy requests to the normal handling: %s', text => {
    expect(catalogAccompanimentReply(text, products, catalog)).toBeNull();
  });
});
