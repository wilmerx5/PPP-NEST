import { applyLocalGlossary } from './whatsapp-local-glossary';

describe('applyLocalGlossary', () => {
  it('corrige typos frecuentes', () => {
    expect(applyLocalGlossary('quieor un pollo')).toMatch(/quiero/i);
    expect(applyLocalGlossary('3 churrrascos')).toMatch(/churrascos/i);
    expect(applyLocalGlossary('hamburegsa')).toMatch(/hamburguesa/i);
    expect(applyLocalGlossary('par ale conjunto')).toMatch(/para el conjunto/i);
    expect(applyLocalGlossary('ajico')).toMatch(/ajiaco/i);
    expect(applyLocalGlossary('quiero unpollofrito')).toMatch(/un pollo frito/i);
    expect(applyLocalGlossary('domicikio')).toMatch(/^domicilio$/i);
    expect(applyLocalGlossary('Para Un domicikio Para bosques')).toMatch(/domicilio/i);
  });

  it('normaliza tamaño de sopa / ajiaco chico', () => {
    expect(applyLocalGlossary('ajiaco chico')).toMatch(/ajiaco pequeña/i);
    expect(applyLocalGlossary('sopa chiquita')).toMatch(/sopa pequeña/i);
  });

  it('normaliza pollo broaster', () => {
    expect(applyLocalGlossary('pollo a la broaster')).toMatch(/pollo broaster/i);
    expect(applyLocalGlossary('medio de pollo')).toMatch(/medio pollo/i);
  });

  it('corpus: typos y aliases de chats reales', () => {
    expect(applyLocalGlossary('Giger')).toMatch(/ginger/i);
    expect(applyLocalGlossary('sobrebarriga a la placha')).toMatch(/plancha/i);
    expect(applyLocalGlossary('Adicionar un plata')).toMatch(/plátano/i);
    expect(applyLocalGlossary('medio broaster medio frito')).toMatch(/mixto/i);
    expect(applyLocalGlossary('coca cola cero')).toMatch(/zero/i);
    expect(applyLocalGlossary('Q cuestan 2 sopas')).toMatch(/que cuestan/i);
    expect(applyLocalGlossary('A como El arroz Con pollo')).toMatch(/a cuanto/i);
    expect(applyLocalGlossary('sin enslada mas papa')).toMatch(/sin ensalada más papa/i);
    expect(applyLocalGlossary('Dame tmb una botella de agua')).toMatch(/agua 600ml/i);
    // No convertir "cuántas personas alcanza" en pedido
    expect(applyLocalGlossary('Para cuantas personas alcanzas')).not.toMatch(/^quiero/i);
    expect(applyLocalGlossary('me alcanzas a pedir una ensalada')).toMatch(/quiero/i);
  });
});
