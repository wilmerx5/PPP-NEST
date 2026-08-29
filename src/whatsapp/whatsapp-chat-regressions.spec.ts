/**
 * Regresiones de chats reales WhatsApp.
 *
 * Regla de equipo: cada conversación mala en prod/staging → 1+ casos aquí
 * ANTES (o junto) al fix. `yarn test:whatsapp` debe pasar antes de deploy.
 */
import {
  isAbandonPendingSelectionIntent,
  isAddressChangeIntent,
  resolvePendingListOrMenuCode,
} from './whatsapp-session-intents';
import { WhatsappCatalogService, type WhatsappCatalogProduct } from './whatsapp-catalog.service';
import { applyLocalGlossary } from './whatsapp-local-glossary';
import { WhatsappPointsService } from './whatsapp-points.service';

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
    id: 90,
    code: 90,
    name: 'Arepa',
    price: 2000,
    hasAttributes: false,
    attributes: [],
    availableNow: true,
    categoryName: 'Porciones',
  },
];

describe('WhatsApp chat regressions (prod-hardening)', () => {
  const catalog = new WhatsappCatalogService({} as never);
  const points = new WhatsappPointsService({} as never);

  describe('Natalia / nombre ≠ plato', () => {
    it('Natalia seria un arroz… → nombre de persona, no unresolved', () => {
      expect(catalog.looksLikePersonNameSegment('Natalia')).toBe(true);
      expect(catalog.looksLikePersonNameSegment('Natalia seria')).toBe(true);
      expect(catalog.looksLikePersonNameSegment('arroz con pollo')).toBe(false);
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
      expect(isAbandonPendingSelectionIntent('quiero una limonada')).toBe(false);
    });

    it('cambia la dirección…', () => {
      expect(isAddressChangeIntent('Cambia la direccion a dg 6 b 78b 64')).toBe(true);
      expect(isAddressChangeIntent('quiero un pollo frito')).toBe(false);
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
});
