/**
 * Regresiones de chats reales WhatsApp.
 *
 * Regla de equipo: cada conversación mala en prod/staging → 1+ casos aquí
 * ANTES (o junto) al fix. `yarn test:whatsapp` debe pasar antes de deploy.
 */
import {
  isAbandonPendingSelectionIntent,
  isAddressChangeIntent,
  isAddressRejectionIntent,
  resolvePendingListOrMenuCode,
} from './whatsapp-session-intents';
import {
  classifyWhatsappCustomerIntent,
  looksLikeAddressOnlyMessage,
  looksLikeNonAddressCommand,
  looksLikeExplicitCartItemNote,
  isDeliverySetupWithoutFood,
  isDeliveryLogisticsFluff,
  extractDeliverySetupAddress,
} from './whatsapp-intent';
import { WhatsappCatalogService, type WhatsappCatalogProduct } from './whatsapp-catalog.service';
import { applyLocalGlossary } from './whatsapp-local-glossary';
import { WhatsappPointsService } from './whatsapp-points.service';
import { isPaymentCapabilityQuestion } from './whatsapp-payment-methods';

const pppMenu: WhatsappCatalogProduct[] = [
  {
    id: 1,
    code: 1,
    name: '1 Pollo Frito',
    price: 44000,
    hasAttributes: true,
    attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'Sin arepas'] }],
    availableNow: true,
    categoryName: 'Pollo',
  },
  {
    id: 2,
    code: 2,
    name: '1/2 Pollo Frito',
    price: 25000,
    hasAttributes: true,
    attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'Sin arepas'] }],
    availableNow: true,
    categoryName: 'Pollo',
  },
  {
    id: 6,
    code: 6,
    name: '1/4 Pollo Broaster',
    price: 16000,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'Sin arepas'] },
      { attributeName: 'Presa', options: ['Pierna Pernil', 'Ala pechuga'] },
    ],
    availableNow: true,
    categoryName: 'Pollo',
  },
  {
    id: 13,
    code: 13,
    name: 'Sobrebarriga',
    price: 37000,
    hasAttributes: true,
    attributes: [{ attributeName: 'Seleccion', options: ['Asada', 'En Salsa'] }],
    availableNow: true,
    categoryName: 'Carne',
  },
  {
    id: 22,
    code: 22,
    name: 'Ejecutivo Con Pollo Frito',
    price: 25000,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Presa', options: ['Pierna pernil', 'Ala pechuga'] },
      { attributeName: 'Sopa', options: ['Ajiaco', 'Menudencias', 'Mondongo'] },
      { attributeName: 'Bebida', options: ['Colombiana', 'Manzana', 'Pepsi', 'Coca Cola'] },
    ],
    availableNow: true,
    categoryName: 'Ejecutivos',
  },
  {
    id: 18,
    code: 18,
    name: 'Ejecutivo Con Pollo Broaster',
    price: 26000,
    hasAttributes: true,
    attributes: [],
    availableNow: true,
    categoryName: 'Ejecutivos',
  },
  {
    id: 20,
    code: 20,
    name: 'Sopa De Menudencias',
    price: 12000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Sopas',
  },
  {
    id: 21,
    code: 21,
    name: 'Sopa De Ajiaco',
    price: 15000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Sopas',
  },
  {
    id: 37,
    code: 37,
    name: 'Limonada Natural',
    price: 5000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Bebidas',
  },
  {
    id: 28,
    code: 28,
    name: 'Gaseosa 400ml',
    price: 4000,
    hasAttributes: true,
    attributes: [{ attributeName: 'Sabor', options: ['Manzana', 'Colombiana', 'Pepsi'] }],
    availableNow: true,
    categoryName: 'Bebidas',
  },
  {
    id: 99,
    code: 99,
    name: 'Combo De Pollo Frito',
    price: 53000,
    hasAttributes: true,
    attributes: [
      { attributeName: 'Bebida', options: ['Colombiana', 'Manzana', 'Pepsi', 'Coca cola'] },
      { attributeName: 'Arepas', options: ['Blancas', 'Fritas', 'Sin arepas'] },
    ],
    availableNow: true,
    categoryName: 'Pollo',
  },
  {
    id: 98,
    code: 98,
    name: 'Combo De Pollo Broaster',
    price: 55000,
    hasAttributes: true,
    attributes: [],
    availableNow: true,
    categoryName: 'Pollo',
  },
  {
    id: 55,
    code: 55,
    name: 'Arroz Con Pollo',
    price: 18000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Arroces',
  },
  {
    id: 25,
    code: 25,
    name: 'Costillas De Cerdo',
    price: 30000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Carne',
  },
  {
    id: 90,
    code: 90,
    name: 'Arepa',
    price: 2000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Porciones',
  },
  {
    id: 70,
    code: 70,
    name: 'Arroz Chino Caja Con Papa Francesa',
    price: 38000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Arroces',
  },
  {
    id: 71,
    code: 71,
    name: 'Arroz Chino Con Medio Pollo',
    price: 48000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Arroces',
  },
  {
    id: 72,
    code: 72,
    name: 'Arroz Chino Con Costillas De Cerdo',
    price: 50000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Arroces',
  },
  {
    id: 73,
    code: 73,
    name: 'Arroz Chino Combo',
    price: 45000,
    hasAttributes: true,
    attributes: [{ attributeName: 'Gaseosa', options: ['Colombiana', 'Manzana', 'Uva'] }],
    availableNow: true,
    categoryName: 'Arroces',
  },
  {
    id: 171,
    code: 171,
    name: 'Duo De Tacos Al pastor',
    price: 32000,
    hasAttributes: true,
    attributes: [
      {
        attributeName: 'Bebida',
        options: ['Colombiana', 'Manzana', 'Pepsi', 'Coca Cola', 'Ginger', 'Uva'],
      },
    ],
    availableNow: true,
    categoryName: 'Tacos',
  },
  {
    id: 172,
    code: 172,
    name: 'Trio De Tacos Al pastor',
    price: 45000,
    hasAttributes: true,
    attributes: [
      {
        attributeName: 'Bebida',
        options: ['Colombiana', 'Manzana', 'Pepsi', 'Coca Cola'],
      },
    ],
    availableNow: true,
    categoryName: 'Tacos',
  },
];

describe('WhatsApp chat regressions (prod-hardening)', () => {
  const catalog = new WhatsappCatalogService({} as never);
  const points = new WhatsappPointsService({} as never);

  describe('Pollo genérico → listar opciones', () => {
    it('Quiero pedir pollo / dame pollo → categoría Pollo, no 1 Pollo Frito', () => {
      for (const raw of ['Quiero pedir pollo', 'dame pollo', 'quiero pollo', 'pollo']) {
        const text = applyLocalGlossary(raw);
        expect(catalog.resolveSizedChickenProduct(text, pppMenu)).toBeNull();
        const hit = catalog.findCategoryBrowseHit(text, pppMenu);
        expect(hit?.categoryName).toMatch(/pollo/i);
        expect(hit!.products.length).toBeGreaterThanOrEqual(3);
        expect(hit!.products.some((p) => /frito/i.test(p.name))).toBe(true);
        expect(hit!.products.some((p) => /broaster/i.test(p.name))).toBe(true);
      }
    });

    it('quiero pollo frito sigue siendo plato concreto (no browse genérico)', () => {
      const text = applyLocalGlossary('quiero pollo frito');
      expect(catalog.findCategoryBrowseHit(text, pppMenu)).toBeNull();
      expect(catalog.findProductEmbeddedInMessage(text, pppMenu)?.name).toMatch(/frito/i);
    });
  });

  describe('Typos y texto pegado', () => {
    it('quieor → quiero', () => {
      expect(applyLocalGlossary('Quieor un ejecutivo frito')).toMatch(/^quiero/i);
    });

    it('unpollofrito no es código de factura', () => {
      const fixed = applyLocalGlossary('quiero unpollofrito');
      expect(fixed).toMatch(/un pollo frito/i);
      expect(points.extractPointCodeCandidate('quiero unpollofrito')).toBeNull();
      expect(points.extractPointCodeCandidate(fixed)).toBeNull();
    });
  });

  describe('Pollo + gaseosa → combo (no 9 opciones sueltas)', () => {
    it('detecta comida+bebida', () => {
      expect(
        catalog.looksLikeFoodPlusDrinkOrder('Quiero un pollo frito con gaseosa manzana'),
      ).toBe(true);
    });

    it('1 Pollo Frito y Combo De Pollo Frito comparten base', () => {
      expect(catalog.getProductNameBase('1 Pollo Frito')).toBe(
        catalog.getProductNameBase('Combo De Pollo Frito'),
      );
    });

    it('familia pollo frito incluye el combo', () => {
      const family = catalog.findProductVariantFamily('pollo frito', pppMenu, [
        pppMenu.find((p) => p.code === 1)!,
      ]);
      expect(family).toBeTruthy();
      expect(family!.variants.some((v) => v.code === 99)).toBe(true);
    });

    it('intent “en combo” / “quiero el pollo frito en combo”', () => {
      expect(catalog.isVariantPreferenceIntent('en combo')).toBe(true);
      expect(catalog.isVariantPreferenceIntent('quiero el pollo frito en combo')).toBe(true);
      expect(
        catalog.isVariantPreferenceIntent('No quieor un solopollo, quieor el pollo en combo'),
      ).toBe(true);
      expect(catalog.extractVariantPreferenceHint('en combo')).toBe('combo');
    });
  });

  describe('Lista pendiente: fila vs código de menú', () => {
    it('código 99 está en la lista de pollo (no confundir con fila 9)', () => {
      const polloList = pppMenu.filter((p) => p.categoryName === 'Pollo');
      expect(polloList.length).toBeGreaterThanOrEqual(3);
      expect(polloList.some((c) => c.code === 99)).toBe(true);
      // Fila 9 ≠ necesariamente cód. 99; el orquestador debe preferir match por code
      const byCode = catalog.findByCode(99, pppMenu);
      expect(byCode?.name).toMatch(/Combo De Pollo Frito/i);
    });

    it('99 en lista de 4 ítems → menu_code (no fila inexistente)', () => {
      const candidates = [
        { id: 1, code: 1 },
        { id: 2, code: 2 },
        { id: 6, code: 6 },
        { id: 99, code: 99 },
      ];
      expect(resolvePendingListOrMenuCode({ bareNum: 99, candidates })).toBe('menu_code');
      expect(resolvePendingListOrMenuCode({ bareNum: 2, candidates })).toBe('list_index');
      // Lista de 12 bebidas: 6 es fila (Limonada), no código broaster
      const drinks = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        code: i === 5 ? 37 : 100 + i,
      }));
      expect(resolvePendingListOrMenuCode({ bareNum: 6, candidates: drinks })).toBe('list_index');
    });

    it('limonada resuelve a Limonada Natural (no código 6 broaster)', () => {
      const scored = catalog.searchByNameScored('limonada', pppMenu, 5);
      expect(scored[0]?.p.code).toBe(37);
      expect(catalog.findByCode(6, pppMenu)?.name).toMatch(/Broaster/i);
    });
  });

  describe('Cancelar pendiente / cambiar dirección', () => {
    it('cancela eso / no quiero pollo', () => {
      expect(isAbandonPendingSelectionIntent('cancela eso')).toBe(true);
      expect(isAbandonPendingSelectionIntent('Cancela ese pollo')).toBe(true);
      expect(isAbandonPendingSelectionIntent('no quiero pollo')).toBe(true);
      expect(isAbandonPendingSelectionIntent('no quiero eso')).toBe(true);
      expect(isAbandonPendingSelectionIntent('Ya no quiero sopa pequeña')).toBe(true);
      expect(isAbandonPendingSelectionIntent('No eso no es')).toBe(true);
      expect(isAbandonPendingSelectionIntent('quiero una limonada')).toBe(false);
    });

    it('cambia la dirección…', () => {
      expect(isAddressChangeIntent('Cambia la direccion a dg 6 b 78b 64')).toBe(true);
      expect(isAddressChangeIntent('quiero un pollo frito')).toBe(false);
      expect(isAddressRejectionIntent('No Esa no es mi direcion')).toBe(true);
      expect(isAddressChangeIntent('No Esa no es mi direcion')).toBe(true);
      expect(looksLikeNonAddressCommand('No Esa no es mi direcion')).toBe(true);
      expect(looksLikeAddressOnlyMessage('No Esa no es mi direcion')).toBe(false);
    });
  });

  describe('Ejecutivo + dirección (no multi basura)', () => {
    it('quieor un ejecutivo frito… no deja Quieor como unresolved', () => {
      const text = applyLocalGlossary(
        'Quieor un ejecutivo frito para la calle 48 sur 87 86',
      );
      const multi = catalog.resolveMultiProductOrder(text, pppMenu);
      if (multi) {
        expect(multi.unresolved.some((u) => /quieor/i.test(u))).toBe(false);
        const ids = multi.ambiguous.flatMap((a) => a.candidates.map((c) => c.id));
        expect(new Set(ids).size).toBe(ids.length);
      }
      // Preferible: un solo ejecutivo claro
      const embedded = catalog.findProductEmbeddedInMessage(text, pppMenu);
      const scored = catalog.searchByNameScored(
        catalog.extractProductSearchQuery(text),
        pppMenu,
        5,
      );
      const hit = embedded || scored[0]?.p;
      expect(hit?.name).toMatch(/Ejecutivo Con Pollo Frito/i);
    });
  });

  describe('Cambio de dirección (no “varios platos”)', () => {
    it('mensaje de cambio de dirección no parece multi-ítem de comida', () => {
      const text = applyLocalGlossary('Cambia la direccion a dg 6 b 78b 64');
      expect(catalog.looksLikeMultiItemOrderMessage(text)).toBe(false);
      expect(catalog.resolveMultiProductOrder(text, pppMenu)).toBeNull();
    });
  });

  describe('No doble-add: pollo+arepas / arroz con pollo', () => {
    it('pollo con arepas fritas → pollo (no Arepa) y qty 1', () => {
      const text = 'quiero un pollo con arepas fritas';
      expect(catalog.hasAccompanimentModifierWithMain(text)).toBe(true);
      expect(catalog.looksLikeClearlyMultiDishOrder(text)).toBe(false);
      expect(catalog.extractQuantityFromMessage(text)).toBe(1);

      const scored = catalog.searchByNameScored(
        catalog.stripProductModificationNoise(catalog.extractProductSearchQuery(text)) ||
          catalog.extractProductSearchQuery(text),
        pppMenu,
        8,
      );
      expect(scored.some((x) => /arepa/i.test(x.p.name))).toBe(false);

      const embedded = catalog.findProductEmbeddedInMessage(text, pppMenu);
      expect(embedded?.name).toMatch(/Pollo Frito/i);
      expect(catalog.isLikelySideOnlyProduct(embedded!)).toBe(false);

      const attrs = catalog.resolveAttributesFromMessage(embedded!, text, []);
      expect(attrs.status).toBe('complete');
      if (attrs.status === 'complete') {
        expect(attrs.attributes.some((a) => /fritas/i.test(a.attributeValue))).toBe(true);
      }

      const multi = catalog.resolveMultiProductOrder(text, pppMenu);
      expect(multi).toBeNull();
    });

    it('arroz con pollo → un solo producto', () => {
      const text = applyLocalGlossary('Natalia seria un arroz con pollo');
      const embedded = catalog.findProductEmbeddedInMessage(text, pppMenu);
      expect(embedded?.name).toMatch(/Arroz Con Pollo/i);
      expect(catalog.extractQuantityFromMessage(text)).toBe(1);
      const multi = catalog.resolveMultiProductOrder(text, pppMenu);
      if (multi) {
        const food = [...multi.confident, ...multi.needsAttributes];
        expect(food.length).toBe(1);
        expect(food[0].product.name).toMatch(/Arroz Con Pollo/i);
      }
    });
  });

  describe('Barrio ≠ plato (Bosques de Castilla → no Costillas)', () => {
    it('castilla no fuzzy-matchea costillas', () => {
      const text = 'Bosques de castilla';
      expect(looksLikeAddressOnlyMessage(text)).toBe(true);
      expect(
        classifyWhatsappCustomerIntent({ text, cartLength: 1 }),
      ).toBe('address');

      const scored = catalog.searchByNameScored(text, pppMenu, 5);
      expect(scored.some((x) => /costilla/i.test(x.p.name))).toBe(false);
      const embedded = catalog.findProductEmbeddedInMessage(text, pppMenu);
      expect(embedded).toBeFalsy();
    });
  });

  describe('nota explícita en ítem ≠ re-pedir atributos', () => {
    it('Pon una nota en la sobrebarriga "WILMER - NO SACAR"', () => {
      const text = 'Pon una nota en la sobrebarriga "WILMER - NO SACAR"';
      expect(looksLikeExplicitCartItemNote(text)).toBe(true);
      expect(
        classifyWhatsappCustomerIntent({ text, cartLength: 1 }),
      ).toBe('side_note');
      // No debe tratar "1" posterior como nuevo add: la intención no es pedido
      expect(
        classifyWhatsappCustomerIntent({
          text: 'quiero otra sobrebarriga',
          cartLength: 1,
        }),
      ).toBe('order_product');
    });
  });

  describe('dirección landmark / hermano Jesús ≠ multi vacío', () => {
    it('Para el hermano jesus, por favor', () => {
      const text = applyLocalGlossary('Para el hermano jesus, por favor');
      expect(looksLikeAddressOnlyMessage(text)).toBe(true);
      expect(
        classifyWhatsappCustomerIntent({
          text,
          cartLength: 1,
          looksLikeAddressOnly: true,
        }),
      ).toBe('address');
      expect(catalog.resolveMultiProductOrder(text, pppMenu)).toBeNull();
    });

    it('nota sin ensalada más papa sin duplicar', () => {
      const text = applyLocalGlossary('Se puede sin enslada mas papa?');
      expect(catalog.looksLikeSideModificationNote(text)).toBe(true);
      const note = catalog.extractProductModificationNote(text);
      expect(note).toMatch(/sin ensalada/i);
      expect(note).toMatch(/más papa/i);
      expect(note?.toLowerCase().split('más papa').length).toBe(2);
    });
  });

  describe('pago: capacidad vs elegir método', () => {
    it('se puede pagar con tarjeta ≠ solo keyword tarjeta', () => {
      expect(isPaymentCapabilityQuestion('se puede pagar con tarjeta de crédito')).toBe(
        true,
      );
      expect(isPaymentCapabilityQuestion(applyLocalGlossary('se puede pagar con tarjeta de crédit'))).toBe(
        true,
      );
      expect(isPaymentCapabilityQuestion('nequi')).toBe(false);
      expect(isPaymentCapabilityQuestion('pago con transferencia')).toBe(false);
    });
  });

  describe('C21 — domicilio + dirección ≠ varios platos', () => {
    it.each([
      'Para Un domicikio Para bosques De Castilla',
      'Quiero Un domicilio, Para bosques De Castilla',
    ])('no entra a multi: %s', (raw) => {
      const text = applyLocalGlossary(raw);
      expect(catalog.looksLikeClearlyMultiDishOrder(text)).toBe(false);
      expect(catalog.resolveMultiProductOrder(text, pppMenu)).toBeNull();
    });
  });

  describe('menú explore ≠ dirección (qué bebidas hay)', () => {
    it.each(['Que bebidas hay', 'Qué bebidas hay', 'que sopas tienen'])(
      'browse, no address: %s',
      (text) => {
        expect(catalog.isCategoryBrowseQuestion(text) || catalog.isMenuExploreIntent(text, [])).toBe(
          true,
        );
        expect(looksLikeAddressOnlyMessage(text)).toBe(false);
        expect(looksLikeNonAddressCommand(text)).toBe(true);
        expect(
          classifyWhatsappCustomerIntent({
            text,
            cartLength: 2,
            looksLikeAddressOnly: false,
            isCategoryBrowse: catalog.isCategoryBrowseQuestion(text),
            isMenuExplore: catalog.isMenuExploreIntent(text, []),
          }),
        ).toBe('menu_question');
      },
    );
  });

  describe('Castellón / domicilio por favor', () => {
    it('Castellón + torre + apto es dirección', () => {
      const text = 'Castellón de los condes torre 3 apto 112';
      expect(looksLikeAddressOnlyMessage(text)).toBe(true);
      expect(
        classifyWhatsappCustomerIntent({ text, cartLength: 1 }),
      ).toBe('address');
    });

    it('setup domicilio sin dirección inventada', () => {
      expect(isDeliverySetupWithoutFood('Buenas noches para un domicilio por favor')).toBe(
        true,
      );
      expect(
        extractDeliverySetupAddress('Buenas noches para un domicilio por favor'),
      ).toBeNull();
      expect(isDeliveryLogisticsFluff('Para solicitar un domicilio')).toBe(true);
      expect(extractDeliverySetupAddress('Para solicitar un domicilio')).toBeNull();
    });

    it('adicionar plátano no es nota de carrito', () => {
      const text = applyLocalGlossary('Me podrías adicionar un plata con queso y bocadillo');
      expect(catalog.looksLikeExplicitAddProductRequest(text)).toBe(true);
      expect(catalog.extractProductModificationNote(text)).toBeNull();
    });
  });

  describe('C09 / C07 — arroz chino variantes + explicar combo', () => {
    it('arroz chino agrupa presentaciones (caja / medio pollo / costillas / combo)', () => {
      expect(catalog.getProductNameBase('Arroz Chino Caja Con Papa Francesa')).toBe(
        catalog.getProductNameBase('Arroz Chino Con Medio Pollo'),
      );
      const family = catalog.findProductVariantFamily('arroz chino', pppMenu);
      expect(family).toBeTruthy();
      expect(family!.variants.length).toBeGreaterThanOrEqual(3);
      expect(family!.variants.some((v) => /medio pollo/i.test(v.name))).toBe(true);
      expect(family!.variants.some((v) => /costilla/i.test(v.name))).toBe(true);
    });

    it('pickVariant: con medio pollo / costillas / combo', () => {
      const family = catalog.findProductVariantFamily('arroz chino', pppMenu)!;
      expect(
        catalog.pickVariantFromFamilyText('el que viene con medio pollo', family)?.code,
      ).toBe(71);
      expect(catalog.pickVariantFromFamilyText('con costillas', family)?.code).toBe(72);
      expect(catalog.pickVariantFromFamilyText('en combo', family)?.code).toBe(73);
    });

    it('Un arroz chino en combo + Un ajiaco (newline) → combo + sopa', () => {
      const text = applyLocalGlossary('Un arroz chino en combo\nUn ajiaco');
      expect(catalog.looksLikePersonNameSegment('ajiaco')).toBe(false);
      expect(catalog.looksLikeClearlyMultiDishOrder(text)).toBe(true);
      expect(catalog.countQuantityMentions(text)).toBeGreaterThanOrEqual(2);

      const multi = catalog.resolveMultiProductOrder(text, pppMenu);
      expect(multi).toBeTruthy();
      const names = [
        ...multi!.confident.map((c) => c.product.name),
        ...multi!.needsAttributes.map((c) => c.product.name),
      ];
      expect(names).toContain('Arroz Chino Combo');
      expect(names).toContain('Sopa De Ajiaco');
      expect(names).not.toContain('Arroz Chino Caja Con Papa Francesa');
      expect(multi!.possibleCustomerNames || []).not.toContain('ajiaco');
    });

    it('“y me vendes un combo de arroz chino” → pedido combo, no consulta', () => {
      const text = applyLocalGlossary('y me vendes un combo de arroz chino');
      expect(text).toMatch(/arroz chino combo/i);
      expect(catalog.isAvailabilityInquiry(text)).toBe(false);
      expect(catalog.isGenericProductInquiry(text)).toBe(false);
      expect(catalog.extractVariantPreferenceHint(text)).toBe('combo');

      const family = catalog.findProductVariantFamily(text, pppMenu)!;
      expect(catalog.pickVariantFromFamilyText(text, family)?.code).toBe(73);
      expect(catalog.findProductEmbeddedInMessage(text, pppMenu)?.code).toBe(73);
      const scored = catalog.searchByNameScored(text, pppMenu, 5);
      expect(scored[0]?.p.code).toBe(73);
    });

    it('isComboMeaningInquiry', () => {
      expect(catalog.isComboMeaningInquiry('Que significa a en combo y cuánto valdría ?')).toBe(
        true,
      );
      expect(catalog.isComboMeaningInquiry('quiero un pollo frito')).toBe(false);
      const family = catalog.findProductVariantFamily('pollo frito', pppMenu, [
        pppMenu.find((p) => p.code === 1)!,
      ])!;
      expect(catalog.formatComboExplanation(family)).toMatch(/presentaciones|combo/i);
    });
  });

  describe('Combo más grande respeta contexto (tacos)', () => {
    const duo = () => pppMenu.find((p) => p.code === 171)!;
    const trio = () => pppMenu.find((p) => p.code === 172)!;
    const polloCombo = () => pppMenu.find((p) => p.code === 99)!;

    it('“No vendes un combo más grande” es consulta de pack, no pedido suelto', () => {
      const text = applyLocalGlossary('No vendes un combo más grande');
      expect(catalog.isLargerPackInquiry(text)).toBe(true);
      expect(catalog.isVaguePackSizeQuery(text)).toBe(true);
      expect(catalog.isAvailabilityInquiry(text)).toBe(true);
    });

    it('desde Duo de Tacos → Trío, nunca Combo De Pollo', () => {
      const text = applyLocalGlossary('No vendes un combo más grande');
      const related = catalog.findRelatedLargerPackProducts(duo(), pppMenu);
      expect(related.map((p) => p.code)).toEqual([172]);
      expect(catalog.productsShareCoreFoodTokens(duo(), trio())).toBe(true);
      expect(catalog.productsShareCoreFoodTokens(duo(), polloCombo())).toBe(false);

      const scored = catalog.searchByNameScored(text, pppMenu, 5);
      // El buscador global sigue sesgado a “combo”; el handler de pack no debe usarlo
      expect(scored[0]?.p.name).toMatch(/combo/i);
      expect(related.some((p) => /pollo|arroz/i.test(p.name))).toBe(false);
    });

    it('sin pack mayor: lista vacía (se re-pregunta el Duo)', () => {
      const onlyDuo = pppMenu.filter((p) => p.code !== 172);
      expect(catalog.findRelatedLargerPackProducts(duo(), onlyDuo)).toEqual([]);
    });
  });
});
