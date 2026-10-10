'use strict';

const { createHmac, randomUUID } = require('node:crypto');
const TARGET = 'https://dev.prontopolloportal.com';
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const digits = value => String(value || '').replace(/\D/g, '');
class CheckError extends Error { constructor(code) { super(code); this.code = code; } }
const ensure = (ok, code) => { if (!ok) throw new CheckError(code); };

const STEPS = [
  { id: 'reset-start', text: 'Reiniciar' },
  { id: 'ambiguous-chicken', text: 'Quiero un pollo' },
  { id: 'quarter-fried', text: 'Un cuarto de pollo frito, ala pechuga, arepas fritas' },
  { id: 'soda-400', text: 'Una gaseosa de 400 pepsi' },
  { id: 'reset-fish', text: 'Reiniciar' },
  { id: 'mojarra-fried', text: 'Una mojarra frita' },
  { id: 'rice-ribs', text: 'Arroz chino con costillas de cerdo' },
  { id: 'reset-pechuga', text: 'Reiniciar' },
  { id: 'ambiguous-pechuga', text: 'Una pechuga' },
  { id: 'pechuga-gratinada', text: 'La gratinada' },
  { id: 'yuca', text: 'Y una porcion de yuca' },
  { id: 'reset-ejecutivo', text: 'Reiniciar' },
  { id: 'ejecutivo-frito', text: 'Un ejecutivo con pollo frito' },
  { id: 'ejecutivo-choices', text: 'Pierna pernil, mondongo y limonada' },
  { id: 'reset-taco', text: 'Reiniciar' },
  { id: 'taco', text: 'Un taco al pastor' },
  { id: 'taco-drink', text: 'Colombiana' },
  { id: 'reset-end', text: 'Reiniciar' },
];

function lineQty(cart, productId) {
  return (cart || []).filter(line => line.productId === productId).reduce((sum, line) => sum + Number(line.quantity), 0);
}
function hasAttr(cart, productId, value) {
  return (cart || []).some(line => line.productId === productId &&
    line.attributes?.some(attribute => normalize(attribute.attributeValue) === normalize(value)));
}
function named(products, pattern) {
  return products.find(product => pattern.test(product.name));
}

async function runRehearsal(env = process.env, fetchImpl = globalThis.fetch, helpers = {}) {
  const now = helpers.now || Date.now;
  const sleep = helpers.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const report = {
    ok: false, mode: env.STAGING_CATALOG_EXECUTE === 'true' ? 'execute' : 'preflight',
    checks: [], steps: [], webhookPosts: 0, expectedSteps: STEPS.length,
    limits: 'Signed synthetic inbound to the one authorized recipient. Covers several categories and ambiguous prompts. Stops before confirmation.',
    categories: ['Pollo', 'Bebidas', 'Pescado', 'Arroces', 'Pechuga', 'Porciones', 'Ejecutivo', 'Comidas Rapidas'],
  };
  let cookie = '', requests = 0, startedAt = now(), recipient, channel, conversationId, rateLimit = 20;
  let catalog = [], current, baselineOrderIds;
  const ids = {};
  const check = async (name, work) => {
    try { await work(); report.checks.push({ name, pass: true }); return true; }
    catch (error) { report.checks.push({ name, pass: false, code: error instanceof CheckError ? error.code : 'REQUEST_FAILED' }); return false; }
  };
  const request = async (path, options = {}) => {
    const url = new URL(path, TARGET);
    ensure(url.origin === TARGET && url.pathname.startsWith('/api/'), 'TARGET_NOT_ALLOWED');
    ensure(++requests <= 120 && now() - startedAt < 720000, 'HTTP_OR_TIME_BUDGET_EXCEEDED');
    const response = await fetchImpl(url.href, { ...options, redirect: 'manual', signal: AbortSignal.timeout(60000) });
    ensure(response.status < 300 || response.status >= 400, 'REDIRECT_REJECTED');
    return response;
  };
  const admin = (path, options = {}) => request(path, { ...options, headers: { ...options.headers, Cookie: cookie } });
  const detail = async () => {
    const response = await admin(`/api/admin/whatsapp/conversations/${conversationId}`);
    ensure(response.status === 200, 'CONVERSATION_READ_FAILED');
    const body = await response.json();
    ensure(body.id === conversationId && digits(body.phoneE164) === recipient && digits(body.waId) === recipient, 'CONVERSATION_RECIPIENT_MISMATCH');
    ensure(body.humanTakeover === false && Array.isArray(body.messages) && Array.isArray(body.sessionData?.cart), 'CONVERSATION_UNAVAILABLE_OR_TAKEOVER');
    return body;
  };
  const orderIds = async () => {
    const response = await admin('/api/orders/daily');
    ensure(response.status === 200, 'DAILY_ORDERS_READ_FAILED');
    const body = await response.json();
    const orders = Array.isArray(body) ? body : body?.orders;
    ensure(Array.isArray(orders), 'DAILY_ORDERS_INVALID');
    return new Set(orders.filter(order => digits(order.phone) === recipient).map(order => String(order.orderId ?? order.id)).filter(Boolean));
  };
  try {
    ensure(!STEPS.some(step => /^confirmar$/i.test(step.text.trim())), 'PLAN_MUST_NOT_CONFIRM');
    if (!await check('authorized_context', async () => {
      ensure(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'wilmerx5/PPP-NEST' &&
        env.GITHUB_REF === 'refs/heads/fix/whatsapp-checkout-flow-20261010' &&
        ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'UNAPPROVED_EXECUTION_CONTEXT');
      ensure(env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS_VERIFICATION_REQUIRED');
      ensure(['STAGING_ADMIN_EMAIL', 'STAGING_ADMIN_PASSWORD', 'STAGING_WHATSAPP_APP_SECRET',
        'STAGING_WHATSAPP_PHONE_NUMBER_ID', 'STAGING_WHATSAPP_RECIPIENTS'].every(key => env[key]?.trim()), 'REQUIRED_SECRET_MISSING');
      const recipients = env.STAGING_WHATSAPP_RECIPIENTS.split(',').map(digits);
      ensure(recipients.length === 1 && /^\d{8,15}$/.test(recipients[0]), 'SINGLE_TEST_RECIPIENT_REQUIRED');
      recipient = recipients[0];
      channel = env.STAGING_WHATSAPP_PHONE_NUMBER_ID.trim();
    })) return report;
    if (!await check('health_database', async () => {
      const response = await request('/api/health');
      ensure(response.status === 200, 'HEALTH_HTTP_FAILED');
      const body = await response.json();
      ensure(body.status === 'ok' && body.db === 'connected', 'DATABASE_NOT_CONNECTED');
    })) return report;
    if (!await check('staging_admin_login', async () => {
      const response = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: env.STAGING_ADMIN_EMAIL.trim(), password: env.STAGING_ADMIN_PASSWORD }) });
      ensure([200, 201].includes(response.status), 'LOGIN_REJECTED');
      const body = await response.json();
      const access = response.headers.getSetCookie().find(value => value.startsWith('access_token='));
      if (access) cookie = access.split(';', 1)[0];
      ensure(body.requires2FA === false && body.user?.roles?.includes('admin') && !body.user?.password, 'WRONG_TEST_ADMIN_OR_PASSWORD_LEAKED');
    })) return report;
    if (!await check('effective_staging_target', async () => {
      const response = await admin('/api/admin/whatsapp/staging/test-target', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId: channel, recipient }) });
      ensure([200, 201].includes(response.status), 'TARGET_VERIFICATION_FAILED');
      const body = await response.json();
      ensure(body.staging === true && body.conversationTestVersion === '2026-10-10.cart-v7', 'CURRENT_CART_PATCHES_NOT_DEPLOYED');
      ensure(body.targetMatches === true && body.botEnabled === true && body.credentialsPresent === true, 'TEST_CHANNEL_OR_RECIPIENT_MISMATCH');
      rateLimit = body.rateLimitPerMinute;
    })) return report;
    const sign = payload => `sha256=${createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET.trim()).update(payload).digest('hex')}`;
    if (!await check('catalog_and_chat', async () => {
      const productsResponse = await request('/api/products');
      ensure(productsResponse.status === 200, 'CATALOG_HTTP_FAILED');
      catalog = await productsResponse.json();
      ids.quarter = named(catalog, /^1\/4 Pollo Frito$/);
      ids.soda = named(catalog, /^Gaseosa 400ml$/);
      ids.mojarra = named(catalog, /^Mojarra$/);
      ids.riceRibs = named(catalog, /^Arroz Chino Con Costillas De Cerdo$/);
      ids.gratinada = named(catalog, /^Pechuga Gratinada$/);
      ids.plancha = named(catalog, /^Pechuga A La Plancha$/);
      ids.yuca = named(catalog, /^Porcion De Yuca Frita$/);
      ids.ejecutivo = named(catalog, /^Ejecutivo Con Pollo Frito$/);
      ids.taco = named(catalog, /^Taco Al Pastor$/);
      const required = ['quarter', 'soda', 'mojarra', 'riceRibs', 'gratinada', 'plancha', 'yuca', 'ejecutivo', 'taco'];
      ensure(required.every(key => ids[key]), 'REQUIRED_PRODUCT_UNAVAILABLE');
      const list = await admin('/api/admin/whatsapp/conversations');
      ensure(list.status === 200, 'CONVERSATION_LIST_FAILED');
      const matches = (await list.json()).filter(row => digits(row.phoneE164) === recipient);
      ensure(matches.length === 1, 'TEST_CONVERSATION_MISSING_OR_AMBIGUOUS');
      conversationId = matches[0].id;
      current = await detail();
      baselineOrderIds = await orderIds();
    })) return report;
    if (report.mode === 'preflight') { report.ok = true; return report; }

    const runId = randomUUID();
    let lastSent = 0;
    for (const step of STEPS) {
      report.activeStep = step.id;
      const before = await detail();
      ensure(JSON.stringify(before.sessionData) === JSON.stringify(current.sessionData), 'CONCURRENT_CHAT_ACTIVITY');
      const previousIds = new Set(before.messages.map(message => String(message.id)));
      const wait = Math.max(0, 60000 / rateLimit + 1000 - (now() - lastSent));
      if (wait) await sleep(wait);
      ensure(!/^confirmar$/i.test(step.text.trim()), 'CONFIRM_BLOCKED');
      const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp', metadata: { phone_number_id: channel }, messages: [{ from: recipient,
          id: `wamid.ppp-catalog-${runId}-${step.id}`, timestamp: String(Math.floor(now() / 1000)), type: 'text', text: { body: step.text } }] } }] }] });
      lastSent = now();
      report.webhookPosts++;
      const response = await request('/api/whatsapp/webhook', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(payload) }, body: payload });
      ensure(response.status === 200 && (await response.json()).ok === true, 'WEBHOOK_HTTP_FAILED_NO_RETRY');
      current = await detail();
      const incoming = current.messages.filter(message => !previousIds.has(String(message.id)) && message.direction === 'in');
      const outgoing = current.messages.filter(message => !previousIds.has(String(message.id)) && message.direction === 'out');
      ensure(incoming.length === 1 && incoming[0].body === step.text, 'MISSING_OR_CONCURRENT_INBOUND');
      ensure(outgoing.length >= 1 && outgoing.every(message => message.sentBy === 'bot'), 'BOT_REPLY_NOT_PERSISTED');
      const cart = current.sessionData.cart;
      if (step.id.startsWith('reset')) {
        ensure(current.state === 'building_cart' && cart.length === 0, 'RESET_LEFT_DRAFT');
      }
      if (step.id === 'ambiguous-chicken') {
        const chickenIds = catalog.filter(product => /pollo/i.test(product.name)).map(product => product.id);
        ensure(chickenIds.every(id => lineQty(cart, id) === 0), 'AMBIGUOUS_CHICKEN_AUTO_ADDED');
        ensure(current.state === 'building_cart', 'AMBIGUOUS_CHICKEN_SKIPPED_TO_CHECKOUT');
      }
      if (step.id === 'quarter-fried') {
        ensure(lineQty(cart, ids.quarter.id) === 1, 'QUARTER_FRIED_NOT_SAVED');
        ensure(hasAttr(cart, ids.quarter.id, 'Ala pechuga') && hasAttr(cart, ids.quarter.id, 'Fritas'), 'QUARTER_ATTRS_NOT_SAVED');
      }
      if (step.id === 'soda-400') {
        ensure(lineQty(cart, ids.quarter.id) === 1 && lineQty(cart, ids.soda.id) === 1, 'SODA_NOT_ADDED_WITH_CHICKEN');
        ensure(hasAttr(cart, ids.soda.id, 'Pepsi'), 'SODA_FLAVOR_NOT_SAVED');
      }
      if (step.id === 'mojarra-fried') {
        ensure(lineQty(cart, ids.mojarra.id) === 1 && hasAttr(cart, ids.mojarra.id, 'Frita'), 'MOJARRA_NOT_SAVED');
      }
      if (step.id === 'rice-ribs') {
        ensure(lineQty(cart, ids.mojarra.id) === 1 && lineQty(cart, ids.riceRibs.id) === 1, 'RICE_RIBS_NOT_ADDED');
      }
      if (step.id === 'ambiguous-pechuga') {
        ensure(lineQty(cart, ids.gratinada.id) === 0, 'AMBIGUOUS_PECHUGA_PICKED_GRATINADA');
        ensure(current.state === 'building_cart', 'AMBIGUOUS_PECHUGA_SKIPPED_TO_CHECKOUT');
      }
      if (step.id === 'pechuga-gratinada') {
        ensure(lineQty(cart, ids.gratinada.id) === 1 && lineQty(cart, ids.plancha.id) === 0, 'GRATINADA_NOT_CHOSEN');
      }
      if (step.id === 'yuca') {
        ensure(lineQty(cart, ids.gratinada.id) === 1 && lineQty(cart, ids.yuca.id) === 1, 'YUCA_NOT_ADDED');
      }
      if (step.id === 'ejecutivo-frito') {
        ensure(lineQty(cart, ids.ejecutivo.id) === 1, 'EJECUTIVO_NOT_ADDED');
      }
      if (step.id === 'ejecutivo-choices') {
        ensure(lineQty(cart, ids.ejecutivo.id) === 1, 'EJECUTIVO_LOST');
        ensure(hasAttr(cart, ids.ejecutivo.id, 'Pierna Pernil'), 'EJECUTIVO_PRESA_NOT_SAVED');
        ensure(hasAttr(cart, ids.ejecutivo.id, 'Mondongo'), 'EJECUTIVO_SOPA_NOT_SAVED');
        ensure(hasAttr(cart, ids.ejecutivo.id, 'Limonada'), 'EJECUTIVO_DRINK_NOT_SAVED');
      }
      if (step.id === 'taco') {
        ensure(lineQty(cart, ids.taco.id) === 1, 'TACO_NOT_ADDED');
      }
      if (step.id === 'taco-drink') {
        ensure(lineQty(cart, ids.taco.id) === 1 && hasAttr(cart, ids.taco.id, 'Colombiana'), 'TACO_DRINK_NOT_SAVED');
      }
      const idsNow = await orderIds();
      ensure([...idsNow].every(id => baselineOrderIds.has(id)), 'UNEXPECTED_STAGING_ORDER_CREATED');
      report.steps.push({
        id: step.id, pass: true, state: current.state,
        cart: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
      });
    }
    delete report.activeStep;
    report.ok = report.steps.length === STEPS.length && report.steps.every(step => step.pass);
  } catch (error) {
    report.checks.push({ name: 'catalog_rehearsal', pass: false, code: error instanceof CheckError ? error.code : 'EXECUTION_FAILED_NO_RETRY' });
  } finally {
    if (cookie) {
      const logout = await check('logout', async () => {
        const response = await admin('/api/auth/logout', { method: 'POST' });
        ensure([200, 201].includes(response.status), 'LOGOUT_FAILED');
      });
      cookie = '';
      if (!logout) report.ok = false;
    }
    report.httpRequests = requests;
  }
  return report;
}

module.exports = { runRehearsal, STEPS };
if (require.main === module) {
  runRehearsal().then(report => {
    const fs = require('node:fs');
    fs.mkdirSync('tmp', { recursive: true });
    fs.writeFileSync('tmp/ppp-staging-catalog-report.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: report.ok, mode: report.mode, steps: report.steps.map(step => step.id), checks: report.checks, activeStep: report.activeStep }));
    process.exitCode = report.ok ? 0 : 1;
  }).catch(() => { console.error('STAGING_CATALOG_REHEARSAL_FAILED'); process.exitCode = 1; });
}
