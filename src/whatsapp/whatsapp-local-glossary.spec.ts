import { applyLocalGlossary } from './whatsapp-local-glossary';

describe('applyLocalGlossary', () => {
  it('corrige typos frecuentes', () => {
    expect(applyLocalGlossary('quieor un pollo')).toMatch(/quiero/i);
    expect(applyLocalGlossary('3 churrrascos')).toMatch(/churrascos/i);
    expect(applyLocalGlossary('hamburegsa')).toMatch(/hamburguesa/i);
    expect(applyLocalGlossary('par ale conjunto')).toMatch(/para el conjunto/i);
    expect(applyLocalGlossary('ajico')).toMatch(/ajiaco/i);
    expect(applyLocalGlossary('quiero unpollofrito')).toMatch(/un pollo frito/i);
  });

  it('normaliza tamaño de sopa / ajiaco chico', () => {
    expect(applyLocalGlossary('ajiaco chico')).toMatch(/ajiaco pequeña/i);
    expect(applyLocalGlossary('sopa chiquita')).toMatch(/sopa pequeña/i);
  });

  it('normaliza pollo broaster', () => {
    expect(applyLocalGlossary('pollo a la broaster')).toMatch(/pollo broaster/i);
    expect(applyLocalGlossary('medio de pollo')).toMatch(/medio pollo/i);
  });
});
