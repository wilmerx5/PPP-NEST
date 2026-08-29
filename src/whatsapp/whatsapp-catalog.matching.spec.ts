import { WhatsappCatalogService, type WhatsappCatalogProduct } from './whatsapp-catalog.service';
import { applyLocalGlossary } from './whatsapp-local-glossary';

const soupMenu: WhatsappCatalogProduct[] = [
  {
    id: 38,
    code: 38,
    name: 'Sopa De Ajiaco',
    price: 10500,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 40,
    code: 40,
    name: 'Sopa pequeña',
    price: 7500,
    hasAttributes: true,
    attributes: [{ attributeName: 'Sopa', options: ['Ajiaco', 'Menudencias'] }],
    availableNow: true,
  },
  {
    id: 41,
    code: 41,
    name: 'Sopa De Mondongo Pequeña',
    price: 8500,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 45,
    code: 45,
    name: 'Sopa De Mondongo',
    price: 12500,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 20,
    code: 20,
    name: 'Sopa De Menudencias',
    price: 10500,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 99,
    code: 99,
    name: 'Arepa',
    price: 2000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
];

describe('WhatsappCatalogService matching regressions', () => {
  const catalog = new WhatsappCatalogService({} as never);

  it('ajiaco pequeña → Sopa pequeña (no la grande)', () => {
    const p = catalog.resolveSizedSoupProduct(
      'pedi dos sopas de ajiaco pequeñas',
      soupMenu,
    );
    expect(p?.id).toBe(40);
    expect(p?.name).toBe('Sopa pequeña');
  });

  it('mondongo pequeña → SKU Mondongo Pequeña', () => {
    const p = catalog.resolveSizedSoupProduct('sopa de mondongo pequeña', soupMenu);
    expect(p?.id).toBe(41);
  });

  it('ajiaco sin tamaño → no forzar (matching normal)', () => {
    expect(catalog.resolveSizedSoupProduct('sopa de ajiaco', soupMenu)).toBeNull();
  });

  it('ajiaco grande → Sopa De Ajiaco', () => {
    const p = catalog.resolveSizedSoupProduct('sopa de ajiaco grande', soupMenu);
    expect(p?.id).toBe(38);
  });

  it('findProductEmbeddedInMessage respeta tamaño', () => {
    const p = catalog.findProductEmbeddedInMessage(
      'dos sopas de ajiaco pequeñas',
      soupMenu,
    );
    expect(p?.id).toBe(40);
  });

  it('nota de guarnición: no es multi-plato', () => {
    expect(
      catalog.looksLikeSideModificationNote(
        'para el combo no quiero arepas, quiero mas papas',
      ),
    ).toBe(true);
    expect(
      catalog.findAllProductsEmbeddedInMessage(
        'para el combo no quiero arepas, quiero mas papas',
        soupMenu,
      ),
    ).toEqual([]);
  });

  it('q cuestan 2 sopas de menudencias → precio, no pedido', () => {
    const text = applyLocalGlossary('Q cuestan 2 sopas de menudencias');
    expect(catalog.isPriceInquiryIntent(text)).toBe(true);
    expect(catalog.isGenericProductInquiry(text)).toBe(true);
    const stripped = catalog.stripPriceInquiryNoise(text);
    expect(catalog.findProductEmbeddedInMessage(stripped, soupMenu)?.id).toBe(20);
    expect(catalog.extractQuantityFromMessage(text)).toBe(2);
  });

  it('cuestan / cuánto cuestan / q cuesta también son precio', () => {
    expect(catalog.isPriceInquiryIntent('cuestan las sopas de menudencias')).toBe(true);
    expect(catalog.isPriceInquiryIntent('cuánto cuestan 2 sopas de menudencias')).toBe(
      true,
    );
    expect(catalog.isPriceInquiryIntent(applyLocalGlossary('q cuesta el pollo'))).toBe(
      true,
    );
    expect(catalog.isPriceInquiryIntent('vale gracias')).toBe(false);
    expect(catalog.isPriceInquiryIntent('quiero 2 sopas de menudencias')).toBe(false);
  });

  it('gramos / rinde personas / ¿tienes X? → info, no pedido', () => {
    expect(catalog.isProductDescriptionInquiry('De cuantos gramos es el churrasco')).toBe(
      true,
    );
    expect(
      catalog.isProductDescriptionInquiry(
        'Quiero pedir Un arroz chino Para cuantas personas alcanzas?',
      ),
    ).toBe(true);
    expect(catalog.isAvailabilityInquiry('Tienes sopa De mondongo')).toBe(true);
    expect(catalog.isAvailabilityInquiry('No tienes we mondongo')).toBe(true);
    expect(catalog.isAvailabilityInquiry('quiero una sopa de mondongo')).toBe(false);
    expect(
      catalog.isServingSizeChangeIntent('Pero quiero una porcion Mas pequena'),
    ).toBe(true);
    expect(
      catalog.isExternalMarketplaceOrderMessage(
        'Hice Un pedido por rappi pero quiero cambiar El sabor de mi gaseosa',
      ),
    ).toBe(true);
    expect(catalog.resolveMultiProductOrder('Tienes sopa De mondongo', soupMenu)).toBeNull();
  });
});

const chickenMenu: WhatsappCatalogProduct[] = [
  {
    id: 1,
    code: 1,
    name: '1 Pollo Frito',
    price: 42000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 2,
    code: 2,
    name: 'Pollo Frito',
    price: 42000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 80,
    code: 80,
    name: 'Bandeja con pollo frito',
    price: 18000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
  {
    id: 81,
    code: 81,
    name: 'Menú ejecutivo con pollo frito',
    price: 16000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
  },
];

describe('pollo frito vs bandeja/menú', () => {
  const catalog = new WhatsappCatalogService({} as never);

  it('no trata "pollo frito, por favor" como multi-plato', () => {
    expect(
      catalog.looksLikeClearlyMultiDishOrder('quiero un pollo frito, por favor'),
    ).toBe(false);
    expect(
      catalog.looksLikeMultiItemOrderMessage('quiero un pollo frito, por favor'),
    ).toBe(false);
  });

  it('quiero un pollo frito → Pollo Frito, no bandeja', () => {
    const p = catalog.findProductEmbeddedInMessage(
      'quiero un pollo frito, por favor',
      chickenMenu,
    );
    expect(p).toBeTruthy();
    expect(p!.name.toLowerCase()).toMatch(/pollo frito/);
    expect(p!.name.toLowerCase()).not.toMatch(/bandeja|men[uú]|ejecutivo/);
  });

  it('searchByNameScored: pollo frito gana a bandeja', () => {
    const scored = catalog.searchByNameScored('un pollo frito', chickenMenu, 5);
    expect(scored[0]?.p.name.toLowerCase()).toMatch(/^(1\s+)?pollo frito$/);
    expect(
      scored.find((x) => /bandeja/i.test(x.p.name))?.score ?? 0,
    ).toBeLessThan(scored[0]?.score ?? 0);
  });

  it('si pide bandeja explícita, sí matchea bandeja', () => {
    const p = catalog.findProductEmbeddedInMessage(
      'quiero la bandeja con pollo frito',
      chickenMenu,
    );
    expect(p?.name).toMatch(/bandeja/i);
  });
});
