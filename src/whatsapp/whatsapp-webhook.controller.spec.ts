import { createHmac } from 'crypto';
import { Logger } from '@nestjs/common';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

describe('WhatsApp webhook authentication before processing', () => {
  const secret = 'synthetic-meta-app-secret';
  const payload = { object: 'whatsapp_business_account', entry: [] };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = (raw = rawBody) =>
    `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  let controller: WhatsappWebhookController;
  let settings: { getEffectiveConfig: jest.Mock };
  let meta: { parseWebhookPayload: jest.Mock };
  let orchestrator: { handleIncoming: jest.Mock; registerIncomingBatch: jest.Mock };
  let rateLimit: { allow: jest.Mock };
  let conversations: { findByWaMessageId: jest.Mock };
  let response: { status: jest.Mock; json: jest.Mock };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    settings = { getEffectiveConfig: jest.fn().mockResolvedValue({ appSecret: secret }) };
    meta = { parseWebhookPayload: jest.fn().mockReturnValue([]) };
    orchestrator = { handleIncoming: jest.fn().mockResolvedValue(undefined),registerIncomingBatch:jest.fn() };
    rateLimit = { allow: jest.fn().mockReturnValue(true) };
    conversations = { findByWaMessageId: jest.fn().mockResolvedValue(null) };
    controller = new WhatsappWebhookController(
      settings as any, meta as any, orchestrator as any,
      rateLimit as any, conversations as any,
    );
    response = { status: jest.fn(), json: jest.fn() };
    response.status.mockReturnValue(response);
  });

  afterEach(() => jest.restoreAllMocks());

  async function rejected(header: string | undefined, status: number, error: string, raw: Buffer | undefined = rawBody) {
    await controller.receive({ body: payload, rawBody: raw } as any, header, response as any);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ ok: false, error });
    expect(meta.parseWebhookPayload).not.toHaveBeenCalled();
    expect(conversations.findByWaMessageId).not.toHaveBeenCalled();
    expect(orchestrator.handleIncoming).not.toHaveBeenCalled();
  }

  it('rejects even a well-formed signature when no effective App Secret is configured', async () => {
    settings.getEffectiveConfig.mockResolvedValue({ appSecret: '  ' });
    await rejected(signature(), 503, 'app_secret_missing');
  });

  it('rejects a missing signature before parsing any messages', async () => {
    await rejected(undefined, 401, 'invalid_signature');
  });

  it('rejects a forged signature before processing', async () => {
    await rejected(`sha256=${'0'.repeat(64)}`, 401, 'invalid_signature');
  });

  it('rejects a signature for a different raw payload', async () => {
    await rejected(signature(Buffer.from('{}')), 401, 'invalid_signature');
  });

  it('rejects requests without the original raw body', async () => {
    await controller.receive({ body: payload } as any, signature(), response as any);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ ok: false, error: 'raw_body_missing' });
    expect(meta.parseWebhookPayload).not.toHaveBeenCalled();
    expect(orchestrator.handleIncoming).not.toHaveBeenCalled();
  });

  it('passes a correctly signed request to the existing processing pipeline', async () => {
    const message = { messageId: 'synthetic-wamid', waId: 'synthetic-waid', text: 'hola' };
    meta.parseWebhookPayload.mockReturnValue([message]);
    await controller.receive({ body: payload, rawBody } as any, signature(), response as any);
    expect(meta.parseWebhookPayload).toHaveBeenCalledWith(payload);
    expect(orchestrator.registerIncomingBatch).toHaveBeenCalledWith([message]);
    expect(orchestrator.registerIncomingBatch.mock.invocationCallOrder[0]).toBeLessThan(orchestrator.handleIncoming.mock.invocationCallOrder[0]);
    expect(orchestrator.handleIncoming).toHaveBeenCalledTimes(1);
    expect(orchestrator.handleIncoming).toHaveBeenCalledWith(message);
  });

  it('encola las burbujas del mismo aviso antes de esperar la primera', async () => {
    const messages = [1, 2, 3].map((n) => ({ messageId: `wamid.${n}`, waId: 'synthetic-waid', text: `parte ${n}` }));
    meta.parseWebhookPayload.mockReturnValue(messages);
    let inFlight = 0;
    let maxInFlight = 0;
    orchestrator.handleIncoming.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
    });
    await controller.receive({ body: payload, rawBody } as any, signature(), response as any);
    expect(maxInFlight).toBe(3);
    expect(orchestrator.handleIncoming).toHaveBeenCalledTimes(3);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });
});
