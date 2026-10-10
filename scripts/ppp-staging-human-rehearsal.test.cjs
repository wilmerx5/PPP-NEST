'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { runRehearsal, STEPS } = require('./ppp-staging-human-rehearsal.cjs');

const env = {
  GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'wilmerx5/PPP-NEST',
  GITHUB_REF: 'refs/heads/fix/whatsapp-regression-baseline', GITHUB_EVENT_NAME: 'workflow_dispatch',
  STAGING_HUMAN_EXECUTE: 'true', STAGING_ADMIN_EMAIL: 'automation@example.invalid',
  STAGING_ADMIN_PASSWORD: 'synthetic-password', STAGING_WHATSAPP_APP_SECRET: 'synthetic-app-secret',
  STAGING_WHATSAPP_PHONE_NUMBER_ID: '12345', STAGING_WHATSAPP_RECIPIENTS: '573001234567',
};
const products = [
  { id: 60, name: 'Costillas De Cerdo', availableNow: true },
  { id: 14, name: 'Mojarra', availableNow: true },
  { id: 17, name: 'Churrasco', availableNow: true },
];

test('the live plan never confirms an order', () => {
  assert.equal(STEPS.some(step => /^confirmar$/i.test(step.text.trim())), false);
  assert.ok(STEPS.some(step => step.id === 'change-address'));
  assert.ok(STEPS.some(step => step.id === 'correct-quantity'));
});

function fixture(options = {}) {
  const calls = [];
  const conversation = {
    id: 42, waId: env.STAGING_WHATSAPP_RECIPIENTS, phoneE164: '+' + env.STAGING_WHATSAPP_RECIPIENTS,
    humanTakeover: false, state: 'building_cart', customerName: options.unnamed ? null : 'Wilmer',
    sessionData: { cart: [] },
    messages: [{ id: 1, direction: 'in', body: 'Hola', sentBy: 'customer' }],
  };
  let nextId = 2, orderReads = 0;
  const json = (body, status = 200, cookie) => {
    const response = new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (cookie) response.headers.append('Set-Cookie', cookie);
    return response;
  };
  const fetch = async (url, opts = {}) => {
    calls.push(url);
    const path = new URL(url).pathname;
    if (path === '/api/health') return json({ status: 'ok', db: 'connected' });
    if (path === '/api/auth/login') return json({ requires2FA: false, user: { roles: ['admin'] } }, 201,
      'access_token=synthetic-cookie; HttpOnly; Secure; SameSite=Lax');
    if (path === '/api/auth/logout') return json({}, 201);
    if (path === '/api/admin/whatsapp/staging/test-target') return json({
      staging: true, targetMatches: true, botEnabled: true, credentialsPresent: true,
      conversationTestVersion: '2026-10-10.cart-v7', rateLimitPerMinute: 25,
    }, 201);
    if (path === '/api/admin/whatsapp/conversations') return json([{ id: 42, phoneE164: conversation.phoneE164 }]);
    if (path === '/api/admin/whatsapp/conversations/42') return json(conversation);
    if (path === '/api/products') return json(products);
    if (path === '/api/orders/daily') {
      orderReads++;
      return json(options.newOrder && orderReads > 1 ? [{ id: '9', phone: env.STAGING_WHATSAPP_RECIPIENTS }] : []);
    }
    if (path === '/api/whatsapp/webhook') {
      const signature = 'sha256=' + createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET).update(opts.body).digest('hex');
      assert.equal(opts.headers['X-Hub-Signature-256'], signature);
      const text = JSON.parse(opts.body).entry[0].changes[0].value.messages[0].text.body;
      assert.notEqual(text.trim().toLowerCase(), 'confirmar');
      conversation.messages.push({ id: nextId++, direction: 'in', body: text, sentBy: 'customer' });
      conversation.messages.push({ id: nextId++, direction: 'out', body: 'Listo.', sentBy: 'bot' });
      const session = conversation.sessionData;
      if (text === 'Reiniciar') {
        conversation.state = 'building_cart';
        conversation.sessionData = { cart: [] };
      } else if (text === 'costillas der cerdo') {
        session.cart = [{ productId: 60, quantity: 2 }];
      } else if (text === 'Frita') {
        session.cart = [
          { productId: 60, quantity: 2 },
          { productId: 14, quantity: 1, attributes: [{ attributeName: 'Seleccion', attributeValue: 'Frita' }] },
        ];
      } else if (text.startsWith('Dos churrascos')) {
        session.cart = [
          { productId: 17, quantity: 2, note: 'sin ensalada' },
          { productId: 14, quantity: 1, attributes: [{ attributeName: 'Seleccion', attributeValue: 'Asada' }] },
        ];
      } else if (text === 'No más') conversation.state = options.unnamed ? 'awaiting_name' : 'awaiting_address';
      else if (text === 'Cliente Sintetico') conversation.state = 'awaiting_address';
      else if (text.includes('78 b 20')) {
        session.address = 'Dg 6 b #78 b 20, Castilla, Bogotá';
        session.addressConfirmed = true;
        session.deliveryFeeCalculated = 4000;
        session.orderType = 'delivery';
      } else if (text.includes('81 b 51')) {
        session.address = 'cll 6 b 81 b 51, Castilla, Bogotá';
        session.addressConfirmed = true;
        session.deliveryFeeCalculated = 4000;
        conversation.state = 'building_cart';
      } else if (text === 'Solo era un churrasco') {
        session.cart.find(line => line.productId === 17).quantity = 1;
      }
      return json({ ok: true });
    }
    return json({}, 404);
  };
  return { fetch, calls };
}

test('preflight reads staging and sends nothing', async () => {
  const { fetch, calls } = fixture();
  const report = await runRehearsal({ ...env, STAGING_HUMAN_EXECUTE: 'false' }, fetch, { sleep: async () => {} });
  assert.equal(report.ok, true);
  assert.equal(report.webhookPosts, 0);
  assert.equal(calls.some(url => url.includes('/api/whatsapp/webhook')), false);
});

test('execute covers the typo, address change and quantity correction without creating an order', async () => {
  const { fetch } = fixture();
  const report = await runRehearsal(env, fetch, { sleep: async () => {} });
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  assert.deepEqual(report.steps.map(step => step.id), STEPS.map(step => step.id));
  assert.equal(report.steps.at(-2).cart.find(line => line.productId === 17).quantity, 1);
});

test('an unnamed checkout inserts the name and still stops before payment', async () => {
  const { fetch } = fixture({ unnamed: true });
  const report = await runRehearsal(env, fetch, { sleep: async () => {} });
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  assert.ok(report.steps.some(step => step.id === 'customer-name'));
  assert.equal(report.steps.at(-1).id, 'reset-end');
});

test('a new daily order fails the rehearsal', async () => {
  const { fetch } = fixture({ newOrder: true });
  const report = await runRehearsal(env, fetch, { sleep: async () => {} });
  assert.equal(report.ok, false);
  assert.equal(report.checks.at(-2).code, 'UNEXPECTED_STAGING_ORDER_CREATED');
});
