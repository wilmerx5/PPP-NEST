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

describe('OrdersService — resolveBulkInsertIds (MariaDB)', () => {
  const service = Object.create(OrdersService.prototype) as any;

  it('usa insertId + affectedRows (no confía solo en identifiers)', () => {
    const ids = service.resolveBulkInsertIds(
      { identifiers: [{ id: 10 }], raw: { insertId: 10, affectedRows: 3 } },
      3,
    );
    expect(ids).toEqual([10, 11, 12]);
  });

  it('fallback a identifiers si vienen completos', () => {
    const ids = service.resolveBulkInsertIds(
      { identifiers: [{ id: 5 }, { id: 6 }], raw: {} },
      2,
    );
    expect(ids).toEqual([5, 6]);
  });

  it('falla si no puede resolver todos los ids', () => {
    expect(() =>
      service.resolveBulkInsertIds({ identifiers: [{ id: 1 }], raw: { insertId: 1, affectedRows: 1 } }, 3),
    ).toThrow();
  });
});
