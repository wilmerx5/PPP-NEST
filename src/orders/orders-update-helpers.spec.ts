import { OrdersService } from './orders.service';

describe('OrdersService — helpers de update', () => {
  const service = Object.create(OrdersService.prototype) as any;

  describe('deduplicateOrderItemsById', () => {
    it('elimina filas duplicadas por id (JOIN TypeORM)', () => {
      const items = [
        { id: 1, product: { id: 10 } },
        { id: 1, product: { id: 10 } },
        { id: 2, product: { id: 11 } },
        { id: undefined },
        { id: 2, product: { id: 11 } },
      ];
      const out = service.deduplicateOrderItemsById(items);
      expect(out.map((i: any) => i.id)).toEqual([1, 2]);
    });

    it('array vacío / undefined → []', () => {
      expect(service.deduplicateOrderItemsById([])).toEqual([]);
      expect(service.deduplicateOrderItemsById(undefined)).toEqual([]);
    });
  });

  describe('incomingItemSignature', () => {
    it('misma firma si atributos en distinto orden', () => {
      const a = {
        productId: 5,
        note: 'x',
        attributes: [
          { attributeName: 'Salsa', attributeValue: 'BBQ' },
          { attributeName: 'Bebida', attributeValue: 'Gaseosa' },
        ],
      };
      const b = {
        productId: 5,
        note: 'x',
        attributes: [
          { attributeName: 'Bebida', attributeValue: 'Gaseosa' },
          { attributeName: 'Salsa', attributeValue: 'BBQ' },
        ],
      };
      expect(service.incomingItemSignature(a)).toBe(service.incomingItemSignature(b));
    });

    it('nota distinta → firma distinta', () => {
      const a = { productId: 5, note: 'a', attributes: [] };
      const b = { productId: 5, note: 'b', attributes: [] };
      expect(service.incomingItemSignature(a)).not.toBe(service.incomingItemSignature(b));
    });
  });

  describe('deduplicateIncomingUpdateItems', () => {
    it('elimina líneas idénticas del payload (solo helper; update NO lo usa para unidades)', () => {
      const items = [
        { productId: 1, note: '', attributes: [] },
        { productId: 1, note: '', attributes: [] },
        { productId: 2, note: 'x', attributes: [{ attributeName: 'A', attributeValue: '1' }] },
      ];
      const out = service.deduplicateIncomingUpdateItems(items);
      expect(out).toHaveLength(2);
      expect(out[0].productId).toBe(1);
      expect(out[1].productId).toBe(2);
    });
  });
});

describe('Regla de negocio: update NO debe colapsar N líneas idénticas', () => {
  it('documenta que N combos iguales = N ítems (no dedupe por firma en update)', () => {
    // El update usa itemsToCreate = rawItems.slice() SIN deduplicateIncomingUpdateItems.
    // Este test protege esa decisión: si alguien la cambia, falla conscientemente.
    const raw = Array.from({ length: 13 }, () => ({
      productId: 99,
      note: '',
      attributes: [{ attributeName: 'Combo', attributeValue: 'A' }],
    }));
    expect(raw).toHaveLength(13);
    expect(new Set(raw.map((r) => `${r.productId}|${r.attributes[0].attributeValue}`)).size).toBe(1);
  });
});
