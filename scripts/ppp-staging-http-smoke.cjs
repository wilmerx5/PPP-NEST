'use strict';

// Fixed staging target. Optional model-only update; no orders, messages or OpenAI calls.
const { createHmac } = require('node:crypto');
const TARGET = 'https://dev.prontopolloportal.com';
const APPROVED_MODEL = 'gpt-4.1-2025-04-14';
const REQUIRED = [
  'STAGING_ADMIN_EMAIL', 'STAGING_ADMIN_PASSWORD', 'STAGING_WHATSAPP_APP_SECRET',
  'STAGING_WHATSAPP_VERIFY_TOKEN', 'STAGING_WHATSAPP_PHONE_NUMBER_ID', 'STAGING_WHATSAPP_RECIPIENTS',
];
class CheckError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const ensure = (condition, code) => { if (!condition) throw new CheckError(code); };

async function runPreflight(env = process.env, fetchImpl = globalThis.fetch) {
  const scope = env.STAGING_HTTP_SCOPE || 'full';
  const report = { target: TARGET, scope: scope === 'staff' ? 'staff' : 'full', checks: [], observations: {}, ok: false };
  const check = async (name, work) => {
    try {
      await work();
      report.checks.push({ name, pass: true });
      return true;
    } catch (error) {
      // Never include error.message, response bodies, cookies, URLs with tokens or credentials.
      report.checks.push({ name, pass: false, code: error instanceof CheckError ? error.code : 'REQUEST_FAILED' });
      return false;
    }
  };
  const eligible = await check('approved_environment_and_required_secrets', async () => {
    ensure(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'wilmerx5/PPP-NEST' &&
      env.GITHUB_REF === 'refs/heads/fix/whatsapp-regression-baseline' &&
      ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'UNAPPROVED_EXECUTION_CONTEXT');
    ensure(env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS_VERIFICATION_REQUIRED');
    ensure(['full', 'staff'].includes(scope), 'INVALID_PROBE_SCOPE');
    ensure(!env.STAGING_CONFIGURE_APPROVED_MODEL ||
      (env.STAGING_CONFIGURE_APPROVED_MODEL === 'true' && scope === 'staff'), 'INVALID_CONFIGURATION_MODE');
    ensure(!env.STAGING_OBSERVE_TEST_CONVERSATION ||
      (env.STAGING_OBSERVE_TEST_CONVERSATION === 'true' && scope === 'staff' &&
       !env.STAGING_CONFIGURE_APPROVED_MODEL), 'INVALID_OBSERVATION_MODE');
    const required = scope === 'staff' ? REQUIRED.filter(key =>
      !['STAGING_WHATSAPP_APP_SECRET', 'STAGING_WHATSAPP_VERIFY_TOKEN'].includes(key)) : REQUIRED;
    const missing = required.filter(key => !env[key]?.trim());
    report.observations.missingSecrets = missing;
    ensure(missing.length === 0, 'REQUIRED_SECRET_MISSING');
    ensure(/^\d{5,30}$/.test(env.STAGING_WHATSAPP_PHONE_NUMBER_ID.trim()), 'INVALID_TEST_CHANNEL_ID');
    const recipients = env.STAGING_WHATSAPP_RECIPIENTS.split(',').map(value => value.replace(/\D/g, ''));
    ensure(recipients.length > 0 && recipients.every(value => /^\d{8,15}$/.test(value)), 'INVALID_TEST_RECIPIENTS');
    report.observations.testRecipientCount = recipients.length;
    ensure(!env.STAGING_OBSERVE_TEST_CONVERSATION || recipients.length === 1, 'SINGLE_TEST_RECIPIENT_REQUIRED');
  });
  if (!eligible) return report;

  const request = async (path, options = {}) => {
    const url = new URL(path, TARGET);
    ensure(url.origin === TARGET && url.pathname.startsWith('/api/'), 'TARGET_NOT_ALLOWED');
    const response = await fetchImpl(url.href, {
      ...options, redirect: 'manual', signal: AbortSignal.timeout(15000),
    });
    ensure(response.status < 300 || response.status >= 400, 'REDIRECT_REJECTED');
    return response;
  };
  const health = await check('https_health_and_database', async () => {
    const response = await request('/api/health');
    ensure(response.status === 200, 'HEALTH_HTTP_FAILED');
    const body = await response.json();
    ensure(body.status === 'ok' && body.db === 'connected', 'DATABASE_NOT_CONNECTED');
  });
  if (!health) return report;

  if (scope === 'full') {
  await check('admin_settings_require_authentication', async () => {
    const response = await request('/api/admin/whatsapp/settings');
    ensure(response.status === 401, 'ADMIN_SETTINGS_UNPROTECTED');
    await response.text();
  });

  // No entry/messages: these probes cannot create conversations or send anything to Meta.
  const emptyPayload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  for (const [name, signature] of [
    ['unsigned_webhook_rejected', undefined],
    ['invalid_signature_rejected', `sha256=${'0'.repeat(64)}`],
    ['valid_signature_accepted', `sha256=${createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET.trim()).update(emptyPayload).digest('hex')}`],
  ]) {
    await check(name, async () => {
      const headers = { 'Content-Type': 'application/json' };
      if (signature) headers['X-Hub-Signature-256'] = signature;
      const response = await request('/api/whatsapp/webhook', { method: 'POST', headers, body: emptyPayload });
      ensure(response.status !== 503, 'META_APP_SECRET_MISSING_ON_SERVER');
      const expected = name === 'valid_signature_accepted' ? 200 : 401;
      ensure(response.status === expected, name === 'valid_signature_accepted' ? 'META_APP_SECRET_MISMATCH_OR_WEBHOOK_FAILED' : 'WEBHOOK_SIGNATURE_NOT_ENFORCED');
      const body = await response.json();
      ensure(name === 'valid_signature_accepted' ? body.ok === true : body.error === 'invalid_signature', 'UNEXPECTED_WEBHOOK_RESPONSE');
    });
  }

  await check('meta_verify_token_and_challenge', async () => {
    const challenge = 'ppp-staging-preflight-challenge';
    const query = new URLSearchParams({ 'hub.mode': 'subscribe',
      'hub.verify_token': env.STAGING_WHATSAPP_VERIFY_TOKEN.trim(), 'hub.challenge': challenge });
    const response = await request(`/api/whatsapp/webhook?${query}`);
    ensure(response.status === 200, 'VERIFY_TOKEN_MISMATCH_OR_NOT_CONFIGURED');
    ensure(await response.text() === challenge, 'INVALID_VERIFY_CHALLENGE');
  });
  }

  let cookie = '';
  await check('test_staff_login_and_secure_cookie', async () => {
    const response = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.STAGING_ADMIN_EMAIL.trim(), password: env.STAGING_ADMIN_PASSWORD }) });
    report.observations.staffLoginHttpStatus = response.status;
    // @Post + @Res uses Nest's default 201 unless the handler overrides it.
    ensure([200, 201].includes(response.status), 'STAGING_STAFF_LOGIN_REJECTED');
    const body = await response.json();
    ensure(body.requires2FA === false, 'STAGING_STAFF_REQUIRES_2FA');
    ensure(Array.isArray(body.user?.roles) && body.user.roles.includes('admin') &&
      body.user.email?.toLowerCase() === env.STAGING_ADMIN_EMAIL.trim().toLowerCase(), 'STAGING_STAFF_NOT_ADMIN');
    const access = response.headers.getSetCookie().find(value => value.startsWith('access_token='));
    ensure(access && /;\s*HttpOnly(?:;|$)/i.test(access) && /;\s*Secure(?:;|$)/i.test(access), 'ACCESS_COOKIE_NOT_SECURE_HTTPONLY');
    const domain = access.match(/;\s*Domain=([^;]+)/i)?.[1]?.toLowerCase().replace(/^\./, '');
    ensure(!domain || domain === 'dev.prontopolloportal.com', 'ACCESS_COOKIE_DOMAIN_NOT_ISOLATED');
    cookie = access.split(';', 1)[0];
  });
  if (cookie) {
    try {
      const settingsOk = await check('authenticated_admin_settings_and_test_channel', async () => {
        const response = await request('/api/admin/whatsapp/settings', { headers: { Cookie: cookie } });
        ensure(response.status === 200, 'STAFF_CANNOT_READ_ADMIN_SETTINGS');
        let settings = await response.json();
        const databasePhone = (settings.phoneNumberId || '').trim();
        report.observations.databasePhoneMatchesTestChannel = databasePhone ? databasePhone === env.STAGING_WHATSAPP_PHONE_NUMBER_ID.trim() : null;
        report.observations.approvedModelConfigured = settings.openaiModel === APPROVED_MODEL;
        report.observations.databaseBotEnabled = settings.enabled === true;
        report.observations.databaseAgentEnabled = settings.agentV1Enabled === true;
        report.observations.databaseOpenaiKeySet = settings.openaiApiKeySet === true;
        report.observations.databaseMetaAccessTokenSet = settings.accessTokenSet === true;
        report.observations.effectiveOutboundChannelVerified = false; // Empty DB field may resolve from env.
        ensure(!databasePhone || databasePhone === env.STAGING_WHATSAPP_PHONE_NUMBER_ID.trim(), 'DATABASE_CHANNEL_DIFFERS_FROM_TEST_CHANNEL');
        if (env.STAGING_CONFIGURE_APPROVED_MODEL === 'true') {
          report.observations.approvedModelUpdated = false;
          if (settings.openaiModel !== APPROVED_MODEL) {
            const previous = settings;
            const updated = await request('/api/admin/whatsapp/settings', {
              method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
              body: JSON.stringify({ openaiModel: APPROVED_MODEL }),
            });
            ensure(updated.status === 200, 'MODEL_UPDATE_FAILED');
            await updated.text();
            const persisted = await request('/api/admin/whatsapp/settings', { headers: { Cookie: cookie } });
            ensure(persisted.status === 200, 'MODEL_READBACK_FAILED');
            settings = await persisted.json();
            ensure(settings.openaiModel === APPROVED_MODEL, 'MODEL_UPDATE_NOT_PERSISTED');
            ensure(['enabled', 'agentV1Enabled', 'phoneNumberId', 'accessTokenSet', 'openaiApiKeySet'].every(
              key => settings[key] === previous[key]), 'UNRELATED_SETTINGS_CHANGED');
            report.observations.approvedModelUpdated = true;
          }
          report.observations.approvedModelConfigured = settings.openaiModel === APPROVED_MODEL;
        }
      });
      if (settingsOk && env.STAGING_OBSERVE_TEST_CONVERSATION === 'true') {
        await check('read_only_test_conversation_observation', async () => {
          const recipient = env.STAGING_WHATSAPP_RECIPIENTS.replace(/\D/g, '');
          const digits = value => typeof value === 'string' ? value.replace(/\D/g, '') : '';
          const listResponse = await request('/api/admin/whatsapp/conversations', { headers: { Cookie: cookie } });
          ensure(listResponse.status === 200, 'CONVERSATION_LIST_FAILED');
          const list = await listResponse.json();
          ensure(Array.isArray(list), 'INVALID_CONVERSATION_LIST');
          const matches = list.filter(row => digits(row.phoneE164) === recipient);
          ensure(matches.length <= 1, 'AMBIGUOUS_TEST_CONVERSATION');
          report.observations.testConversationFound = matches.length === 1;
          // The list contains at most 80 recent conversations; absence is a diagnostic, not readiness.
          report.observations.conversationSearchLimitedToRecent80 = true;
          if (!matches.length) return;
          const id = matches[0].id;
          ensure(Number.isSafeInteger(id) && id > 0, 'INVALID_CONVERSATION_ID');
          const detailResponse = await request(`/api/admin/whatsapp/conversations/${id}`, { headers: { Cookie: cookie } });
          ensure(detailResponse.status === 200, 'CONVERSATION_READ_FAILED');
          const detail = await detailResponse.json();
          ensure(detail.id === id && digits(detail.phoneE164) === recipient &&
            digits(detail.waId) === recipient, 'CONVERSATION_RECIPIENT_MISMATCH');
          ensure(Array.isArray(detail.messages) && typeof detail.humanTakeover === 'boolean', 'INVALID_CONVERSATION_DETAIL');
          const time = value => typeof value === 'string' ? Date.parse(value) : NaN;
          const lastAt = rows => {
            const times = rows.map(row => time(row.createdAt)).filter(Number.isFinite);
            return times.length ? new Date(times.reduce((max, value) => Math.max(max, value), -Infinity)).toISOString() : null;
          };
          const incoming = detail.messages.filter(row => row.direction === 'in');
          const outgoing = detail.messages.filter(row => row.direction === 'out');
          const recent = row => { const age = Date.now() - time(row.createdAt); return age >= 0 && age <= 600000; };
          report.observations.testInboundCount = incoming.length;
          report.observations.testOutboundCount = outgoing.length;
          report.observations.testInboundLast10Minutes = incoming.filter(recent).length;
          report.observations.testOutboundLast10Minutes = outgoing.filter(recent).length;
          report.observations.testLastInboundAt = lastAt(incoming);
          report.observations.testLastOutboundAt = lastAt(outgoing);
          report.observations.testHumanTakeover = detail.humanTakeover;
          report.observations.testCartLines = Array.isArray(detail.sessionData?.cart) ? detail.sessionData.cart.length : 0;
          // Never expose names, phone numbers, message text, session values or private IDs.
        });
      }
    } finally {
      await check('logout_clears_session_cookies', async () => {
        const response = await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
        report.observations.staffLogoutHttpStatus = response.status;
        ensure([200, 201].includes(response.status), 'LOGOUT_FAILED');
        const values = response.headers.getSetCookie();
        ensure(['access_token', 'refresh_token'].every(name => values.some(value =>
          value.startsWith(`${name}=;`) && /Expires=/i.test(value))), 'LOGOUT_COOKIES_NOT_CLEARED');
        await response.text();
      });
      cookie = '';
    }
  }
  report.ok = report.checks.every(result => result.pass);
  return report;
}

module.exports = { runPreflight };
if (require.main === module) {
  runPreflight().then(report => {
    const fs = require('node:fs');
    fs.mkdirSync('tmp', { recursive: true });
    fs.writeFileSync('tmp/ppp-staging-http-smoke.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    process.exitCode = report.ok ? 0 : 1;
  }).catch(() => { console.error('STAGING_PREFLIGHT_FAILED'); process.exitCode = 1; });
}
