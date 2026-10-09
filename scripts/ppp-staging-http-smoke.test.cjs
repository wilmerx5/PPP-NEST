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
    if (path === '/api/auth/logout') return reply(200, {}, [
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
