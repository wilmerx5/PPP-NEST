'use strict';

const { createHmac, randomUUID } = require('node:crypto');
const TARGET = 'https://dev.prontopolloportal.com';
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const digits = value => String(value || '').replace(/\D/g, '');
class CheckError extends Error { constructor(code) { super(code); this.code = code; } }
const ensure = (ok, code) => { if (!ok) throw new CheckError(code); };

const STEPS = [
  { id: 'reset-start', text: 'Reiniciar' },
  { id: 'ribs-and-mojarra', text: 'Me vendes 2 costillas\n1 mojarra' },
  { id: 'ribs-typo-pick', text: 'costillas der cerdo' },
  { id: 'mojarra-fried', text: 'Frita' },
  { id: 'reset-before-address', text: 'Reiniciar' },
  { id: 'mixed-order', text: 'Dos churrascos sin ensalada y una mojarra asada.' },
  { id: 'finish-items', text: 'No más' },
  { id: 'delivery-address', text: 'Dg 6 b #78 b 20, Castilla, Bogotá' },
  { id: 'change-address', text: 'Cambia la direccion a cll 6 b 81 b 51, Castilla, Bogotá' },
  { id: 'correct-quantity', text: 'Solo era un churrasco' },
  { id: 'reset-end', text: 'Reiniciar' },
];

function lineQty(cart, productId) {
  return (cart || []).filter(line => line.productId === productId).reduce((sum, line) => sum + Number(line.quantity), 0);
}

async function runRehearsal(env = process.env, fetchImpl = globalThis.fetch, helpers = {}) {
  const now = helpers.now || Date.now;
  const sleep = helpers.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const report = {
    ok: false,
    mode: env.STAGING_HUMAN_EXECUTE === 'true' ? 'execute' : 'preflight',
    checks: [],
    steps: [],
    webhookPosts: 0,
    expectedSteps: STEPS.length,
    limits: 'Signed synthetic inbound to the one authorized recipient. Real Meta outbound and geocoding. No order confirmation, payment, invoice or kitchen event.',
  };
  let cookie = '', requests = 0, startedAt = now(), recipient, channel, conversationId, rateLimit = 20;
  let ribs, mojarra, churrasco, baselineOrderIds, current;
  const check = async (name, work) => {
    try { await work(); report.checks.push({ name, pass: true }); return true; }
    catch (error) { report.checks.push({ name, pass: false, code: error instanceof CheckError ? error.code : 'REQUEST_FAILED' }); return false; }
  };
  const request = async (path, options = {}) => {
    const url = new URL(path, TARGET);
    ensure(url.origin === TARGET && url.pathname.startsWith('/api/'), 'TARGET_NOT_ALLOWED');
    ensure(++requests <= 90 && now() - startedAt < 720000, 'HTTP_OR_TIME_BUDGET_EXCEEDED');
    const response = await fetchImpl(url.href, { ...options, redirect: 'manual', signal: AbortSignal.timeout(60000) });
    ensure(response.status < 300 || response.status >= 400, 'REDIRECT_REJECTED');
    return response;
  };
  const admin = (path, options = {}) => request(path, { ...options, headers: { ...options.headers, Cookie: cookie } });
  const detailUnchecked = async () => {
    const response = await admin(`/api/admin/whatsapp/conversations/${conversationId}`);
    ensure(response.status === 200, 'CONVERSATION_READ_FAILED');
    const body = await response.json();
    ensure(body.id === conversationId && digits(body.phoneE164) === recipient && digits(body.waId) === recipient, 'CONVERSATION_RECIPIENT_MISMATCH');
    ensure(Array.isArray(body.messages) && Array.isArray(body.sessionData?.cart), 'CONVERSATION_DETAIL_INVALID');
    return body;
  };
  const detail = async () => {
    const body = await detailUnchecked();
    ensure(body.humanTakeover === false, 'CONVERSATION_UNAVAILABLE_OR_TAKEOVER');
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
        env.GITHUB_REF === 'refs/heads/fix/whatsapp-regression-baseline' &&
        ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'UNAPPROVED_EXECUTION_CONTEXT');
      ensure(env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS_VERIFICATION_REQUIRED');
      ensure(!env.STAGING_HUMAN_EXECUTE || ['true', 'false'].includes(env.STAGING_HUMAN_EXECUTE), 'INVALID_EXECUTION_MODE');
      ensure(['STAGING_ADMIN_EMAIL', 'STAGING_ADMIN_PASSWORD', 'STAGING_WHATSAPP_APP_SECRET',
        'STAGING_WHATSAPP_PHONE_NUMBER_ID', 'STAGING_WHATSAPP_RECIPIENTS'].every(key => env[key]?.trim()), 'REQUIRED_SECRET_MISSING');
      const recipients = env.STAGING_WHATSAPP_RECIPIENTS.split(',').map(digits);
      ensure(recipients.length === 1 && /^\d{8,15}$/.test(recipients[0]), 'SINGLE_TEST_RECIPIENT_REQUIRED');
      recipient = recipients[0];
      channel = env.STAGING_WHATSAPP_PHONE_NUMBER_ID.trim();
      ensure(/^\d{5,30}$/.test(channel), 'INVALID_TEST_CHANNEL');
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
      ensure(body.requires2FA === false && body.user?.roles?.includes('admin'), 'WRONG_TEST_ADMIN_OR_2FA');
      const domain = access?.match(/;\s*Domain=([^;]+)/i)?.[1]?.toLowerCase().replace(/^\./, '');
      ensure(access && /;\s*Secure(?:;|$)/i.test(access) && /;\s*HttpOnly(?:;|$)/i.test(access) &&
        (!domain || domain === 'dev.prontopolloportal.com'), 'UNSAFE_ADMIN_COOKIE');
    })) return report;
    if (!await check('effective_staging_target', async () => {
      const response = await admin('/api/admin/whatsapp/staging/test-target', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId: channel, recipient }) });
      ensure([200, 201].includes(response.status), 'TARGET_VERIFICATION_FAILED');
      const body = await response.json();
      ensure(body.staging === true && body.conversationTestVersion === '2026-10-10.cart-v7', 'CURRENT_CART_PATCHES_NOT_DEPLOYED');
      ensure(body.targetMatches === true && body.botEnabled === true && body.credentialsPresent === true, 'TEST_CHANNEL_OR_RECIPIENT_MISMATCH');
      ensure(Number.isInteger(body.rateLimitPerMinute) && body.rateLimitPerMinute >= 5, 'INVALID_RATE_LIMIT');
      rateLimit = body.rateLimitPerMinute;
    })) return report;
    const sign = payload => `sha256=${createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET.trim()).update(payload).digest('hex')}`;
    if (!await check('catalog_and_empty_chat', async () => {
      const productsResponse = await request('/api/products');
      ensure(productsResponse.status === 200, 'CATALOG_HTTP_FAILED');
      const products = await productsResponse.json();
      ribs = products.find(product => product.name === 'Costillas De Cerdo');
      mojarra = products.find(product => product.name === 'Mojarra');
      churrasco = products.find(product => product.name === 'Churrasco');
      ensure(ribs && mojarra && churrasco && [ribs, mojarra, churrasco].every(product => product.availableNow === true), 'REQUIRED_PRODUCT_UNAVAILABLE');
      const list = await admin('/api/admin/whatsapp/conversations');
      ensure(list.status === 200, 'CONVERSATION_LIST_FAILED');
      const matches = (await list.json()).filter(row => digits(row.phoneE164) === recipient);
      ensure(matches.length === 1, 'TEST_CONVERSATION_MISSING_OR_AMBIGUOUS');
      conversationId = matches[0].id;
      current = await detail();
      ensure(env.STAGING_HUMAN_CLEANUP === 'true' || current.state === 'building_cart', 'TEST_CHAT_NOT_BUILDING_CART');
      baselineOrderIds = await orderIds();
    })) return report;
    if (report.mode === 'preflight' && env.STAGING_HUMAN_CLEANUP !== 'true') { report.ok = true; return report; }
    if (env.STAGING_HUMAN_CLEANUP === 'true') {
      report.mode = 'cleanup';
      const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp', metadata: { phone_number_id: channel }, messages: [{ from: recipient,
          id: `wamid.ppp-human-cleanup-${randomUUID()}`, timestamp: String(Math.floor(now() / 1000)), type: 'text', text: { body: 'Reiniciar' } }] } }] }] });
      report.webhookPosts++;
      const response = await request('/api/whatsapp/webhook', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(payload) }, body: payload });
      ensure(response.status === 200 && (await response.json()).ok === true, 'CLEANUP_WEBHOOK_FAILED');
      current = await detail();
      ensure(current.state === 'building_cart' && current.sessionData.cart.length === 0 && !current.sessionData.paymentMethod, 'CLEANUP_LEFT_A_DRAFT');
      const ids = await orderIds();
      ensure([...ids].every(id => baselineOrderIds.has(id)), 'UNEXPECTED_STAGING_ORDER_CREATED');
      report.ok = true;
      return report;
    }

    const runId = randomUUID();
    let lastSent = 0;
    const steps = STEPS.map(step => ({ ...step }));
    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      if (step.id === 'delivery-address' && current.state === 'awaiting_name') {
        steps.splice(index, 0, { id: 'customer-name', text: 'Cliente Sintetico' });
        index--;
        continue;
      }
      report.activeStep = step.id;
      const before = await detail();
      ensure(JSON.stringify(before.sessionData) === JSON.stringify(current.sessionData), 'CONCURRENT_CHAT_ACTIVITY');
      const previousIds = new Set(before.messages.map(message => String(message.id)));
      const wait = Math.max(0, 60000 / rateLimit + 1000 - (now() - lastSent));
      if (wait) await sleep(wait);
      ensure(!/^confirmar$/i.test(step.text.trim()), 'CONFIRM_BLOCKED');
      const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp', metadata: { phone_number_id: channel }, messages: [{ from: recipient,
          id: `wamid.ppp-human-${runId}-${step.id}`, timestamp: String(Math.floor(now() / 1000)), type: 'text', text: { body: step.text } }] } }] }] });
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
      const reply = normalize(outgoing.map(message => message.body).join(' '));
      const cart = current.sessionData.cart;
      const session = current.sessionData;
      if (step.id === 'reset-start' || step.id === 'reset-before-address' || step.id === 'reset-end') {
        ensure(current.state === 'building_cart' && cart.length === 0 && !session.address && !session.paymentMethod, 'RESET_LEFT_DRAFT');
      }
      if (step.id === 'ribs-typo-pick') {
        ensure(!reply.includes('no manejamos'), 'TYPO_TREATED_AS_UNKNOWN_DISH');
        ensure(lineQty(cart, ribs.id) === 2, 'RIBS_QUANTITY_LOST');
      }
      if (step.id === 'mojarra-fried') {
        ensure(lineQty(cart, ribs.id) === 2 && lineQty(cart, mojarra.id) === 1, 'FRIED_MOJARRA_CART_MISMATCH');
        ensure(!session.address, 'FOOD_STYLE_STORED_AS_ADDRESS');
        const fish = cart.find(item => item.productId === mojarra.id);
        ensure(fish?.attributes?.some(attribute => normalize(attribute.attributeValue) === 'frita'), 'MOJARRA_STYLE_NOT_SAVED');
      }
      if (step.id === 'mixed-order') {
        ensure(lineQty(cart, churrasco.id) === 2 && lineQty(cart, mojarra.id) === 1, 'MIXED_ORDER_NOT_PERSISTED');
        ensure(normalize(cart.find(item => item.productId === churrasco.id)?.note).includes('ensalada'), 'CHURRASCO_NOTE_MISSING');
      }
      if (step.id === 'finish-items') ensure(['awaiting_name', 'awaiting_address'].includes(current.state), 'CHECKOUT_NOT_STARTED');
      if (step.id === 'customer-name') ensure(current.state === 'awaiting_address', 'NAME_DID_NOT_ADVANCE');
      if (step.id === 'delivery-address') {
        ensure(session.addressConfirmed === true && normalize(session.address).includes('78') && Number(session.deliveryFeeCalculated) >= 0, 'FIRST_ADDRESS_NOT_QUOTED');
        ensure(lineQty(cart, churrasco.id) === 2 && lineQty(cart, mojarra.id) === 1, 'ADDRESS_CHANGED_THE_CART');
        ensure(current.state !== 'completed', 'ORDER_CREATED_TOO_EARLY');
      }
      if (step.id === 'change-address') {
        ensure(normalize(session.address).includes('81') && Number(session.deliveryFeeCalculated) >= 0, 'ADDRESS_CHANGE_NOT_REQUOTED');
        ensure(lineQty(cart, churrasco.id) === 2 && lineQty(cart, mojarra.id) === 1, 'ADDRESS_CHANGE_CHANGED_THE_CART');
      }
      if (step.id === 'correct-quantity') {
        ensure(lineQty(cart, churrasco.id) === 1 && lineQty(cart, mojarra.id) === 1, 'QUANTITY_CORRECTION_FAILED');
        ensure(normalize(cart.find(item => item.productId === churrasco.id)?.note).includes('ensalada'), 'CORRECTION_DROPPED_THE_NOTE');
        ensure(!session.paymentMethod && current.state !== 'completed' && current.state !== 'awaiting_final_confirm', 'CORRECTION_LEFT_A_PAYABLE_CHECKOUT');
      }
      const ids = await orderIds();
      ensure([...ids].every(id => baselineOrderIds.has(id)), 'UNEXPECTED_STAGING_ORDER_CREATED');
      report.steps.push({ id: step.id, pass: true, cart: cart.map(item => ({ productId: item.productId, quantity: item.quantity })) });
    }
    delete report.activeStep;
    report.expectedSteps = steps.length;
    const silenced = await check('human_takeover_silences_bot', async () => {
      const taken = await admin(`/api/admin/whatsapp/conversations/${conversationId}/takeover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ takeover: true }),
      });
      ensure([200, 201].includes(taken.status), 'TAKEOVER_FAILED');
      const before = await detailUnchecked();
      const previousIds = new Set(before.messages.map(message => String(message.id)));
      const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp', metadata: { phone_number_id: channel }, messages: [{ from: recipient,
          id: `wamid.ppp-human-${runId}-takeover`, timestamp: String(Math.floor(now() / 1000)), type: 'text', text: { body: 'Quiero un pollo frito' } }] } }] }] });
      report.webhookPosts++;
      const response = await request('/api/whatsapp/webhook', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(payload) }, body: payload });
      ensure(response.status === 200 && (await response.json()).ok === true, 'TAKEOVER_WEBHOOK_FAILED');
      const during = await detailUnchecked();
      const outgoing = during.messages.filter(message => !previousIds.has(String(message.id)) && message.direction === 'out' && message.sentBy === 'bot');
      ensure(during.humanTakeover === true && outgoing.length === 0 && during.sessionData.cart.length === 0, 'BOT_REPLIED_DURING_TAKEOVER');
      const released = await admin(`/api/admin/whatsapp/conversations/${conversationId}/takeover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ takeover: false }),
      });
      ensure([200, 201].includes(released.status), 'RELEASE_FAILED');
      current = await detail();
      ensure(current.humanTakeover === false && current.sessionData.cart.length === 0, 'BOT_NOT_RELEASED');
      const ids = await orderIds();
      ensure([...ids].every(id => baselineOrderIds.has(id)), 'UNEXPECTED_STAGING_ORDER_CREATED');
    });
    report.ok = silenced && report.steps.length === steps.length && report.steps.every(step => step.pass);
  } catch (error) {
    report.checks.push({ name: 'human_rehearsal', pass: false, code: error instanceof CheckError ? error.code : 'EXECUTION_FAILED_NO_RETRY' });
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
    const safe = JSON.parse(JSON.stringify(report));
    fs.writeFileSync('tmp/ppp-staging-human-report.json', JSON.stringify(safe, null, 2));
    console.log(JSON.stringify({ ok: report.ok, mode: report.mode, steps: report.steps.map(step => step.id), checks: report.checks, activeStep: report.activeStep }));
    process.exitCode = report.ok ? 0 : 1;
  }).catch(() => { console.error('STAGING_HUMAN_REHEARSAL_FAILED'); process.exitCode = 1; });
}
