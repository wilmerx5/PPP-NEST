import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { UpdateComboRelationDto } from './dto/update-combo-relation.dto';

function setup(rows: Array<Partial<Product>>, children = 0) {
  const repo = {
    find: jest.fn().mockResolvedValue(rows),
    count: jest.fn().mockResolvedValue(children),
    save: jest.fn(async (product: Product) => product),
  };
  const manager = { getRepository: jest.fn().mockReturnValue(repo) };
  const service = Object.create(ProductsService.prototype) as any;
  service.productRepo = { manager: { transaction: jest.fn(async (fn: Function) => fn(manager)) } };
  service.cache = { invalidate: jest.fn() };
  return { service, repo };
}

test('persists and removes an explicit link with ordered endpoint locks and cache invalidation', async () => {
  const { service, repo } = setup([{ id: 2 }, { id: 5 }]);
  expect((await service.setComboBaseProduct(5, 2)).comboBaseProductId).toBe(2);
  expect(repo.find.mock.calls[0][0]).toMatchObject({ order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
  expect(service.cache.invalidate).toHaveBeenCalledWith('products:');
  expect((await service.setComboBaseProduct(5, null)).comboBaseProductId).toBeNull();
});
for (const [description, rows, children, error] of [
  ['missing combo', [{ id: 2 }], 0, NotFoundException],
  ['missing normal', [{ id: 5 }], 0, NotFoundException],
  ['combo as parent', [{ id: 2, comboBaseProductId: 9 }, { id: 5 }], 0, BadRequestException],
  ['normal with child combos', [{ id: 2 }, { id: 5 }], 1, BadRequestException],
] as const) {
  test(`rejects ${description} before saving`, async () => {
    const { service, repo } = setup([...rows], children);
    await expect(service.setComboBaseProduct(5, 2)).rejects.toBeInstanceOf(error);
    expect(repo.save).not.toHaveBeenCalled();
    expect(service.cache.invalidate).not.toHaveBeenCalled();
  });
}
for (const value of [0, -1, 1.5, undefined, '2']) {
  test(`rejects malformed relation ${String(value)}`, async () => {
    const dto = Object.assign(new UpdateComboRelationDto(), { comboBaseProductId: value });
    expect(await validate(dto)).not.toHaveLength(0);
  });
}
for (const value of [2, null]) {
  test(`accepts explicit relation value ${value}`, async () => {
    expect(await validate(Object.assign(new UpdateComboRelationDto(), { comboBaseProductId: value }))).toHaveLength(0);
  });
}
test('self-reference is rejected before starting a transaction', async () => {
  const { service } = setup([]);
  await expect(service.setComboBaseProduct(2, 2)).rejects.toBeInstanceOf(BadRequestException);
  expect(service.productRepo.manager.transaction).not.toHaveBeenCalled();
});
