import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  const ordersServiceMock = {
    create: jest.fn(),
    findMine: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersServiceMock }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOrder — idempotencia', () => {
    it('usa clientRequestId del body si viene', async () => {
      ordersServiceMock.create.mockResolvedValue({ success: true, orderId: 1 });
      const dto: any = { items: [{ productId: 1 }], clientRequestId: 'body-key' };

      await controller.createOrder(dto, 'header-key');

      expect(ordersServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientRequestId: 'body-key' }),
      );
    });

    it('usa el header Idempotency-Key si el body no trae clave', async () => {
      ordersServiceMock.create.mockResolvedValue({ success: true, orderId: 1 });
      const dto: any = { items: [{ productId: 1 }] };

      await controller.createOrder(dto, 'header-key');

      expect(ordersServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientRequestId: 'header-key' }),
      );
    });

    it('recorta claves de más de 64 caracteres', async () => {
      ordersServiceMock.create.mockResolvedValue({ success: true, orderId: 1 });
      const longKey = 'x'.repeat(100);

      await controller.createOrder({ items: [{ productId: 1 }] } as any, longKey);

      const passed = ordersServiceMock.create.mock.calls[0][0].clientRequestId;
      expect(passed).toHaveLength(64);
    });

    it('sin clave: no inventa clientRequestId', async () => {
      ordersServiceMock.create.mockResolvedValue({ success: true, orderId: 1 });

      await controller.createOrder({ items: [{ productId: 1 }] } as any, undefined);

      const passed = ordersServiceMock.create.mock.calls[0][0].clientRequestId;
      expect(passed).toBeFalsy();
    });
  });
});
