import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderExtra } from './entities/order-extra.entity';
import { Product } from 'src/products/entities/product.entity';
import { User } from 'src/auth/entities/user.entity';
import { OrdersGateway } from './Websocket/order.gateway';
import { PointsService } from 'src/auth/services/points.service';
import { ProductsService } from 'src/products/products.service';
import { MailService } from 'src/common/mail/mail.service';
import { CircuitBreakerService } from 'src/common/circuit-breaker/circuit-breaker.service';

const repoMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: repoMock() },
        { provide: getRepositoryToken(OrderItem), useValue: repoMock() },
        { provide: getRepositoryToken(OrderItemAttribute), useValue: repoMock() },
        { provide: getRepositoryToken(OrderExtra), useValue: repoMock() },
        { provide: getRepositoryToken(Product), useValue: repoMock() },
        { provide: getRepositoryToken(User), useValue: repoMock() },
        { provide: OrdersGateway, useValue: { emitOrderCreated: jest.fn(), server: { emit: jest.fn() } } },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn(), query: jest.fn() } },
        { provide: PointsService, useValue: { calculatePointsFromCodes: jest.fn().mockReturnValue(0) } },
        { provide: ProductsService, useValue: { getInventoryByProductIds: jest.fn().mockResolvedValue(new Map()) } },
        { provide: MailService, useValue: { sendMail: jest.fn() } },
        { provide: CircuitBreakerService, useValue: { execute: jest.fn(), getState: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
