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

  it('bare "una pequeñas" es tamaño, no dirección', () => {
    expect(catalog.isBareServingSizeReply('Una pequeñas por favor')).toBe(true);
    expect(catalog.isBareServingSizeReply('una pequeña')).toBe(true);
    expect(catalog.isBareServingSizeReply('Bosques de Castilla')).toBe(false);
    expect(catalog.detectServingSizeHint('Una pequeñas por favor')).toBe('pequena');
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
    expect(catalog.isPriceInquiryIntent(applyLocalGlossary('A como El arroz Con pollo'))).toBe(
      true,
    );
    expect(catalog.isPriceInquiryIntent(applyLocalGlossary('acomo el pollofrito'))).toBe(true);
    expect(applyLocalGlossary('acomo el pollofrito')).toMatch(/a cuanto el pollo frito/i);
    expect(catalog.isPriceInquiryIntent('A como el churrasco')).toBe(true);
    expect(
      catalog.resolveMultiProductOrder(
        applyLocalGlossary('A como El arroz Con pollo'),
        soupMenu,
      ),
    ).toBeNull();
    expect(catalog.isProductDescriptionInquiry('Y con que viene acompañado')).toBe(true);
    expect(catalog.isProductDescriptionInquiry('con que viene acompañado')).toBe(true);
  });

  it('cambiar ensalada por otra cosa → nota de guarnición', () => {
    expect(
      catalog.looksLikeSideModificationNote('Puedo cambiar la ensalada por otra cosa'),
    ).toBe(true);
    expect(catalog.looksLikeSideModificationNote('cambiar papas por yuca')).toBe(true);
  });

  it('gramos / rinde personas / ¿tienes X? → info, no pedido', () => {
    expect(catalog.isProductDescriptionInquiry('De cuantos gramos es el churrasco')).toBe(
      true,
    );
    expect(
      catalog.isProductDescriptionInquiry(
        "Para cuantas persona's alcanzas El arroz chino",
      ),
    ).toBe(true);
    expect(
      catalog.isProductDescriptionInquiry(
        'Quiero pedir Un arroz chino Para cuantas personas alcanzas?',
      ),
    ).toBe(true);
    expect(catalog.isAvailabilityInquiry('Tienes sopa De mondongo')).toBe(true);
    expect(catalog.isAvailabilityInquiry('No tienes we mondongo')).toBe(true);
    expect(catalog.isAvailabilityInquiry('quiero una sopa de mondongo')).toBe(false);
    expect(catalog.isAvailabilityInquiry('y me vendes un combo de arroz chino')).toBe(false);
    expect(catalog.isAvailabilityInquiry('¿venden arroz chino?')).toBe(true);
    expect(catalog.isAvailabilityInquiry('tienes mazorcada?')).toBe(true);
    expect(catalog.stripAvailabilityInquiryNoise('tienes mazorcada?')).toMatch(/^mazorcada$/i);
    expect(catalog.formatNotOnMenuReply('mazorcada', 'https://menu.example')).toMatch(
      /no manejamos \*mazorcada\*/i,
    );
    expect(catalog.availabilitySubject('Tienes algo De chocolate?')).toBe('chocolate');
    expect(catalog.availabilitySubject('Tines algo De arequipe?')).toBe('arequipe');
    expect(catalog.availabilitySubject('Te pregunte que Si tienes algo De arequipe')).toBe(
      'arequipe',
    );
    expect(catalog.availabilitySubject('qué tienes de comida rápida')).toBeNull();
    expect(catalog.availabilitySubject('quiero una milanesa')).toBeNull();
    expect(catalog.isAvailabilityInquiry('Tines algo De arequipe?')).toBe(true);
    const miss = catalog.unavailableAskReply(
      'Tienes algo De chocolate?',
      soupMenu,
      'https://www.prontopolloportal.com/menu',
    );
    expect(miss).toMatch(/No tenemos productos de chocolate/);
    expect(miss).not.toMatch(/algo de chocolate/i);
    expect(miss).toMatch(/prontopolloportal\.com\/menu/);
    expect(
      catalog.unavailableAskReply('Tienes sopa De mondongo', soupMenu, 'https://menu.example'),
    ).toBeNull();
    expect(
      catalog.menuMentionsSubject('arequipe', [
        {
          id: 1,
          code: 1,
          name: 'Arepa',
          price: 2000,
          hasAttributes: false,
          attributes: [],
          availableNow: true,
        },
      ]),
    ).toBe(false);
    expect(catalog.searchByNameScored('mazorcada', soupMenu, 5)).toEqual([]);
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

  it('menú ejecutivo con pollo frito → ejecutivo, no Pollo Frito suelto', () => {
    const text = 'Quiero Un menu ejecutivo con Pollo frito';
    const p = catalog.findProductEmbeddedInMessage(text, chickenMenu);
    expect(p?.name).toMatch(/ejecutivo/i);
    expect(p?.name.toLowerCase()).not.toMatch(/^(1\s+)?pollo frito$/);

    const scored = catalog.searchByNameScored(text, chickenMenu, 5);
    expect(scored[0]?.p.name).toMatch(/ejecutivo/i);
  });
});

describe('palabra dentro del nombre no es el plato', () => {
  const catalog = new WhatsappCatalogService({} as never);
  const menu: WhatsappCatalogProduct[] = [
    {
      id: 7,
      code: 7,
      name: 'Jugo Natural En Leche',
      price: 8000,
      hasAttributes: true,
      attributes: [{ attributeName: 'Sabor', options: ['Mango', 'Fresa'] }],
      availableNow: true,
      description: 'Mango',
    },
    {
      id: 8,
      code: 8,
      name: 'Milanesa De Pollo',
      price: 35000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];

  it('leche no agrega el jugo; lo ofrece', () => {
    expect(catalog.findProductEmbeddedInMessage('Quiero una Leche por favor', menu)).toBeNull();
    expect(catalog.resolveStandaloneDrinkOrder('Quiero una Leche por favor', menu)).toBeNull();
    const similar = catalog.similarNamedProducts('Quiero una Leche por favor', menu);
    expect(similar.map((p) => p.name)).toEqual(['Jugo Natural En Leche']);
    const reply = catalog.formatSimilarOfferReply('Quiero una Leche por favor', similar);
    expect(reply).toMatch(/No te ofrecemos \*leche\*/i);
    expect(reply).toMatch(/Jugo Natural En Leche/);
    expect(reply).toMatch(/¿Te lo agrego/);
    expect(reply).not.toMatch(/Listo/);
  });

  it('milanesa sí es la milanesa', () => {
    expect(catalog.similarNamedProducts('quiero una milanesa', menu)).toEqual([]);
    expect(catalog.findProductEmbeddedInMessage('quiero una milanesa', menu)?.name).toMatch(
      /milanesa/i,
    );
  });
});

describe('bandeja con sopa no es la categoría Sopas', () => {
  const catalog = new WhatsappCatalogService({} as never);
  const menu: WhatsappCatalogProduct[] = [
    {
      id: 38,
      code: 38,
      name: 'Sopa De Ajiaco',
      price: 12000,
      categoryName: 'Sopas',
      description: 'Acompañada con arroz',
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
    {
      id: 15,
      code: 15,
      name: 'Bandeja Con Pollo Frito',
      price: 21000,
      categoryName: 'Bandejas',
      description: 'Arroz, ensalada y maduro',
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
    {
      id: 18,
      code: 18,
      name: 'Bandeja Pronto',
      price: 18000,
      categoryName: 'Bandejas',
      description: 'Arroz y papa',
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];

  it('pregunta si la bandeja trae sopa y ofrece las bandejas', () => {
    expect(catalog.findCategoryBrowseHit('Tiene alguna bandeja con sopa?', menu)?.categoryName).not.toBe(
      'Sopas',
    );
    const offer = catalog.comesWithOffer('Tiene alguna bandeja con sopa?', menu);
    expect(offer?.reply).toMatch(/No tenemos \*bandeja con sopa\*/i);
    expect(offer?.reply).toMatch(/Bandeja Con Pollo Frito/);
    expect(offer?.reply).toMatch(/Bandeja Pronto/);
    expect(offer?.reply).not.toMatch(/Sopa De Ajiaco/);
    const again = catalog.comesWithOffer('Bandejas con sopa hay?', menu);
    expect(again?.reply).toMatch(/bandeja con sopa/i);
    expect(again?.reply).not.toMatch(/Sopa De Ajiaco/);
  });

  it('si la descripción trae sopa, lista esa bandeja', () => {
    const withSoup = menu.map((p) =>
      p.id === 15 ? { ...p, description: 'Incluye sopa, arroz y ensalada' } : p,
    );
    const offer = catalog.comesWithOffer('Tiene alguna bandeja con sopa?', withSoup);
    expect(offer?.reply).toMatch(/traen \*sopa\*/i);
    expect(offer?.reply).toMatch(/Bandeja Con Pollo Frito/);
    expect(offer?.reply).not.toMatch(/Bandeja Pronto/);
    expect(offer?.reply).not.toMatch(/Sopa De Ajiaco/);
  });
});

describe('cambiar la gaseosa del combo por papas', () => {
  const catalog = new WhatsappCatalogService({} as never);
  const text = 'Quiero Un combo De Pollo frito pero cambiame la gaseosa por papas';
  const menu: WhatsappCatalogProduct[] = [
    {
      id: 1,
      code: 1,
      name: '1 Pollo Frito',
      price: 44000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
    {
      id: 2,
      code: 2,
      name: 'Combo De Pollo Frito',
      price: 53000,
      hasAttributes: true,
      attributes: [{ attributeName: 'Bebida', options: ['Manzana', 'Uva'] }],
      availableNow: true,
    },
    {
      id: 3,
      code: 3,
      name: 'Gaseosa 400ml',
      price: 4000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
    {
      id: 4,
      code: 4,
      name: 'Porcion De Papa Francesa',
      price: 8000,
      hasAttributes: false,
      attributes: [],
      availableNow: true,
    },
  ];

  it('no es un pedido de pollo suelto más gaseosa', () => {
    expect(catalog.looksLikeFoodPlusDrinkOrder(text)).toBe(false);
    expect(catalog.swapIntent(text)?.removed).toMatch(/gaseosa/);
    expect(catalog.swapIntent(text)?.added).toMatch(/papas/);
    expect(catalog.hostedMenuDrink(text, menu)).toBeNull();
    const host = catalog.mostSpecificNamedProduct(catalog.dishTextBeforeSwap(text), menu);
    expect(host?.name).toBe('Combo De Pollo Frito');
    expect(catalog.productCarriesMention(host!, 'la gaseosa')).toBe(true);
    expect(catalog.productCarriesMention(menu[0], 'la gaseosa')).toBe(false);
    const multi = catalog.resolveMultiProductOrder(text, menu);
    const lines = [...(multi?.confident || []), ...(multi?.needsAttributes || [])];
    const names = lines.map((m) => m.product.name);
    expect(names).toContain('Combo De Pollo Frito');
    expect(names).not.toContain('Porcion De Papa Francesa');
    expect(names).not.toContain('1 Pollo Frito');
    expect(names).not.toContain('Gaseosa 400ml');
    expect(lines.find((m) => m.product.name === 'Combo De Pollo Frito')?.note).toMatch(
      /sin gaseosa; cambio por papas/i,
    );
    expect(multi?.needsAttributes || []).toHaveLength(0);
  });

  it('quiero un combo de pollo frito no agrega el pollo suelto', () => {
    const ask = 'quiero un combo de pollo frito';
    expect(catalog.isLooserSameDish(menu[0], menu[1])).toBe(true);
    expect(catalog.isLooserSameDish(menu[1], menu[0])).toBe(false);
    expect(catalog.nameMentionedInText('Combo De Pollo Frito', 'solo te pedi un combo')).toBe(
      true,
    );
    expect(catalog.nameMentionedInText('1 Pollo Frito', 'solo te pedi un combo')).toBe(false);
    const host = catalog.mostSpecificNamedProduct(ask, menu);
    expect(host?.name).toBe('Combo De Pollo Frito');
    const multi = catalog.resolveMultiProductOrder(ask, menu);
    const names = [
      ...(multi?.confident || []),
      ...(multi?.needsAttributes || []),
    ].map((m) => m.product.name);
    if (names.length) {
      expect(names).toContain('Combo De Pollo Frito');
      expect(names).not.toContain('1 Pollo Frito');
    }
  });

  it('cuarto de la lista broaster con presa y cambio de yuca', () => {
    const ask =
      'Quiero un cuarto de pollo pierna pernil pero quiero cambiar la yuca por papa a la francesa';
    const family: WhatsappCatalogProduct[] = [
      {
        id: 98,
        code: 98,
        name: 'Combo De Pollo Broaster',
        price: 55000,
        description: 'Acompañado con papa fracesa, yuca frita, arepa y bebida 1.5L',
        hasAttributes: true,
        attributes: [],
        availableNow: true,
      },
      {
        id: 4,
        code: 4,
        name: '1 Pollo Broaster',
        price: 46000,
        description: 'Acompañado con papa francesa y arepa',
        hasAttributes: true,
        attributes: [],
        availableNow: true,
      },
      {
        id: 5,
        code: 5,
        name: '1/2 Pollo Broaster',
        price: 26000,
        description: 'Acompañado con papa francesa y arepa',
        hasAttributes: true,
        attributes: [],
        availableNow: true,
      },
      {
        id: 6,
        code: 6,
        name: '1/4 Pollo Broaster',
        price: 16000,
        description: 'Acompañado con yuca frita y arepa',
        hasAttributes: true,
        attributes: [
          { attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'sin arepas'] },
          { attributeName: 'Presa', options: ['Pierna Pernil', 'Ala pechuga'] },
        ],
        availableNow: true,
      },
    ];
    const picked = catalog.pickFromCandidateList(ask, family);
    expect(picked?.name).toBe('1/4 Pollo Broaster');
    expect(catalog.swapIntent(ask)?.removed).toMatch(/yuca/);
    expect(catalog.swapIntent(ask)?.added).toMatch(/papa a la francesa/);
    expect(catalog.productCarriesMention(picked!, 'la yuca')).toBe(true);
    expect(catalog.swapChangeNote('la yuca', 'papa a la francesa')).toMatch(
      /sin yuca; cambio por papa a la francesa/i,
    );
    const attrs = catalog.resolveAttributesFromMessage(picked!, ask, []);
    expect(attrs.status).not.toBe('invalid');
    if (attrs.status === 'invalid') return;
    expect(attrs.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attributeName: 'Presa', attributeValue: 'Pierna Pernil' }),
      ]),
    );
    expect(
      attrs.attributes.some((a) => a.attributeName === 'Arepas' && a.attributeValue === 'Fritas'),
    ).toBe(false);
  });

  it('si el plato no trae eso, no inventa la nota', () => {
    const plain = menu.map((p) =>
      p.id === 2 ? { ...p, hasAttributes: false, attributes: [], description: 'Arroz y papa' } : p,
    );
    const host = catalog.mostSpecificNamedProduct(catalog.dishTextBeforeSwap(text), plain);
    expect(catalog.productCarriesMention(host!, 'la gaseosa')).toBe(false);
    const multi = catalog.resolveMultiProductOrder(text, plain);
    const lines = [...(multi?.confident || []), ...(multi?.needsAttributes || [])];
    expect(lines.find((m) => /combo/i.test(m.product.name))?.note).toBeUndefined();
  });

  it('la descripción también cuenta', () => {
    const described = menu.map((p) =>
      p.id === 2
        ? { ...p, hasAttributes: false, attributes: [], description: 'Incluye arroz y gaseosa' }
        : p,
    );
    expect(catalog.productCarriesMention(described[1], 'gaseosa')).toBe(true);
    const multi = catalog.resolveMultiProductOrder(text, described);
    const combo = [...(multi?.confident || []), ...(multi?.needsAttributes || [])].find((m) =>
      /combo/i.test(m.product.name),
    );
    expect(combo?.note).toMatch(/cambio por papas/i);
    expect(
      [...(multi?.confident || []), ...(multi?.needsAttributes || [])].some((m) =>
        /papa francesa/i.test(m.product.name),
      ),
    ).toBe(false);
  });

  it('el cambio no borra los otros platos del mismo mensaje', () => {
    const hard =
      'Dame 2 milnaesas, una sopa De ajiaco, Un como De Pollo frito pero cambiame la gaseosa por una porcion De papa Francesca, y una Bandeja paisa';
    const extra: WhatsappCatalogProduct[] = [
      {
        id: 5,
        code: 5,
        name: 'Milanesa De Pollo',
        price: 35000,
        hasAttributes: false,
        attributes: [],
        availableNow: true,
      },
      {
        id: 6,
        code: 6,
        name: 'Sopa De Ajiaco',
        price: 12000,
        hasAttributes: false,
        attributes: [],
        availableNow: true,
      },
      {
        id: 7,
        code: 7,
        name: 'Bandeja Pronto',
        price: 18000,
        hasAttributes: false,
        attributes: [],
        availableNow: true,
      },
    ];
    const multi = catalog.resolveMultiProductOrder(hard, [...menu, ...extra]);
    const names = [
      ...(multi?.confident || []),
      ...(multi?.needsAttributes || []),
    ].map((m) => m.product.name);
    expect(names).toEqual(
      expect.arrayContaining(['Milanesa De Pollo', 'Sopa De Ajiaco', 'Combo De Pollo Frito']),
    );
    expect(names).not.toContain('Porcion De Papa Francesa');
    const combo = [...(multi?.confident || []), ...(multi?.needsAttributes || [])].find((m) =>
      /combo/i.test(m.product.name),
    );
    expect(combo?.note).toMatch(/cambio por porcion de papa francesc/i);
    expect(names).not.toContain('1 Pollo Frito');
    expect(names).not.toContain('Gaseosa 400ml');
    expect(names).not.toContain('Bandeja Pronto');
    expect((multi?.unresolved || []).join(' ')).toMatch(/paisa/i);
  });
});
