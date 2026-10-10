'use strict';

const { createHmac, randomUUID } = require('node:crypto');
const TARGET = 'https://dev.prontopolloportal.com';
const digits = value => String(value || '').replace(/\D/g, '');
class CheckError extends Error { constructor(code) { super(code); this.code = code; } }
const ensure = (ok, code) => { if (!ok) throw new CheckError(code); };

const STEPS = [
  { id: 'reset-start', text: 'Reiniciar' },
  { id: 'limonada', text: 'Una limonada natural' },
  { id: 'finish-items', text: 'No más' },
  { id: 'pickup', text: 'Paso a recoger' },
  { id: 'mercado-pago', text: 'Mercado Pago' },
  { id: 'reset-end', text: 'Reiniciar' },
];

async function runRehearsal(env = process.env, fetchImpl = globalThis.fetch, helpers = {}) {
  const now = helpers.now || Date.now;
  const sleep = helpers.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const report = {
    ok: false, mode: env.STAGING_MP_EXECUTE === 'true' ? 'execute' : 'preflight',
    checks: [], steps: [], webhookPosts: 0,
    limits: 'Creates a Mercado Pago sandbox preference only. Does not pay, confirm or keep an order.',
  };
  let cookie = '', requests = 0, startedAt = now(), recipient, channel, conversationId, rateLimit = 20, current;
  const check = async (name, work) => {
    try { await work(); report.checks.push({ name, pass: true }); return true; }
    catch (error) { report.checks.push({ name, pass: false, code: error instanceof CheckError ? error.code : 'REQUEST_FAILED' }); return false; }
  };
  const request = async (path, options = {}) => {
    const url = new URL(path, TARGET);
    ensure(url.origin === TARGET && url.pathname.startsWith('/api/'), 'TARGET_NOT_ALLOWED');
    ensure(++requests <= 80 && now() - startedAt < 600000, 'HTTP_OR_TIME_BUDGET_EXCEEDED');
    return fetchImpl(url.href, { ...options, redirect: 'manual', signal: AbortSignal.timeout(60000) });
  };
  const admin = (path, options = {}) => request(path, { ...options, headers: { ...options.headers, Cookie: cookie } });
  const detail = async () => {
    const response = await admin(`/api/admin/whatsapp/conversations/${conversationId}`);
    ensure(response.status === 200, 'CONVERSATION_READ_FAILED');
    return response.json();
  };
  try {
    if (!await check('authorized_context', async () => {
      ensure(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'wilmerx5/PPP-NEST' &&
        env.GITHUB_REF === 'refs/heads/fix/whatsapp-checkout-flow-20261010', 'UNAPPROVED_EXECUTION_CONTEXT');
      ensure(['STAGING_ADMIN_EMAIL', 'STAGING_ADMIN_PASSWORD', 'STAGING_WHATSAPP_APP_SECRET',
        'STAGING_WHATSAPP_PHONE_NUMBER_ID', 'STAGING_WHATSAPP_RECIPIENTS'].every(key => env[key]?.trim()), 'REQUIRED_SECRET_MISSING');
      recipient = env.STAGING_WHATSAPP_RECIPIENTS.split(',').map(digits)[0];
      channel = env.STAGING_WHATSAPP_PHONE_NUMBER_ID.trim();
    })) return report;
    if (!await check('health_database', async () => {
      const response = await request('/api/health');
      ensure(response.status === 200, 'HEALTH_HTTP_FAILED');
    })) return report;
    if (!await check('staging_admin_login', async () => {
      const response = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: env.STAGING_ADMIN_EMAIL.trim(), password: env.STAGING_ADMIN_PASSWORD }) });
      const body = await response.json();
      const access = response.headers.getSetCookie().find(value => value.startsWith('access_token='));
      if (access) cookie = access.split(';', 1)[0];
      ensure([200, 201].includes(response.status) && body.user?.roles?.includes('admin'), 'LOGIN_REJECTED');
    })) return report;
    if (!await check('effective_staging_target', async () => {
      const response = await admin('/api/admin/whatsapp/staging/test-target', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId: channel, recipient }) });
      const body = await response.json();
      ensure(body.staging === true && body.targetMatches === true, 'TEST_CHANNEL_OR_RECIPIENT_MISMATCH');
      rateLimit = body.rateLimitPerMinute || 20;
    })) return report;
    const list = await admin('/api/admin/whatsapp/conversations');
    const matches = (await list.json()).filter(row => digits(row.phoneE164) === recipient);
    ensure(matches.length === 1, 'TEST_CONVERSATION_MISSING_OR_AMBIGUOUS');
    conversationId = matches[0].id;
    current = await detail();
    if (report.mode === 'preflight') { report.ok = true; return report; }

    const sign = payload => `sha256=${createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET.trim()).update(payload).digest('hex')}`;
    const runId = randomUUID();
    let lastSent = 0;
    for (const step of STEPS) {
      report.activeStep = step.id;
      const wait = Math.max(0, 60000 / rateLimit + 1000 - (now() - lastSent));
      if (wait) await sleep(wait);
      const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp', metadata: { phone_number_id: channel }, messages: [{ from: recipient,
          id: `wamid.ppp-mp-${runId}-${step.id}`, timestamp: String(Math.floor(now() / 1000)), type: 'text', text: { body: step.text } }] } }] }] });
      lastSent = now();
      report.webhookPosts++;
      const response = await request('/api/whatsapp/webhook', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(payload) }, body: payload });
      ensure(response.status === 200, 'WEBHOOK_HTTP_FAILED_NO_RETRY');
      current = await detail();
      if (step.id.startsWith('reset')) {
        ensure(current.state === 'building_cart' && (current.sessionData.cart || []).length === 0, 'RESET_LEFT_DRAFT');
        ensure(!current.sessionData.mpPreferenceId, 'RESET_LEFT_MP_PREFERENCE');
      }
      if (step.id === 'mercado-pago') {
        ensure(current.sessionData.paymentMethod === 'mercadopago' || current.sessionData.paymentMethod === 'mercado pago', 'MP_METHOD_NOT_SELECTED');
        ensure(!!current.sessionData.mpPreferenceId, 'SANDBOX_PREFERENCE_NOT_CREATED');
        ensure(current.state === 'awaiting_mp_payment' || current.state === 'awaiting_final_confirm', 'MP_STATE_UNEXPECTED');
        report.preferenceCreated = true;
      }
      report.steps.push({ id: step.id, pass: true, state: current.state });
    }
    delete report.activeStep;
    report.ok = report.steps.length === STEPS.length;
  } catch (error) {
    report.checks.push({ name: 'mp_sandbox_rehearsal', pass: false, code: error instanceof CheckError ? error.code : 'EXECUTION_FAILED_NO_RETRY' });
  } finally {
    if (cookie) await admin('/api/auth/logout', { method: 'POST' });
  }
  return report;
}

module.exports = { runRehearsal, STEPS };
if (require.main === module) {
  runRehearsal().then(report => {
    const fs = require('node:fs');
    fs.mkdirSync('tmp', { recursive: true });
    fs.writeFileSync('tmp/ppp-staging-mp-report.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: report.ok, mode: report.mode, preferenceCreated: report.preferenceCreated, checks: report.checks, activeStep: report.activeStep }));
    process.exitCode = report.ok ? 0 : 1;
  }).catch(() => { process.exitCode = 1; });
}
