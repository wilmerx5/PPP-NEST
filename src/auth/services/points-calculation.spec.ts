import { PointsService } from './points.service';

/**
 * Reglas de puntos: códigos 1, 99, 4, 98, 89 = 1 punto c/u;
 * códigos 2 y 5 = 1 punto SOLO en pareja.
 */
describe('PointsService.calculatePointsFromCodes', () => {
  const service = Object.create(PointsService.prototype) as PointsService;

  it('array vacío → 0 puntos', () => {
    expect(service.calculatePointsFromCodes([])).toBe(0);
  });

  it('códigos individuales suman 1 punto cada uno', () => {
    expect(service.calculatePointsFromCodes([1, 99, 4, 98, 89])).toBe(5);
  });

  it('duplicados cuentan (2 pollos enteros = 2 puntos)', () => {
    expect(service.calculatePointsFromCodes([1, 1])).toBe(2);
  });

  it('medio pollo solo (código 2 o 5) NO da punto', () => {
    expect(service.calculatePointsFromCodes([2])).toBe(0);
    expect(service.calculatePointsFromCodes([5])).toBe(0);
  });

  it('pareja 2+5 da 1 punto', () => {
    expect(service.calculatePointsFromCodes([2, 5])).toBe(1);
  });

  it('parejas múltiples: min(count2, count5)', () => {
    expect(service.calculatePointsFromCodes([2, 2, 5])).toBe(1);
    expect(service.calculatePointsFromCodes([2, 2, 5, 5])).toBe(2);
  });

  it('mezcla: pollo entero + pareja de medios', () => {
    expect(service.calculatePointsFromCodes([1, 2, 5])).toBe(2);
  });

  it('códigos sin puntos (ej. 90 extras) no suman', () => {
    expect(service.calculatePointsFromCodes([90, 90, 42])).toBe(0);
  });
});
