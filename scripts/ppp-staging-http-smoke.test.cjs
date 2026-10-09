const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { runPreflight } = require('./ppp-staging-http-smoke.cjs');
const fixture = () => ({
  GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'wilmerx5/PPP-NEST',
  GITHUB_REF: 'refs/heads/fix/whatsapp-regression-baseline', GITHUB_EVENT_NAME: 'push',
  STAGING_ADMIN_EMAIL: 'qa@example.invalid', STAGING_ADMIN_PASSWORD: 'synthetic-password',
  STAGING_WHATSAPP_APP_SECRET: 'synthetic-app-secret', STAGING_WHATSAPP_VERIFY_TOKEN: 'synthetic-verify-token',
  STAGING_WHATSAPP_PHONE_NUMBER_ID: '12345678', STAGING_WHATSAPP_RECIPIENTS: '573001234567',
});
const reply = (status, body, headers) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
function fixtureFetch(env, override = () => undefined) {
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    assert.equal(new URL(url).origin, 'https://dev.prontopolloportal.com');
    assert.equal(options.redirect, 'manual');
    const altered = override(url, options);
    if (altered) return altered;
    const path = new URL(url).pathname;
    if (path === '/api/health') return reply(200, { status: 'ok', db: 'connected' });
    if (path === '/api/admin/whatsapp/settings') {
      if (!options.headers?.Cookie) return reply(401, {});
      assert.equal(options.headers.Cookie, 'access_token=synthetic-session');
      return reply(200, { phoneNumberId: env.STAGING_WHATSAPP_PHONE_NUMBER_ID, openaiModel: 'gpt-4.1-2025-04-14' });
    }
    if (path === '/api/whatsapp/webhook' && options.method === 'POST') {
      assert.deepEqual(JSON.parse(options.body).entry, []);
      const signature = `sha256=${createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET).update(options.body).digest('hex')}`;
      return options.headers['X-Hub-Signature-256'] === signature ? reply(200, { ok: true }) : reply(401, { ok: false, error: 'invalid_signature' });
    }
    if (path === '/api/whatsapp/webhook') {
      assert.equal(new URL(url).searchParams.get('hub.verify_token'), env.STAGING_WHATSAPP_VERIFY_TOKEN);
      return reply(200, 'ppp-staging-preflight-challenge');
    }
    if (path === '/api/auth/login') return reply(201, { requires2FA: false, user: { roles: ['admin'], email: env.STAGING_ADMIN_EMAIL } }, {
      'Set-Cookie': 'access_token=synthetic-session; Path=/; HttpOnly; Secure; SameSite=Lax',
    });
    if (path === '/api/auth/logout') return reply(201, {}, [
      ['Set-Cookie', 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'],
      ['Set-Cookie', 'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'],
    ]);
    throw Error('Unexpected request');
  };
  return { fetch, requests };
}

test('rejects missing secrets and unapproved contexts without any network calls', async () => {
  for (const patch of [{ STAGING_ADMIN_PASSWORD: '' }, { GITHUB_REF: 'refs/heads/Main' }, { GITHUB_EVENT_NAME: 'pull_request' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' }]) {
    const env = { ...fixture(), ...patch };
    const f = fixtureFetch(env);
    assert.equal((await runPreflight(env, f.fetch)).ok, false);
    assert.equal(f.requests.length, 0);
  }
});
test('checks signatures, admin cookies and logout without orders or sensitive report content', async () => {
  const env = fixture(), f = fixtureFetch(env);
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 10);
  assert.equal(result.observations.approvedModelConfigured, true);
  assert.equal(result.observations.staffLoginHttpStatus, 201);
  assert.equal(result.observations.staffLogoutHttpStatus, 201);
  const serialized = JSON.stringify(result);
  for (const secret of Object.values(env).filter(value => /synthetic|qa@|57300|12345678/.test(value))) assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('synthetic-session'), false);
  assert.equal(f.requests.some(r => /orders|conversations|graph.facebook/.test(r.url)), false);
});
test('never follows a login redirect carrying credentials to another host', async () => {
  const env = fixture(), f = fixtureFetch(env, url => url.endsWith('/api/auth/login') ? reply(302, '', { Location: 'https://example.invalid' }) : undefined);
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(c => c.name === 'test_staff_login_and_secure_cookie').code, 'REDIRECT_REJECTED');
  assert.equal(f.requests.some(r => r.url.startsWith('https://example.invalid')), false);
});
test('reports mismatch of the actual stored channel without exposing either ID', async () => {
  const env = fixture(), f = fixtureFetch(env, (url, options) => url.endsWith('/api/admin/whatsapp/settings') && options.headers?.Cookie ? reply(200, { phoneNumberId: '87654321' }) : undefined);
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes('87654321'), false);
  assert.equal(result.checks.at(-1).name, 'logout_clears_session_cookies');
  assert.equal(result.checks.at(-1).pass, true);
});
test('rejects unsafe shared cookies and never uses them to read admin settings', async () => {
  const env = fixture(), f = fixtureFetch(env, url => url.endsWith('/api/auth/login') ? reply(200, { requires2FA: false, user: { roles: ['admin'], email: env.STAGING_ADMIN_EMAIL } }, {
    'Set-Cookie': 'access_token=synthetic-session; HttpOnly; Secure; Domain=.prontopolloportal.com',
  }) : undefined);
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, false);
  assert.equal(f.requests.some(r => r.url.endsWith('/settings') && r.options.headers?.Cookie), false);
});
test('does not expose credentials in unexpected network errors', async () => {
  const env = fixture();
  const result = await runPreflight(env, async () => { throw Error(Object.values(env).join(' ')); });
  assert.equal(result.ok, false);
  assert.equal(result.checks.at(-1).code, 'REQUEST_FAILED');
  assert.equal(JSON.stringify(result).includes('synthetic'), false);
});
test('can check staff alone without repeating successful Meta probes', async () => {
  const env = { ...fixture(), STAGING_HTTP_SCOPE: 'staff' };
  delete env.STAGING_WHATSAPP_APP_SECRET;
  delete env.STAGING_WHATSAPP_VERIFY_TOKEN;
  const f = fixtureFetch(env);
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 5);
  assert.equal(f.requests.some(r => r.url.includes('/whatsapp/webhook')), false);
});
test('a real unauthorized login fails and reports only its status code', async () => {
  const env = { ...fixture(), STAGING_HTTP_SCOPE: 'staff' }, f = fixtureFetch(env, url => url.endsWith('/api/auth/login') ? reply(401, { message: 'private account detail' }) : undefined);
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, false);
  assert.equal(result.observations.staffLoginHttpStatus, 401);
  assert.equal(JSON.stringify(result).includes('private account detail'), false);
  assert.equal(f.requests.some(r => r.options.headers?.Cookie), false);
});


test('updates only the approved staging model and verifies persistence before logout', async () => {
  const env = { ...fixture(), STAGING_HTTP_SCOPE: 'staff', STAGING_CONFIGURE_APPROVED_MODEL: 'true' };
  let model = 'gpt-4o-mini';
  const f = fixtureFetch(env, (url, options) => {
    if (!url.endsWith('/api/admin/whatsapp/settings') || !options.headers?.Cookie) return;
    if (options.method === 'PATCH') {
      assert.deepEqual(JSON.parse(options.body), { openaiModel: 'gpt-4.1-2025-04-14' });
      model = JSON.parse(options.body).openaiModel;
    }
    return reply(200, { openaiModel: model, phoneNumberId: null, enabled: false,
      agentV1Enabled: false, accessTokenSet: false, openaiApiKeySet: false });
  });
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, true);
  assert.equal(result.observations.approvedModelUpdated, true);
  assert.equal(result.observations.approvedModelConfigured, true);
  assert.equal(f.requests.filter(r => r.options.method === 'PATCH').length, 1);
  assert.equal(f.requests.at(-1).url.endsWith('/api/auth/logout'), true);
});
test('approved model updates are opt-in and idempotent', async () => {
  for (const patch of [{}, { STAGING_CONFIGURE_APPROVED_MODEL: 'true' }]) {
    const env = { ...fixture(), STAGING_HTTP_SCOPE: 'staff', ...patch };
    const f = fixtureFetch(env);
    assert.equal((await runPreflight(env, f.fetch)).ok, true);
    assert.equal(f.requests.some(r => r.options.method === 'PATCH'), false);
  }
});
test('refuses configuration outside the selective staff scope before any network request', async () => {
  for (const patch of [{ STAGING_CONFIGURE_APPROVED_MODEL: 'true' },
    { STAGING_HTTP_SCOPE: 'staff', STAGING_CONFIGURE_APPROVED_MODEL: 'yes' }]) {
    const env = { ...fixture(), ...patch }, f = fixtureFetch(env);
    assert.equal((await runPreflight(env, f.fetch)).ok, false);
    assert.equal(f.requests.length, 0);
  }
});
test('does not update the model if the database points to a different channel', async () => {
  const env = { ...fixture(), STAGING_HTTP_SCOPE: 'staff', STAGING_CONFIGURE_APPROVED_MODEL: 'true' };
  const f = fixtureFetch(env, (url, options) => url.endsWith('/settings') && options.headers?.Cookie ?
    reply(200, { phoneNumberId: '87654321', openaiModel: 'gpt-4o-mini' }) : undefined);
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, false);
  assert.equal(f.requests.some(r => r.options.method === 'PATCH'), false);
  assert.equal(result.checks.at(-1).pass, true);
});
test('a failed model readback still clears session cookies', async () => {
  const env = { ...fixture(), STAGING_HTTP_SCOPE: 'staff', STAGING_CONFIGURE_APPROVED_MODEL: 'true' };
  const f = fixtureFetch(env, (url, options) => url.endsWith('/settings') && options.headers?.Cookie ?
    reply(200, { phoneNumberId: null, openaiModel: 'gpt-4o-mini' }) : undefined);
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(c => c.name === 'authenticated_admin_settings_and_test_channel').code, 'MODEL_UPDATE_NOT_PERSISTED');
  assert.equal(result.checks.at(-1).pass, true);
});
test('a rejected logout fails even when the response has clearing cookies', async () => {
  const env = { ...fixture(), STAGING_HTTP_SCOPE: 'staff' };
  const f = fixtureFetch(env, url => url.endsWith('/api/auth/logout') ? reply(401, {}, [
    ['Set-Cookie', 'access_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT'],
    ['Set-Cookie', 'refresh_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT'],
  ]) : undefined);
  assert.equal((await runPreflight(env, f.fetch)).checks.at(-1).code, 'LOGOUT_FAILED');
});


const observationEnv = () => ({ ...fixture(), STAGING_HTTP_SCOPE: 'staff', STAGING_OBSERVE_TEST_CONVERSATION: 'true' });
const observationFetch = (env, list, detail) => fixtureFetch(env, (url, options) => {
  if (url.endsWith('/api/admin/whatsapp/conversations')) return reply(200, list);
  if (url.endsWith('/api/admin/whatsapp/conversations/42')) return reply(200, detail);
});
test('observes only the exact test recipient and never exposes private history', async () => {
  const env = observationEnv();
  const now = new Date().toISOString();
  const other = '573009999999';
  const f = observationFetch(env, [{ id: 41, phoneE164: other },
    { id: 42, phoneE164: '+' + env.STAGING_WHATSAPP_RECIPIENTS }], {
    id: 42, phoneE164: '+' + env.STAGING_WHATSAPP_RECIPIENTS,
    waId: env.STAGING_WHATSAPP_RECIPIENTS, humanTakeover: true,
    customerName: 'Private customer', sessionData: { cart: [{ privateNote: 'Private note' }] },
    messages: [{ direction: 'in', createdAt: now, body: 'Private request' },
      { direction: 'out', createdAt: now, body: 'Private response' }],
  });
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 6);
  assert.equal(result.observations.testConversationFound, true);
  assert.equal(result.observations.testInboundLast10Minutes, 1);
  assert.equal(result.observations.testOutboundLast10Minutes, 1);
  assert.equal(result.observations.testHumanTakeover, true);
  assert.equal(result.observations.testCartLines, 1);
  assert.equal(f.requests.some(r => r.url.endsWith('/41')), false);
  assert.equal(f.requests.some(r => /webhook/.test(r.url) || r.options.method === 'PATCH'), false);
  for (const secret of [other, env.STAGING_WHATSAPP_RECIPIENTS, 'Private', 'synthetic-session']) {
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});
test('reports a missing recipient in the recent list without reading someone else', async () => {
  const env = observationEnv(), f = observationFetch(env, [{ id: 41, phoneE164: '573009999999' }], {});
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, true);
  assert.equal(result.observations.testConversationFound, false);
  assert.equal(result.observations.conversationSearchLimitedToRecent80, true);
  assert.equal(f.requests.some(r => /conversations\//.test(r.url)), false);
});
test('read-only observation rejects multiple recipients and configuration mode before networking', async () => {
  for (const patch of [{ STAGING_WHATSAPP_RECIPIENTS: '573001234567,573009999999' },
    { STAGING_CONFIGURE_APPROVED_MODEL: 'true' }, { STAGING_HTTP_SCOPE: 'full' },
    { STAGING_OBSERVE_TEST_CONVERSATION: 'yes' }]) {
    const env = { ...observationEnv(), ...patch }, f = fixtureFetch(env);
    assert.equal((await runPreflight(env, f.fetch)).ok, false);
    assert.equal(f.requests.length, 0);
  }
});
test('a mismatched conversation detail stops observation and still logs out', async () => {
  const env = observationEnv(), f = observationFetch(env, [{ id: 42, phoneE164: env.STAGING_WHATSAPP_RECIPIENTS }], {
    id: 42, phoneE164: '573009999999', waId: '573009999999', messages: [], humanTakeover: false,
  });
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(c => c.name === 'read_only_test_conversation_observation').code, 'CONVERSATION_RECIPIENT_MISMATCH');
  assert.equal(result.checks.at(-1).pass, true);
  assert.equal(JSON.stringify(result).includes('573009999999'), false);
});
test('observation refuses ambiguous histories and unsafe detail IDs', async () => {
  const env = observationEnv();
  for (const list of [[{ id: 42, phoneE164: env.STAGING_WHATSAPP_RECIPIENTS },
    { id: 43, phoneE164: env.STAGING_WHATSAPP_RECIPIENTS }],
    [{ id: '../settings', phoneE164: env.STAGING_WHATSAPP_RECIPIENTS }]]) {
    const f = observationFetch(env, list, {});
    const result = await runPreflight(env, f.fetch);
    assert.equal(result.ok, false);
    assert.equal(f.requests.some(r => /conversations\//.test(r.url)), false);
    assert.equal(result.checks.at(-1).pass, true);
  }
});
test('ignores invalid timestamps and does not count old messages as recent', async () => {
  const env = observationEnv(), f = observationFetch(env, [{ id: 42, phoneE164: env.STAGING_WHATSAPP_RECIPIENTS }], {
    id: 42, phoneE164: env.STAGING_WHATSAPP_RECIPIENTS, waId: env.STAGING_WHATSAPP_RECIPIENTS,
    humanTakeover: false, messages: [{ direction: 'in', createdAt: '2000-01-01T00:00:00Z' },
      { direction: 'out', createdAt: 'Private invalid timestamp' }],
  });
  const result = await runPreflight(env, f.fetch);
  assert.equal(result.ok, true);
  assert.equal(result.observations.testInboundLast10Minutes, 0);
  assert.equal(result.observations.testLastOutboundAt, null);
  assert.equal(JSON.stringify(result).includes('Private'), false);
});
