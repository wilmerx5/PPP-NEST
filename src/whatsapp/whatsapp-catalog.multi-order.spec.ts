import { WhatsappCatalogService, type WhatsappCatalogProduct } from './whatsapp-catalog.service';
import { applyLocalGlossary } from './whatsapp-local-glossary';

const multiMenu: WhatsappCatalogProduct[] = [
  {
    id: 17,
    code: 17,
    name: 'Churrasco',
    price: 38000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 14,
    code: 14,
    name: 'Mojarra',
    price: 29500,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 37,
    code: 37,
    name: 'Limonada Natural',
    price: 4500,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 50,
    code: 50,
    name: 'Mojarra Frita',
    price: 30000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
];

describe('multi-item order quantities', () => {
  const catalog = new WhatsappCatalogService({} as never);

  it('conserva comas en extractProductSearchQuery', () => {
    const q = catalog.extractProductSearchQuery(
      'tres churrascos, dos mojarras y una limonada',
    );
    expect(q).toMatch(/,/);
  });

  it('parte tres platos con cantidades (typo mojarrras)', () => {
    const text = applyLocalGlossary(
      'tres churrascos, dos mojarrras y una limonada',
    );
    expect(catalog.splitMultiProductSegments(text).length).toBeGreaterThanOrEqual(3);

    const multi = catalog.resolveMultiProductOrder(text, multiMenu);
    expect(multi).toBeTruthy();
    const names = multi!.confident.map((c) => c.product.name).sort();
    expect(names).toEqual(['Churrasco', 'Limonada Natural', 'Mojarra'].sort());

    const qty = (name: string) =>
      catalog.extractQuantityNearProduct(text, name) ??
      catalog.extractQuantityFromSegment(
        multi!.confident.find((c) => c.product.name === name)!.segment,
      );
    expect(qty('Churrasco')).toBe(3);
    expect(qty('Mojarra')).toBe(2);
  });

  it('parte incluso si faltan comas: tres churrascos dos mojarras y limonada', () => {
    const text = 'tres churrascos dos mojarras y una limonada';
    const segs = catalog.splitMultiProductSegments(text);
    expect(segs.some((s) => /churrasco/i.test(s))).toBe(true);
    expect(segs.some((s) => /mojarra/i.test(s))).toBe(true);
    const multi = catalog.resolveMultiProductOrder(text, multiMenu);
    expect(multi?.confident.map((c) => c.product.name).sort()).toEqual(
      ['Churrasco', 'Limonada Natural', 'Mojarra'].sort(),
    );
  });
});
