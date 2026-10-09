type EffectiveTestConfig = {
  enabled: boolean;
  agentV1Enabled: boolean;
  openaiModel: string;
  phoneNumberId: string | null;
  accessToken: string | null;
  appSecret: string | null;
  openaiApiKey: string | null;
  rateLimitPerMinute: number;
};

/** Read-only proof of the effective channel; never return credentials or identifiers. */
export function stagingTestTargetStatus(
  cfg: EffectiveTestConfig,
  target: { phoneNumberId: string; recipient: string },
  env: NodeJS.ProcessEnv = process.env,
) {
  const recipients = (env.STAGING_WHATSAPP_RECIPIENTS || '').split(',')
    .map(value => value.replace(/\D/g, ''));
  const staging = env.PPP_STAGING === 'true';
  const targetMatches = staging && env.WHATSAPP_STAGING_OUTBOUND_ALLOW === 'true' &&
    /^\d{5,30}$/.test(target.phoneNumberId) && /^\d{8,15}$/.test(target.recipient) &&
    cfg.phoneNumberId === target.phoneNumberId &&
    cfg.phoneNumberId === env.STAGING_WHATSAPP_PHONE_NUMBER_ID &&
    recipients.length === 1 && recipients[0] === target.recipient;
  return {
    staging, targetMatches,
    botEnabled: cfg.enabled === true,
    agentEnabled: cfg.agentV1Enabled === true,
    approvedModel: cfg.openaiModel === 'gpt-4.1-2025-04-14',
    credentialsPresent: !!cfg.accessToken && !!cfg.appSecret && !!cfg.openaiApiKey,
    rateLimitPerMinute: cfg.rateLimitPerMinute,
  };
}
