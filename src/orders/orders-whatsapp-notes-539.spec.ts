import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

function setup() {
  const initial = {
    order: { id: 105, dailyOrderNumber: 105, orderStatus: 'cooking', orderSource: 'whatsapp', clientRequestId: 'wa-1-fixture', createdAt: new Date() },
    items: [{ id: 1, note: 'sin cebolla', unitPrice: 47000 }, { id: 2, note: '', unitPrice: 46000 }],
  };
  let store = structuredClone(initial);
  const manager = { findOne: jest.fn(), find: jest.fn(), update: jest.fn() };
  const service = Object.create(OrdersService.prototype) as any;
  service.dataSource = { transaction: jest.fn(async callback => {
    const staged = structuredClone(store);
    manager.findOne.mockImplementation(async () => staged.order);
    manager.find.mockImplementation(async () => staged.items);
    manager.update.mockImplementation(async (_entity, where, changes) => {
      Object.assign(staged.items.find(item => item.id === where.id)!, changes);
      return { affected: 1 };
    });
    const result = await callback(manager);
    store = staged;
    return result;
  }) };
  service.orderRepo = { findOne: jest.fn(async () => ({ ...store.order, items: store.items })) };
  service.mapOrderToGroupedFormat = jest.fn(async order => order);
  service.gateway = { emitOrdersUpdates: jest.fn() };
  service.logger = { warn: jest.fn() };
  return { service, manager, initial, get store() { return store; } };
}

it('locates the latest recent order created by this WhatsApp conversation', async () => {
  const service = Object.create(OrdersService.prototype) as any;
  const query = { where: jest.fn(), andWhere: jest.fn(), orderBy: jest.fn(), addOrderBy: jest.fn(), take: jest.fn(), getOne: jest.fn().mockResolvedValue({ id: 105 }) };
  for (const name of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'take']) query[name].mockReturnValue(query);
  service.orderRepo = { createQueryBuilder: jest.fn().mockReturnValue(query), findOne: jest.fn().mockResolvedValue({ id: 105 }) };
  await expect(service.getWhatsappOrderForNotes(1, { dailyOrderNumber: 105, createdAt: new Date() })).resolves.toEqual({ id: 105 });
  expect(query.where).toHaveBeenCalledWith('o.clientRequestId LIKE :prefix', { prefix: 'wa-1-%' });
  expect(query.andWhere).toHaveBeenCalledWith('o.orderSource = :source', { source: 'whatsapp' });
  expect(query.addOrderBy).toHaveBeenCalledWith('o.id', 'DESC');
  expect(query.take).toHaveBeenCalledWith(1);
});

it('invalid conversation identities cannot query an order', async () => {
  const service = Object.create(OrdersService.prototype) as any;
  service.orderRepo = { createQueryBuilder: jest.fn() };
  for (const value of [0, -1, Number.NaN]) expect(await service.getWhatsappOrderForNotes(value)).toBeNull();
  expect(service.orderRepo.createQueryBuilder).not.toHaveBeenCalled();
});

it('appends persisted item notes while preserving prices, identities and order state', async () => {
  const h = setup();
  const result = await h.service.appendWhatsappOrderNote(105, 1, [1, 2], 'Incluir platos y cucharas');
  expect(result.changed).toBe(true);
  expect(h.manager.findOne).toHaveBeenCalledWith(Order, { where: { id: 105 }, lock: { mode: 'pessimistic_write' } });
  expect(h.store.order).toEqual(h.initial.order);
  expect(h.store.items).toEqual([
    { ...h.initial.items[0], note: 'sin cebolla; Incluir platos y cucharas' },
    { ...h.initial.items[1], note: 'Incluir platos y cucharas' },
  ]);
  for (const call of h.manager.update.mock.calls) {
    expect(call[0]).toBe(OrderItem);
    expect(Object.keys(call[2])).toEqual(['note']);
  }
  expect(h.service.gateway.emitOrdersUpdates).toHaveBeenCalledTimes(1);
});

it('a repeated note does not write or emit another update', async () => {
  const h = setup();
  await h.service.appendWhatsappOrderNote(105, 1, [1], 'Incluir platos');
  h.manager.update.mockClear();
  h.service.gateway.emitOrdersUpdates.mockClear();
  const result = await h.service.appendWhatsappOrderNote(105, 1, [1], 'Incluir platos');
  expect(result.changed).toBe(false);
  expect(h.manager.update).not.toHaveBeenCalled();
  expect(h.service.gateway.emitOrdersUpdates).not.toHaveBeenCalled();
});

for (const failure of ['conversation', 'source', 'completed', 'canceled', 'old', 'future', 'item', 'length']) {
  it(`rejects an invalid confirmed-note update atomically ${failure}`, async () => {
    const h = setup();
    if (failure === 'conversation') h.store.order.clientRequestId = 'wa-2-fixture';
    if (failure === 'source') h.store.order.orderSource = 'online';
    if (failure === 'completed' || failure === 'canceled') h.store.order.orderStatus = failure;
    if (failure === 'old') h.store.order.createdAt = new Date(Date.now() - 5 * 60 * 60_000);
    if (failure === 'future') h.store.order.createdAt = new Date(Date.now() + 60_000);
    if (failure === 'length') h.store.items[1].note = 'a'.repeat(65530);
    const before = structuredClone(h.store);
    await expect(h.service.appendWhatsappOrderNote(105, 1, failure === 'item' ? [1, 99] : [1, 2], 'Incluir platos')).rejects.toThrow();
    expect(h.store).toEqual(before);
    expect(h.service.gateway.emitOrdersUpdates).not.toHaveBeenCalled();
  });
}

for (const failure of ['refresh', 'notification']) {
  it(`a committed note stays acknowledged when ${failure} fails`, async () => {
    const h = setup();
    if (failure === 'refresh') h.service.orderRepo.findOne.mockRejectedValue(new Error('refresh unavailable'));
    else h.service.gateway.emitOrdersUpdates.mockImplementation(() => { throw new Error('socket unavailable'); });
    await expect(h.service.appendWhatsappOrderNote(105, 1, [1], 'Incluir platos')).resolves.toMatchObject({ changed: true });
    expect(h.store.items[0].note).toContain('Incluir platos');
  });
}
