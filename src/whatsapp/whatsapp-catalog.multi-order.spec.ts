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
  {
    id: 10,
    code: 10,
    name: 'Arroz Con Pollo',
    price: 32000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 6,
    code: 6,
    name: '1/4 Pollo Asado',
    price: 16000,
    hasAttributes: true,
    attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas'] }],
    availableNow: true,
  },
  {
    id: 7,
    code: 7,
    name: '1/4 Pollo Frito',
    price: 16000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 80,
    code: 80,
    name: 'Jugo Natural En Agua',
    price: 6000,
    hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }],
    availableNow: true,
    categoryName: 'Bebidas',
  },
  {
    id: 81,
    code: 81,
    name: 'Jugo Natural En Leche',
    price: 7000,
    hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Lulo'] }],
    availableNow: true,
    categoryName: 'Bebidas',
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

  it('arroz con pollo + 1/4 pollo asado → ambos', () => {
    const text = applyLocalGlossary(
      'Me podrías dar 1 arroz con pollo y 1/4 de pollo asado porfa',
    );
    expect(catalog.looksLikeClearlyMultiDishOrder(text)).toBe(true);
    expect(catalog.splitMultiProductSegments(text).length).toBeGreaterThanOrEqual(2);
    const multi = catalog.resolveMultiProductOrder(text, multiMenu);
    expect(multi).toBeTruthy();
    const names = [
      ...(multi!.confident.map((c) => c.product.name) || []),
      ...(multi!.needsAttributes.map((c) => c.product.name) || []),
    ].sort();
    expect(names).toContain('Arroz Con Pollo');
    expect(names).toContain('1/4 Pollo Asado');
  });

  it('qué jugos naturales tienes → browse, no pedido', () => {
    const text = 'Y que jugos naturales tienes?';
    expect(catalog.isCategoryBrowseQuestion(text)).toBe(true);
    expect(catalog.resolveMultiProductOrder(text, multiMenu)).toBeNull();
    const hit = catalog.findCategoryBrowseHit(text, multiMenu);
    expect(hit?.products.length).toBeGreaterThan(0);
    expect(hit!.products.every((p) => /jugo/i.test(p.name))).toBe(true);
  });

  it('broaster en duda 1/4 → elige 1/4 Pollo Broaster, no el entero', () => {
    const candidates = [
      {
        id: 6,
        code: 6,
        name: '1/4 Pollo Broaster',
        price: 16000,
        hasAttributes: true,
        attributes: [],
        availableNow: true,
      },
      {
        id: 3,
        code: 3,
        name: '1/4 Pollo Frito',
        price: 15000,
        hasAttributes: false,
        attributes: [],
        availableNow: true,
      },
      {
        id: 4,
        code: 4,
        name: '1 Pollo Broaster',
        price: 46000,
        hasAttributes: true,
        attributes: [],
        availableNow: true,
      },
    ];
    // Solo los de la duda (sin el entero en la lista)
    const ambiguousOnly = candidates.filter((c) => c.id === 6 || c.id === 3);
    expect(catalog.pickFromCandidateList('broaster', ambiguousOnly)?.name).toBe(
      '1/4 Pollo Broaster',
    );
    expect(catalog.pickFromCandidateList('frito', ambiguousOnly)?.name).toBe('1/4 Pollo Frito');
    expect(catalog.pickFromCandidateList('1', ambiguousOnly)).toBeNull();
  });

  it('asado sin SKU → multi con arroz claro + 1/4 ambiguo (broaster/frito)', () => {
    const menu: WhatsappCatalogProduct[] = [
      {
        id: 23,
        code: 23,
        name: 'Arroz Con Pollo',
        price: 32000,
        hasAttributes: false,
        attributes: [],
        availableNow: true,
      },
      {
        id: 6,
        code: 6,
        name: '1/4 Pollo Broaster',
        price: 16000,
        hasAttributes: true,
        attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas'] }],
        availableNow: true,
      },
      {
        id: 3,
        code: 3,
        name: '1/4 Pollo Frito',
        price: 15000,
        hasAttributes: false,
        attributes: [],
        availableNow: true,
      },
    ];
    const text = applyLocalGlossary(
      'Me podrías dar 1 arroz con pollo y 1/4 de pollo asado porfa',
    );
    const multi = catalog.resolveMultiProductOrder(text, menu);
    expect(multi).toBeTruthy();
    expect(multi!.confident.map((c) => c.product.name)).toContain('Arroz Con Pollo');
    expect(multi!.ambiguous.length).toBeGreaterThanOrEqual(1);
    const names = multi!.ambiguous[0].candidates.map((c) => c.name).sort();
    expect(names).toEqual(['1/4 Pollo Broaster', '1/4 Pollo Frito'].sort());
    // "sí" no debe poder “cerrar” esto sin pick: la duda sigue abierta
    expect(multi!.ambiguous.length > 0).toBe(true);
  });
});
