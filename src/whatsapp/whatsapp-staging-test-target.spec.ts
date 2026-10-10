import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { WhatsappAdminController } from './whatsapp-admin.controller';
import { stagingTestTargetStatus } from './whatsapp-staging-test-target';
import { StagingWhatsappTestTargetDto } from './dto/staging-whatsapp-test-target.dto';

describe('Staging conversation automation isolation', () => {
  const target = { phoneNumberId: '12345', recipient: '573001234567' };
  const env = { PPP_STAGING: 'true', WHATSAPP_STAGING_OUTBOUND_ALLOW: 'true',
    STAGING_WHATSAPP_PHONE_NUMBER_ID: '12345', STAGING_WHATSAPP_RECIPIENTS: '573001234567' };
  const cfg = { enabled: true, agentV1Enabled: true, openaiModel: 'gpt-4.1-2025-04-14',
    phoneNumberId: '12345', accessToken: 'synthetic-token', appSecret: 'synthetic-secret',
    openaiApiKey: 'synthetic-key', rateLimitPerMinute: 25 };
  it('proves the effective channel and single authorized recipient without exposing values', () => {
    const status = stagingTestTargetStatus(cfg, target, env);
    expect(status).toEqual({ staging: true, targetMatches: true, botEnabled: true,
      conversationTestVersion: '2026-10-10.cart-v5',
      agentEnabled: true, approvedModel: true, credentialsPresent: true, rateLimitPerMinute: 25 });
    for (const value of Object.values(target).concat(['synthetic-token', 'synthetic-secret', 'synthetic-key'])) {
      expect(JSON.stringify(status)).not.toContain(value);
    }
  });
  it.each([
    { PPP_STAGING: 'false' }, { WHATSAPP_STAGING_OUTBOUND_ALLOW: 'false' },
    { STAGING_WHATSAPP_PHONE_NUMBER_ID: '54321' }, { STAGING_WHATSAPP_PHONE_NUMBER_ID: '12345 ' },
    { STAGING_WHATSAPP_RECIPIENTS: '573001234567,573009999999' },
    { STAGING_WHATSAPP_RECIPIENTS: '' },
  ])('rejects non-isolated routing %p', patch => {
    expect(stagingTestTargetStatus(cfg, target, { ...env, ...patch }).targetMatches).toBe(false);
  });
  it('checks the resolved DB/environment values rather than the masked DB row', () => {
    expect(stagingTestTargetStatus({ ...cfg, phoneNumberId: '54321' }, target, env).targetMatches).toBe(false);
    expect(stagingTestTargetStatus({ ...cfg, openaiApiKey: null }, target, env).credentialsPresent).toBe(false);
    expect(stagingTestTargetStatus({ ...cfg, openaiModel: 'gpt-4o-mini' }, target, env).approvedModel).toBe(false);
  });
  it('rejects malformed target bodies', async () => {
    const dto = Object.assign(new StagingWhatsappTestTargetDto(), { phoneNumberId: '12345/../messages', recipient: 'anyone' });
    expect(await validate(dto)).toHaveLength(2);
  });
  it('hides the diagnostic endpoint outside staging before touching settings', async () => {
    const previous = process.env.PPP_STAGING;
    process.env.PPP_STAGING = 'false';
    const settings = { getEffectiveConfig: jest.fn() };
    try {
      const controller = new WhatsappAdminController(settings as never, {} as never, {} as never,
        {} as never, {} as never, {} as never, {} as never);
      await expect(controller.verifyStagingTestTarget(target)).rejects.toBeInstanceOf(NotFoundException);
      expect(settings.getEffectiveConfig).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.PPP_STAGING; else process.env.PPP_STAGING = previous;
    }
  });
});
