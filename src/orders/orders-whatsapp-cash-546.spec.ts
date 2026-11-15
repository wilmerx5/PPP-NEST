import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
function setup() {
  let store = { id: 93, dailyOrderNumber: 93, orderStatus: 'cooking', orderSource: 'whatsapp', clientRequestId: 'wa-1-fixture',
    createdAt: new Date(), address: 'Calle 7 #80-20 / Contraentrega', phone: '3501112233' };
  const manager = {findOne:jest.fn(),update:jest.fn()};
  const service = Object.create(OrdersService.prototype) as any;
  service.dataSource = { transaction: async callback => {
    const staged = structuredClone(store);
    manager.findOne.mockResolvedValue(staged);
    manager.update.mockImplementation(async (_entity,_where,changes) => {Object.assign(staged,changes);return {affected:1};});
    const result = await callback(manager);store=staged;return result;
  }};
  service.orderRepo={findOne:jest.fn(async()=>store)};
  service.mapOrderToGroupedFormat=jest.fn(async value=>value);
  service.gateway={emitOrdersUpdates:jest.fn()};service.logger={warn:jest.fn()};
  return {service,manager,get store(){return store;}};
}
it('persists cash change in the owned order and keeps contact and order status',async()=>{
  const h=setup();const before=structuredClone(h.store);
  expect(await h.service.setWhatsappCashChange(93,1,'Pago con un billete de 100mil')).toMatchObject({orderId:93,changed:true});
  expect(h.manager.findOne).toHaveBeenCalledWith(Order,{where:{id:93},lock:{mode:'pessimistic_write'}});
  expect(h.store).toEqual({...before,address:before.address+' / Cambio para pago: Pago con un billete de 100mil'});
  expect(h.service.gateway.emitOrdersUpdates).toHaveBeenCalledTimes(1);
});
it('repeated instructions are idempotent and a correction replaces the previous amount',async()=>{
  const h=setup();await h.service.setWhatsappCashChange(93,1,'cambio de 100mil');
  h.manager.update.mockClear();h.service.gateway.emitOrdersUpdates.mockClear();
  expect((await h.service.setWhatsappCashChange(93,1,'cambio de 100mil')).changed).toBe(false);
  expect(h.manager.update).not.toHaveBeenCalled();expect(h.service.gateway.emitOrdersUpdates).not.toHaveBeenCalled();
  await h.service.setWhatsappCashChange(93,1,'cambio de 50mil');
  expect(h.store.address).toContain('50mil');expect(h.store.address).not.toContain('100mil');
});
for(const failure of ['conversation','source','completed','canceled','old','future','transfer','length']) it(`rejects a cash update atomically ${failure}`,async()=>{
  const h=setup();
  if(failure==='conversation')h.store.clientRequestId='wa-2-other';
  if(failure==='source')h.store.orderSource='online';
  if(['completed','canceled'].includes(failure))h.store.orderStatus=failure;
  if(failure==='old')h.store.createdAt=new Date(Date.now()-5*60*60_000);
  if(failure==='future')h.store.createdAt=new Date(Date.now()+60_000);
  if(failure==='transfer')h.store.address='Calle 7 #80-20 / Transferencia';
  if(failure==='length')h.store.address='a'.repeat(490);
  const before=structuredClone(h.store);
  await expect(h.service.setWhatsappCashChange(93,1,'cambio de 100mil')).rejects.toThrow();
  expect(h.store).toEqual(before);expect(h.service.gateway.emitOrdersUpdates).not.toHaveBeenCalled();
});
it('a committed cash instruction survives a socket notification failure',async()=>{
  const h=setup();h.service.gateway.emitOrdersUpdates.mockImplementation(()=>{throw Error('socket unavailable');});
  await expect(h.service.setWhatsappCashChange(93,1,'cambio de 100mil')).resolves.toMatchObject({changed:true});
  expect(h.store.address).toContain('100mil');
});
