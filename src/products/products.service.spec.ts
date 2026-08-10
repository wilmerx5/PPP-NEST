import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { ProductVariantStock } from './entities/product-variant-stock.entity';
import { InventoryGroup } from './entities/inventory-group.entity';
import { InventoryGroupItem } from './entities/inventory-group-item.entity';
import { InventorySelection } from './entities/inventory-selection.entity';
import { InventorySelectionProduct } from './entities/inventory-selection-product.entity';
import { ProductSchedule } from './entities/product-schedule.entity';
import { CacheService } from 'src/common/cache/cache.service';
import { CircuitBreakerService } from 'src/common/circuit-breaker/circuit-breaker.service';
import { BusinessService } from 'src/business/business.service';

const repoMock = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  save: jest.fn(async (row: unknown) => row),
  create: jest.fn((row: unknown) => row),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  createQueryBuilder: jest.fn(() => ({
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  })),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let groupItemRepo: ReturnType<typeof repoMock>;
  let productRepo: ReturnType<typeof repoMock>;
  let variantStockRepo: ReturnType<typeof repoMock>;
  let groupRepo: ReturnType<typeof repoMock>;
  let scheduleRepo: ReturnType<typeof repoMock>;
  let attributeRepo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    groupItemRepo = repoMock();
    productRepo = repoMock();
    variantStockRepo = repoMock();
    groupRepo = repoMock();
    scheduleRepo = repoMock();
    attributeRepo = repoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(Category), useValue: repoMock() },
        { provide: getRepositoryToken(ProductAttribute), useValue: attributeRepo },
        { provide: getRepositoryToken(ProductVariantStock), useValue: variantStockRepo },
        { provide: getRepositoryToken(InventoryGroup), useValue: groupRepo },
        { provide: getRepositoryToken(InventoryGroupItem), useValue: groupItemRepo },
        { provide: getRepositoryToken(InventorySelection), useValue: repoMock() },
        { provide: getRepositoryToken(InventorySelectionProduct), useValue: repoMock() },
        { provide: getRepositoryToken(ProductSchedule), useValue: scheduleRepo },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), size: jest.fn(), invalidate: jest.fn() } },
        { provide: CircuitBreakerService, useValue: { execute: jest.fn(), getState: jest.fn() } },
        {
          provide: BusinessService,
          useValue: {
            getClock: jest.fn().mockResolvedValue({
              timezone: 'America/Bogota',
              dateStr: '2026-08-09',
              dayOfWeek: 0,
              minutes: 12 * 60,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getInventoryByProductIds', () => {
    it('devuelve mapa vacío sin ids (0 consultas)', async () => {
      const map = await service.getInventoryByProductIds([]);
      expect(map.size).toBe(0);
      expect(groupItemRepo.find).not.toHaveBeenCalled();
    });

    it('producto sin grupo: usa stock propio y variantes', async () => {
      productRepo.find.mockResolvedValue([
        { id: 7, trackInventory: true, stock: 12, alsoDeductProductId: null, alsoDeductBaseUnits: null },
      ]);
      variantStockRepo.find.mockResolvedValue([
        { productId: 7, attributeName: 'Presa', attributeValue: 'Pierna', stock: 4 },
      ]);

      const map = await service.getInventoryByProductIds([7], { includeAlsoDeductTargets: true });

      const info = map.get(7)!;
      expect(info.trackInventory).toBe(true);
      expect(info.stock).toBe(12);
      expect(info.variantStocks).toEqual([
        { attributeName: 'Presa', attributeValue: 'Pierna', stock: 4 },
      ]);
    });

    it('producto en grupo: reporta stock del grupo', async () => {
      groupItemRepo.find.mockResolvedValue([
        {
          productId: 7,
          groupId: 3,
          baseUnits: 2,
          attributeName: null,
          attributeValue: null,
          alsoDeductProductId: null,
          selections: [],
        },
      ]);
      productRepo.find.mockResolvedValue([
        { id: 7, trackInventory: false, stock: 0, alsoDeductProductId: null, alsoDeductBaseUnits: null },
      ]);
      groupRepo.find.mockResolvedValue([{ id: 3, stock: 20 }]);

      const map = await service.getInventoryByProductIds([7], { includeAlsoDeductTargets: true });

      const info = map.get(7)!;
      expect(info.trackInventory).toBe(true);
      expect(info.groupId).toBe(3);
      expect(info.groupStock).toBe(20);
      expect(info.groupBaseUnits).toBe(2);
    });
  });

  describe('update', () => {
    const baseProduct = {
      id: 1,
      name: 'Pollo',
      description: '',
      price: 10000,
      hasAttributes: false,
      trackInventory: false,
      stock: 0,
      hasSchedule: false,
      alsoDeductProductId: null,
      alsoDeductAttributeName: null,
      alsoDeductAttributeValue: null,
      alsoDeductBaseUnits: null,
      attributes: [],
      categories: [],
      variantStocks: [],
      schedules: [],
    };

    beforeEach(() => {
      productRepo.findOne.mockResolvedValue({ ...baseProduct });
    });

    it('no toca horarios si el DTO no envía hasSchedule/schedules (p. ej. solo precio)', async () => {
      await service.update(1, { price: 12000 } as any);
      expect(scheduleRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(productRepo.save).toHaveBeenCalledWith(expect.objectContaining({ price: 12000, hasSchedule: false }));
    });

    it('alsoDeductProductId 0/null no guarda 0 (rompe FK → 500)', async () => {
      await service.update(1, { alsoDeductProductId: 0 } as any);
      expect(productRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ alsoDeductProductId: null }),
      );
    });

    it('con hasSchedule guarda filas de horario', async () => {
      await service.update(1, {
        hasSchedule: true,
        schedules: [{ dayOfWeek: 1, startTime: '11:00', endTime: '15:00' }],
      } as any);
      expect(scheduleRepo.createQueryBuilder).toHaveBeenCalled();
      expect(scheduleRepo.save).toHaveBeenCalled();
    });
  });
});
