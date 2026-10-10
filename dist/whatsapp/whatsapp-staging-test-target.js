"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stagingTestTargetStatus = stagingTestTargetStatus;
function stagingTestTargetStatus(cfg, target, env = process.env) {
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
        conversationTestVersion: '2026-10-10.cart-v7',
        botEnabled: cfg.enabled === true,
        agentEnabled: cfg.agentV1Enabled === true,
        approvedModel: cfg.openaiModel === 'gpt-4.1-2025-04-14',
        credentialsPresent: !!cfg.accessToken && !!cfg.appSecret && !!cfg.openaiApiKey,
        staffOrderEventsBlocked: staging && env.STAGING_ORDER_EVENTS_ALLOW !== 'true',
        factusSandbox: staging && env.FACTUS_ENV === 'sandbox',
        rateLimitPerMinute: cfg.rateLimitPerMinute,
    };
}
//# sourceMappingURL=whatsapp-staging-test-target.js.map