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
    expect(applyLocalGlossary('Tres pillos fritos')).toMatch(/tres pollos fritos/i);
    expect(applyLocalGlossary('Tienes juegos?')).toMatch(/jugos/i);
    expect(applyLocalGlossary('Quiero Un menu ejecutivo con Pollo frito')).toMatch(
      /ejecutivo.*pollo frito/i,
    );
    expect(applyLocalGlossary('Una pequeñas por favor')).toMatch(/una pequeña/i);
    expect(applyLocalGlossary('Regalame pollo y medio porfavor')).toMatch(
      /1 pollo y medio pollo/i,
    );
  });

  it('normaliza combo de arroz chino', () => {
    expect(applyLocalGlossary('y me vendes un combo de arroz chino')).toMatch(
      /arroz chino combo/i,
    );
    expect(applyLocalGlossary('arroz chino en combo')).toMatch(/arroz chino combo/i);
  });

  it('normaliza pollo broaster', () => {
    expect(applyLocalGlossary('pollo a la broaster')).toMatch(/pollo broaster/i);
    expect(applyLocalGlossary('medio de pollo')).toMatch(/medio pollo/i);
  });

  it('corrige typos de porción (caurto/meido)', () => {
    expect(applyLocalGlossary('me mandas un caurto de pollo frito')).toMatch(
      /\bcuarto\b/i,
    );
    expect(applyLocalGlossary('un meido de pollo broaster')).toMatch(/\bmedio\b/i);
  });

  it('corpus: typos y aliases de chats reales', () => {
    expect(applyLocalGlossary('Giger')).toMatch(/ginger/i);
    expect(applyLocalGlossary('sobrebarriga a la placha')).toMatch(/plancha/i);
    expect(applyLocalGlossary('Adicionar un plata')).toMatch(/plátano/i);
    expect(applyLocalGlossary('medio broaster medio frito')).toMatch(/mixto/i);
    expect(applyLocalGlossary('Me regalas un combo de pollo mixt')).toMatch(/\bmixto\b/i);
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
