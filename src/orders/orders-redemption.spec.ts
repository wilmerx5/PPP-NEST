import { Order } from './entities/order.entity';
import { OrdersService } from './orders.service';

describe('Premios de medio pollo por orden', () => {
  const firstCode = 'REDEEM000001';
  const secondCode = 'REDEEM000002';

  function setup(codes: number[], existingCode: string | null = null) {
    const service = Object.create(OrdersService.prototype);
    const order = {
      id: 17,
      points: 0,
      redemptionCode: existingCode,
      redemptionCodes: null,
      items: codes.map(code => ({ product: { code, price: 25000 }, unitPrice: 20000 })),
    } as Order;
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue(order),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(order),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(orderRepo) };
    const calculatePointsFromCodes = jest.fn((items: number[]) => items.length);
    const applyRedemptionToOrder = jest.fn(async (code: string) => ({ code }));
    Object.assign(service, {
      dataSource: { transaction: (run: (tx: typeof manager) => unknown) => run(manager) },
      orderRepo: { findOne: jest.fn().mockResolvedValue(null) },
      pointsService: { calculatePointsFromCodes, applyRedemptionToOrder },
    });
    return { service, order, manager, calculatePointsFromCodes, applyRedemptionToOrder };
  }

  describe('creación desde el checkout', () => {
    function setupCheckout() {
      const { service, applyRedemptionToOrder } = setup([]);
      const manager = {
        query: jest.fn().mockResolvedValue([{ got: 1 }]),
        create: jest.fn((_entity, values) => values),
        save: jest.fn(async order => ({ ...order, id: 17 })),
        insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }, { id: 2 }] }),
      };
      const runner = {
        manager,
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };
      Object.assign(service, {
        dataSource: { createQueryRunner: () => runner },
        productRepo: { find: jest.fn().mockResolvedValue([{ id: 42, code: 2, price: 20000 }]) },
        productsService: {
          getInventoryByProductIds: jest.fn().mockResolvedValue(new Map()),
          assertOnlineProductsAvailable: jest.fn(),
        },
        businessService: { assertAcceptingOnlineOrders: jest.fn() },
        generateNextOrderNumber: jest.fn().mockResolvedValue(1),
        finalizeOrderAfterCreate: jest.fn(),
        deductInventory: jest.fn(),
        findExistingByClientRequestId: jest.fn().mockResolvedValue(null),
        inflightCreates: new Map(),
      });
      const order = {
        orderSource: 'online',
        customerName: 'Cliente',
        phone: '3000000000',
        address: '',
        clientRequestId: 'checkout-premios',
        items: [{ productId: 42 }, { productId: 42 }],
        redemptionCodes: [firstCode, secondCode],
      };
      return { service, order, runner, applyRedemptionToOrder };
    }

    it('guarda ambos premios antes de confirmar la orden', async () => {
      const { service, order, runner, applyRedemptionToOrder } = setupCheckout();
      await expect(service.create(order)).resolves.toMatchObject({ orderId: 17 });
      expect(applyRedemptionToOrder).toHaveBeenCalledTimes(2);
      expect(runner.manager.save).toHaveBeenLastCalledWith(expect.objectContaining({
        redemptionCodes: [firstCode, secondCode],
        points: 0,
      }));
      expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('revierte la transacción si el segundo código ya se usó', async () => {
      const { service, order, runner, applyRedemptionToOrder } = setupCheckout();
      applyRedemptionToOrder
        .mockResolvedValueOnce({ code: firstCode })
        .mockRejectedValueOnce(new Error('Código ya usado'));

      await expect(service.create(order)).rejects.toThrow('Código ya usado');
      expect(applyRedemptionToOrder).toHaveBeenCalledTimes(2);
      expect(runner.commitTransaction).not.toHaveBeenCalled();
      expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });
  });

  it('aplica dos códigos distintos y excluye ambas unidades del cálculo de puntos', async () => {
    const { service, order, manager, calculatePointsFromCodes, applyRedemptionToOrder } = setup([5, 2, 8]);
    await service.applyRedemptionVoucher(order.id, firstCode);
    await service.applyRedemptionVoucher(order.id, secondCode);

    expect(order.redemptionCodes).toEqual([firstCode, secondCode]);
    expect(order.redemptionCode).toBe(firstCode);
    expect(applyRedemptionToOrder).toHaveBeenNthCalledWith(2, secondCode, order.id, manager);
    expect(calculatePointsFromCodes.mock.calls).toEqual([[[5, 8]], [[8]]]);
  });

  it('reconoce el código de una orden anterior y evita canjear más premios que unidades', async () => {
    const { service, order, applyRedemptionToOrder } = setup([2, 8], firstCode);

    await expect(service.applyRedemptionVoucher(order.id, firstCode.toLowerCase()))
      .rejects.toThrow('Este premio ya está aplicado al pedido');
    await expect(service.applyRedemptionVoucher(order.id, secondCode))
      .rejects.toThrow('Se necesita un medio pollo en el pedido por cada premio');
    expect(applyRedemptionToOrder).not.toHaveBeenCalled();
  });

  it('suma los precios guardados de las dos unidades cubiertas por los premios', () => {
    const { service, order } = setup([5, 8, 2]);
    order.redemptionCodes = [firstCode, secondCode];
    order.items[0].unitPrice = 21000;
    const covered = service.getRewardItems(order);
    expect(covered.map((item: Order['items'][number]) => item.unitPrice)).toEqual([20000, 21000]);
  });
});
