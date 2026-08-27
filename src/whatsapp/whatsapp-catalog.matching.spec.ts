import { WhatsappCatalogService, type WhatsappCatalogProduct } from './whatsapp-catalog.service';

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
});
