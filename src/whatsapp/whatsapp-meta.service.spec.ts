import { Logger } from '@nestjs/common';
import { WhatsappMetaService } from './whatsapp-meta.service';

describe('WhatsappMetaService delivery statuses', () => {
  const service = new WhatsappMetaService({} as any);
  const payload = (statuses: unknown[]) => ({
    object: 'whatsapp_business_account',
    entry: [{ id: '1', changes: [{ field: 'messages', value: { statuses } }] }],
  });

  afterEach(() => jest.restoreAllMocks());

  it('logs a failed reply with its Meta error and a masked recipient', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const messages = service.parseWebhookPayload(payload([{
      id: 'wamid.ABCDEFGHIJKLMNOP', status: 'failed', recipient_id: '573001234567',
      errors: [{ code: 131042, title: 'Business eligibility payment issue', error_data: { details: 'payment method' } }],
    }]));
    expect(messages).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/status=failed .*131042 Business eligibility payment issue \(payment method\)/));
    expect(warn.mock.calls[0][0]).not.toContain('573001234567');
    expect(warn.mock.calls[0][0]).toContain('4567');
  });

  it('logs a delivered reply without a warning', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    service.parseWebhookPayload(payload([{ id: 'wamid.X', status: 'delivered', recipient_id: '573001234567' }]));
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/status=delivered/));
  });
});
