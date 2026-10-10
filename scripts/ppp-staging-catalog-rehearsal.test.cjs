'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { runRehearsal, STEPS } = require('./ppp-staging-catalog-rehearsal.cjs');

const env = {
  GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'wilmerx5/PPP-NEST',
  GITHUB_REF: 'refs/heads/fix/whatsapp-checkout-flow-20261010', GITHUB_EVENT_NAME: 'workflow_dispatch',
  STAGING_CATALOG_EXECUTE: 'true', STAGING_ADMIN_EMAIL: 'automation@example.invalid',
  STAGING_ADMIN_PASSWORD: 'synthetic-password', STAGING_WHATSAPP_APP_SECRET: 'synthetic-app-secret',
  STAGING_WHATSAPP_PHONE_NUMBER_ID: '12345', STAGING_WHATSAPP_RECIPIENTS: '573001234567',
};

const products = [
  { id: 3, name: '1/4 Pollo Frito' },
  { id: 28, name: 'Gaseosa 400ml' },
  { id: 14, name: 'Mojarra' },
  { id: 84, name: 'Arroz Chino Con Costillas De Cerdo' },
  { id: 61, name: 'Pechuga Gratinada' },
  { id: 25, name: 'Pechuga A La Plancha' },
  { id: 7, name: 'Porcion De Yuca Frita' },
  { id: 22, name: 'Ejecutivo Con Pollo Frito' },
  { id: 70, name: 'Taco Al Pastor' },
];

function fixture() {
  const conversation = {
    id: 42, waId: env.STAGING_WHATSAPP_RECIPIENTS, phoneE164: '+' + env.STAGING_WHATSAPP_RECIPIENTS,
    humanTakeover: false, state: 'building_cart',
    sessionData: { cart: [] },
    messages: [{ id: 1, direction: 'in', body: 'Hola', sentBy: 'customer' }],
  };
  let nextId = 2;
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
      conversationTestVersion: '2026-10-10.cart-v8', rateLimitPerMinute: 25,
    }, 201);
    if (path === '/api/admin/whatsapp/conversations') return json([{ id: 42, phoneE164: conversation.phoneE164 }]);
    if (path === '/api/admin/whatsapp/conversations/42') return json(conversation);
    if (path === '/api/products') return json(products);
    if (path === '/api/orders/daily') return json([]);
    if (path === '/api/whatsapp/webhook') {
      const signature = 'sha256=' + createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET).update(opts.body).digest('hex');
      assert.equal(opts.headers['X-Hub-Signature-256'], signature);
      const text = JSON.parse(opts.body).entry[0].changes[0].value.messages[0].text.body;
      assert.notEqual(text.trim().toLowerCase(), 'confirmar');
      conversation.messages.push({ id: nextId++, direction: 'in', body: text, sentBy: 'customer' });
      conversation.messages.push({ id: nextId++, direction: 'out', body: 'Listo.', sentBy: 'bot' });
      const session = conversation.sessionData;
      if (text === 'Reiniciar') { conversation.state = 'building_cart'; conversation.sessionData = { cart: [] }; }
      else if (text.startsWith('Quiero un pollo')) conversation.state = 'building_cart';
      else if (text.startsWith('Un cuarto')) {
        session.cart = [{ productId: 3, quantity: 1, attributes: [
          { attributeName: 'Presa', attributeValue: 'Ala pechuga' },
          { attributeName: 'Arepas', attributeValue: 'Fritas' },
        ] }];
      } else if (text.includes('400 pepsi')) {
        session.cart.push({ productId: 28, quantity: 1, attributes: [{ attributeName: 'Sabor', attributeValue: 'Pepsi' }] });
      } else if (text.startsWith('Una mojarra')) {
        session.cart = [{ productId: 14, quantity: 1, attributes: [{ attributeName: 'Seleccion', attributeValue: 'Frita' }] }];
      } else if (text.startsWith('Arroz chino con costillas')) {
        session.cart.push({ productId: 84, quantity: 1, attributes: [] });
      } else if (text === 'Una pechuga') conversation.state = 'building_cart';
      else if (text === 'La gratinada') {
        session.cart = [{ productId: 61, quantity: 1, attributes: [] }];
      } else if (text.includes('yuca')) {
        session.cart.push({ productId: 7, quantity: 1, attributes: [] });
      } else if (text.startsWith('Un ejecutivo')) {
        session.cart = [{ productId: 22, quantity: 1, attributes: [] }];
      } else if (text.startsWith('Pierna pernil')) {
        session.cart = [{ productId: 22, quantity: 1, attributes: [
          { attributeName: 'Presa', attributeValue: 'Pierna Pernil' },
          { attributeName: 'Sopa', attributeValue: 'Mondongo' },
          { attributeName: 'Bebida', attributeValue: 'Limonada' },
        ] }];
      } else if (text.startsWith('Un taco')) {
        session.cart = [{ productId: 70, quantity: 1, attributes: [] }];
      } else if (text === 'Colombiana') {
        session.cart = [{ productId: 70, quantity: 1, attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }] }];
      }
      return json({ ok: true });
    }
    return json({}, 404);
  };
  return { fetch };
}

test('the catalog plan never confirms and covers several categories', () => {
  assert.equal(STEPS.some(step => /^confirmar$/i.test(step.text.trim())), false);
  assert.ok(STEPS.some(step => step.id === 'ambiguous-chicken'));
  assert.ok(STEPS.some(step => step.id === 'mojarra-fried'));
  assert.ok(STEPS.some(step => step.id === 'ejecutivo-choices'));
  assert.ok(STEPS.some(step => step.id === 'taco-drink'));
});

test('preflight sends nothing', async () => {
  const { fetch } = fixture();
  const report = await runRehearsal({ ...env, STAGING_CATALOG_EXECUTE: 'false' }, fetch, { sleep: async () => {} });
  assert.equal(report.ok, true);
  assert.equal(report.webhookPosts, 0);
});

test('execute walks chicken, fish, rice, pechuga, ejecutivo and taco', async () => {
  const { fetch } = fixture();
  const report = await runRehearsal(env, fetch, { sleep: async () => {} });
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  assert.deepEqual(report.steps.map(step => step.id), STEPS.map(step => step.id));
});
