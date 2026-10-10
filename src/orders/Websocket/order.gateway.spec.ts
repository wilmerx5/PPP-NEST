import { ORDER_STAFF_ROOMS, OrdersGateway } from './order.gateway';

describe('OrdersGateway staging isolation', () => {
  const savedStaging = process.env.PPP_STAGING;
  const savedOrderEvents = process.env.STAGING_ORDER_EVENTS_ALLOW;

  afterEach(() => {
    if (savedStaging === undefined) delete process.env.PPP_STAGING;
    else process.env.PPP_STAGING = savedStaging;
    if (savedOrderEvents === undefined) {
      delete process.env.STAGING_ORDER_EVENTS_ALLOW;
    } else {
      process.env.STAGING_ORDER_EVENTS_ALLOW = savedOrderEvents;
    }
  });

  function harness() {
    const gateway = new OrdersGateway({} as never, {} as never);
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    gateway.server = { to } as never;
    return { gateway, to, emit };
  }

  it('blocks kitchen, orders and tables events by default in staging', () => {
    process.env.PPP_STAGING = 'true';
    delete process.env.STAGING_ORDER_EVENTS_ALLOW;
    const { gateway, to, emit } = harness();

    gateway.emitOrdersUpdates('created_order', { id: 1 });

    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('allows staging staff events only with an explicit opt-in', () => {
    process.env.PPP_STAGING = 'true';
    process.env.STAGING_ORDER_EVENTS_ALLOW = 'true';
    const { gateway, to, emit } = harness();

    gateway.emitOrdersUpdates('created_order', { id: 1 });

    expect(to).toHaveBeenCalledWith([...ORDER_STAFF_ROOMS]);
    expect(emit).toHaveBeenCalledWith('created_order', { id: 1 });
  });

  it('preserves production order events', () => {
    delete process.env.PPP_STAGING;
    delete process.env.STAGING_ORDER_EVENTS_ALLOW;
    const { gateway, to, emit } = harness();

    gateway.emitOrdersUpdates('created_order', { id: 1 });

    expect(to).toHaveBeenCalledWith([...ORDER_STAFF_ROOMS]);
    expect(emit).toHaveBeenCalledWith('created_order', { id: 1 });
  });
});
