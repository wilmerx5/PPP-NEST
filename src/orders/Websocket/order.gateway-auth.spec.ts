import { OrdersGateway } from './order.gateway';

describe('order socket authorization', () => {
  const payload = () => ({ id: 'fixture', exp: Math.floor(Date.now() / 1000) + 900 });
  let jwt: any, strategy: any, gateway: OrdersGateway, middleware: any;
  const socket = (cookie = 'access_token=fixture') => ({
    handshake: { headers: { cookie } }, data: {} as any,
    join: jest.fn(), disconnect: jest.fn(),
  });
  beforeEach(() => {
    jwt = { verifyAsync: jest.fn().mockResolvedValue(payload()) };
    strategy = { validate: jest.fn().mockResolvedValue({ isActive: true, roles: ['kitchenUser'] }) };
    gateway = new OrdersGateway(jwt, strategy);
    gateway.afterInit({ use: (fn: any) => { middleware = fn; } } as any);
  });
  it.each(['', 'refresh_token=fixture'])('rejects a connection without an access session (%s)', async cookie => {
    const next = jest.fn(); await middleware(socket(cookie), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error)); expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });
  it('rejects a forged token and inactive or deleted accounts', async () => {
    jwt.verifyAsync.mockRejectedValueOnce(new Error('invalid signature'));
    const next = jest.fn(); await middleware(socket(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    strategy.validate.mockRejectedValueOnce(new Error('inactive'));
    await middleware(socket(), next); expect(next).toHaveBeenLastCalledWith(expect.any(Error));
  });
  it('rejects customer sessions', async () => {
    strategy.validate.mockResolvedValue({ roles: ['user'] });
    const next = jest.fn(); await middleware(socket(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
  it('allows kitchen staff only into kitchen', async () => {
    const client = socket(); const next = jest.fn(); await middleware(client, next);
    expect(next).toHaveBeenCalledWith();
    await gateway.handleJoin(client as any, 'kitchen');
    await gateway.handleJoin(client as any, 'orders');
    await gateway.handleJoin(client as any, 'tables');
    expect(client.join.mock.calls).toEqual([['kitchen']]);
  });
  it('allows admin staff into all supported rooms and rejects arbitrary rooms', async () => {
    strategy.validate.mockResolvedValue({ roles: ['admin'] });
    const client = socket(); await middleware(client, jest.fn());
    for (const room of ['kitchen', 'orders', 'tables', 'arbitrary']) await gateway.handleJoin(client as any, room);
    expect(client.join.mock.calls).toEqual([['kitchen'], ['orders'], ['tables']]);
  });
  it('rechecks account eligibility on room join', async () => {
    const client = socket(); await middleware(client, jest.fn());
    strategy.validate.mockRejectedValueOnce(new Error('disabled'));
    await gateway.handleJoin(client as any, 'kitchen');
    expect(client.disconnect).toHaveBeenCalledWith(true); expect(client.join).not.toHaveBeenCalled();
  });
  it('disconnects when the session expires and clears the expiry timer', async () => {
    jest.useFakeTimers();
    try {
      const client = socket(); await middleware(client, jest.fn());
      gateway.handleConnection(client as any);
      jest.advanceTimersByTime(901000);
      expect(client.disconnect).toHaveBeenCalledWith(true);
      gateway.handleDisconnect(client as any);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });
});
