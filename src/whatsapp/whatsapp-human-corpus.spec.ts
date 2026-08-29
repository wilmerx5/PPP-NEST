import {
  classifyWhatsappCustomerIntent,
  looksLikeAddressOnlyMessage,
} from './whatsapp-intent';
import { applyLocalGlossary } from './whatsapp-local-glossary';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import {
  CORPUS_ADDRESS_ONLY_SAMPLES,
  CORPUS_GLOSSARY_SAMPLES,
  CORPUS_MULTI_ITEM_SAMPLES,
  CORPUS_NOT_ADDRESS_SAMPLES,
  CORPUS_SIDE_NOTE_SAMPLES,
} from './whatsapp-human-corpus';

describe('corpus humano — glosario', () => {
  it.each(CORPUS_GLOSSARY_SAMPLES)('normaliza "$raw"', ({ raw, expect: re }) => {
    expect(applyLocalGlossary(raw)).toMatch(re);
  });
});

describe('corpus humano — direcciones zona PPP', () => {
  it.each(CORPUS_ADDRESS_ONLY_SAMPLES)('es dirección: %s', (text) => {
    expect(looksLikeAddressOnlyMessage(text)).toBe(true);
    expect(
      classifyWhatsappCustomerIntent({ text, cartLength: 1 }),
    ).toBe('address');
  });

  it.each(CORPUS_NOT_ADDRESS_SAMPLES)('NO es dirección: %s', (text) => {
    expect(looksLikeAddressOnlyMessage(text)).toBe(false);
  });
});

describe('corpus humano — multi / notas', () => {
  const catalog = new WhatsappCatalogService({} as never);

  it.each(CORPUS_MULTI_ITEM_SAMPLES)('detecta varios platos: %s', (text) => {
    const t = applyLocalGlossary(text);
    const multi =
      catalog.looksLikeClearlyMultiDishOrder(t) ||
      catalog.looksLikeMultiItemOrderMessage(t) ||
      catalog.looksLikeFoodPlusDrinkOrder(t);
    expect(multi).toBe(true);
  });

  it.each(CORPUS_SIDE_NOTE_SAMPLES)('nota de guarnición: %s', (text) => {
    const t = applyLocalGlossary(text);
    expect(
      catalog.looksLikeSideModificationNote(t) ||
        /\bsin\s+(ensalada|yuca|cilantro|salsas?)\b/i.test(t),
    ).toBe(true);
  });
});

describe('corpus humano — pago llave', () => {
  it('detecta intención de pago con llave', () => {
    expect(
      classifyWhatsappCustomerIntent({
        text: 'Te cancelo por llave',
        cartLength: 1,
        isPaymentMention: true,
      }),
    ).toBe('payment');
  });
});
