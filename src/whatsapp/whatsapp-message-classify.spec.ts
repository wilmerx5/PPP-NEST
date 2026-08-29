import {
  fixFuzzyDomicilioTypos,
  needsAiMessageClassify,
  parseClassifyResult,
  hasFuzzyDomicilioCandidate,
} from './whatsapp-message-classify';
import { applyLocalGlossary } from './whatsapp-local-glossary';

describe('fixFuzzyDomicilioTypos', () => {
  it.each(['domickio', 'domicikio', 'domiclio', 'domisilio', 'dmicilio'])(
    'corrige %s → domicilio',
    (typo) => {
      expect(fixFuzzyDomicilioTypos(typo)).toBe('domicilio');
      expect(applyLocalGlossary(`Para Un ${typo} Para bosques`)).toMatch(/domicilio/i);
    },
  );

  it('no toca domingo / dominio', () => {
    expect(fixFuzzyDomicilioTypos('domingo')).toBe('domingo');
    expect(fixFuzzyDomicilioTypos('dominio')).toBe('dominio');
  });
});

describe('needsAiMessageClassify', () => {
  it('pide classify en logística ambigua', () => {
    expect(needsAiMessageClassify('Para Un domicikio Para bosques De Castilla')).toBe(true);
    expect(needsAiMessageClassify('Quiero Un domicilio, Para bosques De Castilla')).toBe(true);
  });

  it('NO gasta IA en pedido claro', () => {
    expect(needsAiMessageClassify('quiero un medio pollo broaster')).toBe(false);
    expect(needsAiMessageClassify('28')).toBe(false);
    expect(needsAiMessageClassify('listo')).toBe(false);
  });

  it('detecta candidato fuzzy', () => {
    expect(hasFuzzyDomicilioCandidate('quiero un domickio')).toBe(true);
  });
});

describe('parseClassifyResult', () => {
  it('parsea JSON válido', () => {
    const r = parseClassifyResult(
      {
        intent: 'delivery_setup',
        normalizedText: 'para un domicilio para bosques de castilla',
        address: 'Bosques de Castilla',
        hasFoodItems: false,
        confidence: 0.9,
      },
      'raw',
    );
    expect(r?.intent).toBe('delivery_setup');
    expect(r?.address).toMatch(/Bosques/i);
  });

  it('rechaza intent inválido', () => {
    expect(parseClassifyResult({ intent: 'hack' }, 'x')).toBeNull();
  });
});
