import { OrdersService } from './orders.service';
import { CreateOrderDto } from './DTOS/orderDTO';

/**
 * Tests de la lógica pura de idempotencia/deduplicación del create.
 * No tocan la DB: instancian OrdersService sin dependencias y prueban
 * los métodos privados puros vía acceso indexado.
 */
describe('OrdersService — fingerprint de deduplicación', () => {
  // Instancia sin DI: solo usamos métodos puros que no tocan repos
  const service = Object.create(OrdersService.prototype) as OrdersService;
  const fingerprint = (dto: Partial<CreateOrderDto>) =>
    (service as any).buildOrderContentFingerprint(dto as CreateOrderDto);

  const baseDto: Partial<CreateOrderDto> = {
    customerName: 'Juan',
    phone: '3001234567',
    address: 'Calle 1 # 2-3',
    orderType: 'delivery',
    deliveryFee: 2000,
    items: [
      {
        productId: 12,
        note: 'sin cebolla',
        attributes: [{ attributeName: 'Salsa', attributeValue: 'BBQ' }],
      },
      { productId: 5, note: '', attributes: [] },
    ] as any,
  };

  it('mismo contenido → mismo fingerprint', () => {
    expect(fingerprint(baseDto)).toBe(fingerprint(JSON.parse(JSON.stringify(baseDto))));
  });

  it('orden de items no cambia el fingerprint', () => {
    const reordered = {
      ...baseDto,
      items: [...(baseDto.items as any[])].reverse(),
    };
    expect(fingerprint(reordered)).toBe(fingerprint(baseDto));
  });

  it('producto distinto → fingerprint distinto', () => {
    const changed = {
      ...baseDto,
      items: [{ productId: 99, note: '', attributes: [] }] as any,
    };
    expect(fingerprint(changed)).not.toBe(fingerprint(baseDto));
  });

  it('atributo distinto → fingerprint distinto', () => {
    const changed = JSON.parse(JSON.stringify(baseDto));
    changed.items[0].attributes[0].attributeValue = 'Piña';
    expect(fingerprint(changed)).not.toBe(fingerprint(baseDto));
  });

  it('teléfono distinto → fingerprint distinto (dos clientes, mismo pedido)', () => {
    expect(fingerprint({ ...baseDto, phone: '3009999999' })).not.toBe(fingerprint(baseDto));
  });

  it('extras afectan el fingerprint', () => {
    const withExtras = {
      ...baseDto,
      extras: [{ title: 'Plato extra', amount: 1000, quantity: 2 }],
    };
    expect(fingerprint(withExtras)).not.toBe(fingerprint(baseDto));
  });

  it('nota distinta → fingerprint distinto', () => {
    const changed = JSON.parse(JSON.stringify(baseDto));
    changed.items[0].note = 'bien asado';
    expect(fingerprint(changed)).not.toBe(fingerprint(baseDto));
  });
});

describe('OrdersService — candado en memoria (inflightCreates)', () => {
  it('dos creates concurrentes con la misma clave comparten una sola ejecución', async () => {
    const service = Object.create(OrdersService.prototype) as any;
    service.inflightCreates = new Map();

    let executions = 0;
    service.findExistingByClientRequestId = jest.fn().mockResolvedValue(null);
    service.findSoftDuplicate = jest.fn().mockResolvedValue(null);
    service.createOrderInternal = jest.fn().mockImplementation(async () => {
      executions += 1;
      await new Promise((r) => setTimeout(r, 30));
      return { success: true, orderId: 42, dailyOrderNumber: 7 };
    });

    const dto = { clientRequestId: 'uuid-abc', items: [{ productId: 1 }] };
    const [r1, r2] = await Promise.all([service.create(dto), service.create({ ...dto })]);

    expect(executions).toBe(1);
    expect(r1.orderId).toBe(42);
    expect(r2.orderId).toBe(42);
    expect(r2.duplicate).toBe(true);
    // El mapa queda limpio para no bloquear pedidos futuros
    expect(service.inflightCreates.size).toBe(0);
  });

  it('si ya existe una orden con esa clave, la devuelve sin crear otra', async () => {
    const service = Object.create(OrdersService.prototype) as any;
    service.inflightCreates = new Map();
    service.findExistingByClientRequestId = jest
      .fn()
      .mockResolvedValue({ success: true, orderId: 10, dailyOrderNumber: 3, duplicate: true });
    service.createOrderInternal = jest.fn();

    const res = await service.create({ clientRequestId: 'uuid-x', items: [{ productId: 1 }] });

    expect(res.orderId).toBe(10);
    expect(res.duplicate).toBe(true);
    expect(service.createOrderInternal).not.toHaveBeenCalled();
  });
});
