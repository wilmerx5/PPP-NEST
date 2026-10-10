'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { runRehearsal, STEPS } = require('./ppp-staging-checkout-flow-rehearsal.cjs');

const env = {
  GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'wilmerx5/PPP-NEST',
  GITHUB_REF: 'refs/heads/fix/whatsapp-checkout-flow-20261010', GITHUB_EVENT_NAME: 'workflow_dispatch',
  STAGING_CHECKOUT_FLOW_EXECUTE: 'true', STAGING_ADMIN_EMAIL: 'automation@example.invalid',
  STAGING_ADMIN_PASSWORD: 'synthetic-password', STAGING_WHATSAPP_APP_SECRET: 'synthetic-app-secret',
  STAGING_WHATSAPP_PHONE_NUMBER_ID: '12345', STAGING_WHATSAPP_RECIPIENTS: '573001234567',
};
const products = [
  { id: 13, name: 'Sobrebarriga', availableNow: true },
  { id: 17, name: 'Churrasco', availableNow: true },
  { id: 78, name: 'Tres  Hamburguesas Clasicas', availableNow: true },
  { id: 76, name: 'Hamburguesa Clasica', availableNow: true },
];

function fixture() {
  const conversation = {
    id: 42, waId: env.STAGING_WHATSAPP_RECIPIENTS, phoneE164: '+' + env.STAGING_WHATSAPP_RECIPIENTS,
    humanTakeover: false, state: 'building_cart', customerName: 'Wilmer',
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
    if (path === '/api/orders/daily') { orderReads++; return json([]); }
    if (path === '/api/whatsapp/webhook') {
      const signature = 'sha256=' + createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET).update(opts.body).digest('hex');
      assert.equal(opts.headers['X-Hub-Signature-256'], signature);
      const text = JSON.parse(opts.body).entry[0].changes[0].value.messages[0].text.body;
      assert.notEqual(text.trim().toLowerCase(), 'confirmar');
      conversation.messages.push({ id: nextId++, direction: 'in', body: text, sentBy: 'customer' });
      conversation.messages.push({ id: nextId++, direction: 'out', body: 'Listo.', sentBy: 'bot' });
      const session = conversation.sessionData;
      if (text === 'Reiniciar') { conversation.state = 'building_cart'; conversation.sessionData = { cart: [] }; }
      else if (text.startsWith('Quiero una sobrebarriga')) {
        session.cart = [{ productId: 13, quantity: 1, attributes: [{ attributeName: 'Seleccion', attributeValue: 'Asada' }] }];
      } else if (text === 'No más') conversation.state = 'awaiting_address';
      else if (text.includes('78 b 20')) {
        session.address = 'Dg 6 b #78 b 20, Castilla, Bogotá';
        session.addressConfirmed = true;
        session.deliveryFeeCalculated = 4000;
        conversation.state = 'awaiting_payment';
      } else if (text === 'En salsa') {
        session.cart[0].attributes = [{ attributeName: 'Seleccion', attributeValue: 'En Salsa' }];
        conversation.state = 'awaiting_payment';
      } else if (text.startsWith('Pago con')) {
        session.paymentMethod = 'cash';
        session.cashChangeFor = 'pago con un billete de 50 mil';
        conversation.state = 'awaiting_final_confirm';
      } else if (text.startsWith('Quiero tres hamburguesas')) {
        session.cart = [{ productId: 78, quantity: 1, attributes: [] }];
        conversation.state = 'building_cart';
      } else if (text.startsWith('Quiero un churrasco')) {
        session.cart = [{ productId: 17, quantity: 1, attributes: [] }];
        conversation.state = 'building_cart';
      } else if (text.startsWith('Para la Calle 48')) {
        session.address = 'Calle 48 sur 87 86';
        session.addressConfirmed = true;
        session.deliveryFeeCalculated = 6000;
        conversation.state = 'awaiting_payment';
      } else if (text.startsWith('No quiero que lo quites')) {
        conversation.state = 'building_cart';
      } else if (text === 'Colombiana') {
        session.cart = [{ productId: 78, quantity: 1, attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }] }];
        conversation.state = 'building_cart';
      }
      return json({ ok: true });
    }
    return json({}, 404);
  };
  return { fetch, orderReads };
}

test('the plan never confirms an order', () => {
  assert.equal(STEPS.some(step => /^confirmar$/i.test(step.text.trim())), false);
  assert.ok(STEPS.some(step => step.id === 'cash-amount'));
  assert.ok(STEPS.some(step => step.id === 'named-pack'));
});

test('preflight sends nothing', async () => {
  const { fetch } = fixture();
  const report = await runRehearsal({ ...env, STAGING_CHECKOUT_FLOW_EXECUTE: 'false' }, fetch, { sleep: async () => {} });
  assert.equal(report.ok, true);
  assert.equal(report.webhookPosts, 0);
});

test('execute covers preparation, cash amount and the named pack', async () => {
  const { fetch } = fixture();
  const report = await runRehearsal(env, fetch, { sleep: async () => {} });
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  assert.deepEqual(report.steps.map(step => step.id), STEPS.map(step => step.id));
});
