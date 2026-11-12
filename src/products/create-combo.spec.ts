import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { Category } from './entities/category.entity';

function setup(attributeFailure = false) {
  let saved: any;
  const products = {
    findOne: jest.fn(async ({ where }: any) =>
      where.id === 1
        ? { id: 1, comboBaseProductId: null }
        : where.code
          ? null
          : saved,
    ),
    create: jest.fn((row: any) => row),
    save: jest.fn(async (row: any) => (saved = { ...row, id: 2 })),
  };
  const attrs = {
    save: jest.fn(async () => {
      if (attributeFailure) throw new Error('attribute write failed');
      return [];
    }),
  };
  const categories = { find: jest.fn().mockResolvedValue([{ id: 7 }]) };
  const manager = {
    getRepository: jest.fn((type: any) =>
      type === Product
        ? products
        : type === ProductAttribute
          ? attrs
          : type === Category
            ? categories
            : null,
    ),
  };
  const service = Object.create(ProductsService.prototype) as any;
  service.productRepo = {
    manager: { transaction: jest.fn(async (fn: any) => fn(manager)) },
  };
  service.cache = { invalidate: jest.fn() };
  return { service, products, attrs, manager };
}
const dto = {
  name: 'Experiencia Serrana',
  code: 12,
  price: 26000,
  categoryIds: [7],
  attributes: [{ attributeName: 'Bebida', options: ['Cola', 'Manzana'] }],
};
test('creates product and link together with transaction-scoped category and attribute writes', async () => {
  const { service, products, attrs } = setup();
  const created = await service.createCombo(1, dto);
  expect(created).toMatchObject({
    id: 2,
    comboBaseProductId: 1,
    name: dto.name,
    price: 26000,
    categories: [{ id: 7 }],
  });
  expect(products.findOne.mock.calls[0][0]).toMatchObject({
    where: { id: 1 },
    lock: { mode: 'pessimistic_write' },
  });
  expect(attrs.save).toHaveBeenCalledTimes(1);
  expect(service.cache.invalidate).toHaveBeenLastCalledWith('products:');
});
test('propagates a dependent write failure through the transaction', async () => {
  const { service, products } = setup(true);
  await expect(service.createCombo(1, dto)).rejects.toThrow(
    'attribute write failed',
  );
  expect(products.save).toHaveBeenCalledWith(
    expect.objectContaining({ comboBaseProductId: 1 }),
  );
});
test('rejects creation from another combo before inserting anything', async () => {
  const { service, products } = setup();
  products.findOne.mockResolvedValueOnce({
    id: 1,
    comboBaseProductId: 5,
  } as any);
  await expect(service.createCombo(1, dto)).rejects.toThrow('producto normal');
  expect(products.save).not.toHaveBeenCalled();
});
