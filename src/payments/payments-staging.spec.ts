import { PaymentsService } from './payments.service';

describe('PaymentsService staging credential isolation', () => {
  const previousStaging = process.env.PPP_STAGING;

  afterEach(() => {
    if (previousStaging === undefined) delete process.env.PPP_STAGING;
    else process.env.PPP_STAGING = previousStaging;
  });

  const create = (token?: string) => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'MERCADO_PAGO_ACCESS_TOKEN' ? token : undefined),
    };
    return new PaymentsService(
      {} as never,
      {} as never,
      {} as never,
      config as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    ) as unknown as { client?: unknown };
  };

  it('rejects a non-TEST Mercado Pago credential in staging', () => {
    process.env.PPP_STAGING = 'true';
    expect(create('APP_USR-synthetic-production-token').client).toBeUndefined();
  });

  it('allows a TEST credential in staging', () => {
    process.env.PPP_STAGING = 'true';
    expect(create('TEST-synthetic-sandbox-token').client).toBeDefined();
  });

  it('preserves production credential behavior outside staging', () => {
    delete process.env.PPP_STAGING;
    expect(create('APP_USR-synthetic-production-token').client).toBeDefined();
  });
});
