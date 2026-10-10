'use strict';

const { createHmac, randomUUID } = require('node:crypto');
const { buildPlan, knownVariantDraft, buildKnownVariantResumePlan,
  knownCollapsedVariantDraft, buildCollapsedVariantResumePlan,
  knownVariantRemovalDraft, buildVariantRemovalResumePlan, knownDishNoteDraft, buildDishNoteResumePlan } = require('./ppp-staging-chat-plan.cjs');
const TARGET = 'https://dev.prontopolloportal.com';
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const digits = value => String(value || '').replace(/\D/g, '');
class CheckError extends Error { constructor(code) { super(code); this.code = code; } }
const ensure = (ok, code) => { if (!ok) throw new CheckError(code); };

function cartMatches(expected, actual) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const used = new Set();
  const choices = expected.map(want => actual.flatMap((line, index) => {
    const attrs = line.attributes || [];
    return line.productId === want.productId && line.quantity === want.quantity &&
      Number(line.unitPrice) === want.unitPrice && attrs.length === want.attrs.length &&
      want.attrs.every(a => attrs.some(b => normalize(a.attributeName) === normalize(b.attributeName) && normalize(a.attributeValue) === normalize(b.attributeValue))) &&
      want.note.every(token => normalize(line.note).includes(token)) &&
      (want.note.length > 0 || !String(line.note || '').trim()) &&
      want.forbidNote.every(token => !normalize(line.note).includes(token)) ? [index] : [];
  })).sort((a, b) => a.length - b.length);
  const match = position => {
    if (position === choices.length) return true;
    for (const index of choices[position]) {
      if (used.has(index)) continue;
      used.add(index);
      if (match(position + 1)) return true;
      used.delete(index);
    }
    return false;
  };
  return match(0);
}

async function runRehearsal(env = process.env, fetchImpl = globalThis.fetch, helpers = {}) {
  const now = helpers.now || Date.now;
  const sleep = helpers.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const resumeKnownDraft = env.STAGING_CHAT_RESUME === 'known-variant-draft';
  const resumeCollapsedDraft = env.STAGING_CHAT_RESUME === 'known-collapsed-variant-draft';
  const resumeRemovalDraft = env.STAGING_CHAT_RESUME === 'known-variant-removal-draft';
  const resumeNoteDraft = env.STAGING_CHAT_RESUME === 'known-dish-note-draft';
  const report = { ok: false, mode: env.STAGING_CHAT_EXECUTE === 'true' ? 'execute' : 'preflight',
    checks: [], steps: [], webhookPosts: 0, expectedSteps: resumeKnownDraft ? 23 : resumeCollapsedDraft ? 20 : resumeRemovalDraft ? 16 : resumeNoteDraft ? 15 : 21,
    limits: 'Synthetic signed inbound events; real staging persistence and Meta outbound. No genuine Meta inbound delivery, kitchen, payments or order confirmation tested.' };
  let cookie = '', requests = 0, startedAt = now(), recipient, channel, conversationId, initialName;
  const check = async (name, work) => {
    try { await work(); report.checks.push({ name, pass: true }); return true; }
    catch (error) { report.checks.push({ name, pass: false, code: error instanceof CheckError ? error.code : 'REQUEST_FAILED' }); return false; }
  };
  const request = async (path, options = {}) => {
    const url = new URL(path, TARGET);
    ensure(url.origin === TARGET && url.pathname.startsWith('/api/'), 'TARGET_NOT_ALLOWED');
    ensure(++requests <= 120 && now() - startedAt < 600000, 'HTTP_OR_TIME_BUDGET_EXCEEDED');
    const r = await fetchImpl(url.href, { ...options, redirect: 'manual', signal: AbortSignal.timeout(45000) });
    ensure(r.status < 300 || r.status >= 400, 'REDIRECT_REJECTED');
    return r;
  };
  const admin = (path, options = {}) => request(path, { ...options, headers: { ...options.headers, Cookie: cookie } });
  const detail = async () => {
    const r = await admin(`/api/admin/whatsapp/conversations/${conversationId}`);
    ensure(r.status === 200, 'CONVERSATION_READ_FAILED');
    const body = await r.json();
    ensure(body.id === conversationId && digits(body.phoneE164) === recipient && digits(body.waId) === recipient, 'CONVERSATION_RECIPIENT_MISMATCH');
    ensure(body.humanTakeover === false && Array.isArray(body.messages) && Array.isArray(body.sessionData?.cart), 'CONVERSATION_UNAVAILABLE_OR_TAKEOVER');
    ensure(body.messages.every(m => (typeof m.id === 'string' && /^[1-9]\d{0,19}$/.test(m.id)) ||
      (Number.isSafeInteger(m.id) && m.id > 0)), 'INVALID_MESSAGE_IDS');
    ensure(new Set(body.messages.map(m => String(m.id))).size === body.messages.length, 'DUPLICATE_MESSAGE_IDS');
    return body;
  };
  const unchangedIdentity = body => {
    ensure(body.customerName === initialName, 'CUSTOMER_NAME_CHANGED_BY_CART_MESSAGE');
    ensure(!['completed', 'closed'].includes(body.state), 'UNEXPECTED_ORDER_LIFECYCLE');
    const session = body.sessionData;
    ensure(!session.address && !session.paymentMethod && !session.mpPreferenceId && session.awaitingField !== 'confirm', 'UNEXPECTED_CHECKOUT_STATE');
    ensure(!session.customerNotes, 'DISH_NOTE_MISCLASSIFIED_AS_ORDER_NOTE');
  };
  try {
    if (!await check('authorized_context', async () => {
      ensure(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'wilmerx5/PPP-NEST' &&
        env.GITHUB_REF === 'refs/heads/fix/whatsapp-regression-baseline' &&
        ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'UNAPPROVED_EXECUTION_CONTEXT');
      ensure(env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS_VERIFICATION_REQUIRED');
      ensure(!env.STAGING_CHAT_EXECUTE || ['true', 'false'].includes(env.STAGING_CHAT_EXECUTE), 'INVALID_EXECUTION_MODE');
      ensure(!env.STAGING_CHAT_RESUME || resumeKnownDraft || resumeCollapsedDraft || resumeRemovalDraft || resumeNoteDraft, 'INVALID_RESUME_MODE');
      ensure(['STAGING_ADMIN_EMAIL', 'STAGING_ADMIN_PASSWORD', 'STAGING_WHATSAPP_APP_SECRET',
        'STAGING_WHATSAPP_PHONE_NUMBER_ID', 'STAGING_WHATSAPP_RECIPIENTS'].every(k => env[k]?.trim()), 'REQUIRED_SECRET_MISSING');
      const recipients = env.STAGING_WHATSAPP_RECIPIENTS.split(',').map(digits);
      ensure(recipients.length === 1 && /^\d{8,15}$/.test(recipients[0]), 'SINGLE_TEST_RECIPIENT_REQUIRED');
      recipient = recipients[0]; channel = env.STAGING_WHATSAPP_PHONE_NUMBER_ID.trim();
      ensure(/^\d{5,30}$/.test(channel), 'INVALID_TEST_CHANNEL');
    })) return report;
    if (!await check('health_database', async () => {
      const r = await request('/api/health'); ensure(r.status === 200, 'HEALTH_HTTP_FAILED');
      const body = await r.json(); ensure(body.status === 'ok' && body.db === 'connected', 'DATABASE_NOT_CONNECTED');
    })) return report;
    if (!await check('staging_admin_login', async () => {
      const r = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: env.STAGING_ADMIN_EMAIL.trim(), password: env.STAGING_ADMIN_PASSWORD }) });
      ensure([200, 201].includes(r.status), 'LOGIN_REJECTED');
      const body = await r.json();
      const access = r.headers.getSetCookie().find(v => v.startsWith('access_token='));
      // Retain the cookie for logout even when another identity check fails.
      if (access) cookie = access.split(';', 1)[0];
      ensure(body.requires2FA === false && body.user?.roles?.includes('admin') &&
        body.user.email?.toLowerCase() === env.STAGING_ADMIN_EMAIL.trim().toLowerCase(), 'WRONG_TEST_ADMIN_OR_2FA');
      const domain = access?.match(/;\s*Domain=([^;]+)/i)?.[1]?.toLowerCase().replace(/^\./, '');
      ensure(access && /;\s*Secure(?:;|$)/i.test(access) && /;\s*HttpOnly(?:;|$)/i.test(access) &&
        (!domain || domain === 'dev.prontopolloportal.com'), 'UNSAFE_ADMIN_COOKIE');
    })) return report;
    let rateLimit;
    if (!await check('effective_staging_target', async () => {
      const r = await admin('/api/admin/whatsapp/staging/test-target', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumberId: channel, recipient }) });
      ensure(r.status !== 404, 'STAGING_TEST_TARGET_NOT_DEPLOYED');
      ensure([200, 201].includes(r.status), 'TARGET_VERIFICATION_FAILED');
      const body = await r.json();
      ensure(body.staging === true, 'SERVER_NOT_STAGING');
      ensure(body.conversationTestVersion === '2026-10-10.cart-v5', 'CURRENT_CART_PATCHES_NOT_DEPLOYED');
      ensure(body.targetMatches === true, 'TEST_CHANNEL_OR_RECIPIENT_MISMATCH');
      ensure(body.botEnabled === true && body.agentEnabled === true && body.approvedModel === true && body.credentialsPresent === true, 'BOT_OR_APPROVED_MODEL_NOT_READY');
      ensure(Number.isInteger(body.rateLimitPerMinute) && body.rateLimitPerMinute >= 5 && body.rateLimitPerMinute <= 120, 'INVALID_RATE_LIMIT');
      rateLimit = body.rateLimitPerMinute;
    })) return report;
    const sign = payload => `sha256=${createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET.trim()).update(payload).digest('hex')}`;
    if (!await check('webhook_signature_without_messages', async () => {
      const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      const r = await request('/api/whatsapp/webhook', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(payload) }, body: payload });
      report.webhookSignatureHttpStatus = r.status;
      const body = await r.json().catch(() => ({}));
      if (r.status === 401 && body.error === 'invalid_signature') throw new CheckError('APP_SECRET_MISMATCH');
      if (r.status === 401 && body.error === 'raw_body_missing') throw new CheckError('WEBHOOK_RAW_BODY_MISSING');
      if (r.status === 503 && body.error === 'app_secret_missing') throw new CheckError('APP_SECRET_NOT_CONFIGURED_ON_SERVER');
      ensure(r.status === 200 && body.ok === true, 'SIGNED_WEBHOOK_HTTP_FAILED');
    })) return report;
    let initial, products;
    if (!await check('existing_empty_test_conversation', async () => {
      const r = await admin('/api/admin/whatsapp/conversations'); ensure(r.status === 200, 'CONVERSATION_LIST_FAILED');
      const list = await r.json(); ensure(Array.isArray(list), 'INVALID_CONVERSATION_LIST');
      const matches = list.filter(row => digits(row.phoneE164) === recipient);
      ensure(matches.length === 1 && Number.isSafeInteger(matches[0].id), 'TEST_CONVERSATION_MISSING_OR_AMBIGUOUS');
      conversationId = matches[0].id; initial = await detail(); initialName = initial.customerName;
      ensure(initial.state === 'building_cart', 'TEST_CHAT_NOT_BUILDING_CART');
      if (resumeKnownDraft) {
        ensure(initial.sessionData.cart.length === 3 && !initial.sessionData.pendingCartQuantity &&
          initial.messages.filter(m => m.direction === 'in').at(-1)?.body === 'Solo era una sobrebarriga asada', 'KNOWN_FAILED_DRAFT_CHANGED');
      } else if (resumeCollapsedDraft) {
        ensure(initial.sessionData.cart.length === 2 && !initial.sessionData.pendingCartQuantity &&
          !initial.sessionData.pendingMatch && !initial.sessionData.pendingAttribute && !initial.sessionData.pendingMultiOrder &&
          initial.messages.filter(m => m.direction === 'in').at(-1)?.body ===
            'Quiero un churrasco sin ensalada y dos sobrebarrigas: una asada y otra en salsa.', 'KNOWN_FAILED_DRAFT_CHANGED');
      } else if (resumeRemovalDraft) {
        ensure(initial.sessionData.cart.length === 3 && !initial.sessionData.pendingCartRemoval &&
          !initial.sessionData.pendingCartQuantity && !initial.sessionData.pendingMatch &&
          !initial.sessionData.pendingAttribute && !initial.sessionData.pendingMultiOrder &&
          initial.messages.filter(m => m.direction === 'in').at(-1)?.body ===
            'Quita la sobrebarriga en salsa; conserva la asada y los churrascos.', 'KNOWN_FAILED_DRAFT_CHANGED');
      } else if (resumeNoteDraft) {
        ensure(initial.sessionData.cart.length === 2 && !initial.sessionData.pendingCartRemoval &&
          !initial.sessionData.pendingCartQuantity && !initial.sessionData.pendingMatch &&
          !initial.sessionData.pendingAttribute && !initial.sessionData.pendingMultiOrder &&
          initial.messages.filter(m => m.direction === 'in').at(-1)?.body ===
            'A los churrascos ponles también papas bien crocantes.', 'KNOWN_FAILED_DRAFT_CHANGED');
      } else ensure(initial.sessionData.cart.length === 0, 'TEST_CHAT_HAS_EXISTING_DRAFT');
      unchangedIdentity(initial);
      const recentInbound = initial.messages.some(m => m.direction === 'in' && Number.isFinite(Date.parse(m.createdAt)) &&
        now() - Date.parse(m.createdAt) >= 0 && now() - Date.parse(m.createdAt) < 23 * 3600000);
      ensure(recentInbound, 'RECENT_TEST_CHAT_REQUIRED_META_WINDOW_NOT_GUARANTEED');
    })) return report;
    if (!await check('current_menu_products', async () => {
      const r = await request('/api/products'); ensure(r.status === 200, 'CATALOG_HTTP_FAILED');
      products = await r.json(); ensure(Array.isArray(products), 'INVALID_CATALOG');
      for (const [name, price] of [['Churrasco', 38000], ['Sobrebarriga', 33000], ['Costillas De Cerdo', 29500],
        ['Mojarra', 29500], ['1 Pollo Frito', 41000], ['1 Pollo Broaster', 43000]]) {
        const p = products.find(p => p.name === name);
        ensure(p && Number.isSafeInteger(p.id) && p.isActive === true && p.availableNow === true && Number(p.price) === price, 'REQUIRED_PRODUCT_UNAVAILABLE_OR_CHANGED');
      }
      const p = products.find(p => p.name === 'Sobrebarriga');
      ensure(p.attributes?.some(a => a.attributeName === 'Seleccion' && a.options.includes('Asada') && a.options.includes('En Salsa')), 'REQUIRED_ATTRIBUTES_CHANGED');
      for (const name of ['1 Pollo Frito', '1 Pollo Broaster']) ensure(products.find(p => p.name === name)?.attributes?.some(a =>
        a.attributeName === 'Arepas' && a.options.includes('Fritas') && a.options.includes('Blancas')), 'REQUIRED_ATTRIBUTES_CHANGED');
      ensure(products.find(p => p.name === 'Mojarra')?.attributes?.some(a => a.attributeName === 'Seleccion' &&
        a.options.includes('Asada')), 'REQUIRED_ATTRIBUTES_CHANGED');
      if (resumeKnownDraft) ensure(cartMatches(knownVariantDraft(products), initial.sessionData.cart), 'KNOWN_FAILED_DRAFT_CHANGED');
      if (resumeCollapsedDraft) ensure(cartMatches(knownCollapsedVariantDraft(products), initial.sessionData.cart), 'KNOWN_FAILED_DRAFT_CHANGED');
      if (resumeRemovalDraft) ensure(cartMatches(knownVariantRemovalDraft(products), initial.sessionData.cart), 'KNOWN_FAILED_DRAFT_CHANGED');
      if (resumeNoteDraft) ensure(cartMatches(knownDishNoteDraft(products), initial.sessionData.cart), 'KNOWN_FAILED_DRAFT_CHANGED');
    })) return report;
    if (report.mode === 'preflight') { report.ok = true; return report; }
    const plan = resumeKnownDraft ? buildKnownVariantResumePlan(products) :
      resumeCollapsedDraft ? buildCollapsedVariantResumePlan(products) :
      resumeRemovalDraft ? buildVariantRemovalResumePlan(products) :
      resumeNoteDraft ? buildDishNoteResumePlan(products) : buildPlan(products);
    report.expectedSteps = plan.length;
    let current = initial, lastPayload, lastSent = 0;
    const runId = randomUUID();
    for (const step of plan) {
      report.activeStep = step.id;
      const before = await detail(); unchangedIdentity(before);
      ensure(JSON.stringify(before.sessionData) === JSON.stringify(current.sessionData) &&
        JSON.stringify(before.messages) === JSON.stringify(current.messages), 'CONCURRENT_CHAT_ACTIVITY');
      const previousIds = new Set(before.messages.map(m => String(m.id)));
      const wait = Math.max(0, 60000 / rateLimit + 1000 - (now() - lastSent));
      if (wait) await sleep(wait);
      ensure(report.webhookPosts < plan.length, 'WEBHOOK_BUDGET_EXCEEDED');
      const payload = step.duplicatePrevious ? lastPayload : JSON.stringify({ object: 'whatsapp_business_account',
        entry: [{ changes: [{ field: 'messages', value: { messaging_product: 'whatsapp',
          metadata: { phone_number_id: channel }, messages: [{ from: recipient,
            id: `wamid.ppp-staging-${runId}-${step.id}`, timestamp: String(Math.floor(now() / 1000)),
            type: 'text', text: { body: step.text } }] } }] }] });
      ensure(payload, 'DUPLICATE_WITHOUT_PREVIOUS_MESSAGE');
      lastSent = now(); report.webhookPosts++;
      const r = await request('/api/whatsapp/webhook', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(payload) }, body: payload });
      ensure(r.status === 200 && (await r.json()).ok === true, 'WEBHOOK_HTTP_FAILED_NO_RETRY');
      lastPayload = payload;
      current = await detail(); unchangedIdentity(current);
      const messages = current.messages.filter(m => !previousIds.has(String(m.id)));
      const incoming = messages.filter(m => m.direction === 'in');
      const outgoing = messages.filter(m => m.direction === 'out');
      if (step.duplicatePrevious) {
        ensure(messages.length === 0 && JSON.stringify(current.sessionData) === JSON.stringify(before.sessionData), 'DUPLICATE_PROCESSED_TWICE');
      } else {
        ensure(incoming.length === 1 && incoming[0].body === step.text, 'MISSING_OR_CONCURRENT_INBOUND');
        ensure(outgoing.length >= 1 && outgoing.every(m => m.sentBy === 'bot' && m.body?.trim()), 'BOT_REPLY_NOT_PERSISTED_OR_MANUAL_INTERFERENCE');
        ensure(outgoing.every(m => m.body.length <= 600), 'REPLY_TOO_LONG');
        const reply = normalize(outgoing.map(m => m.body).join(' '));
        if (step.reply === 'meat') ensure(reply.includes('churrasco') && /38[.,]?000/.test(reply) &&
          (reply.includes('sobrebarriga') || reply.includes('costilla')), 'MEAT_INQUIRY_FACTS_FAILED');
        if (step.reply === 'ribs') ensure(reply.includes('yuca') && /\bno\b/.test(reply) && reply.includes('ensalada'), 'RIBS_COMPOSITION_FACTS_FAILED');
      }
      const pass = cartMatches(step.cart, current.sessionData.cart);
      if (typeof step.pendingQuantity === 'number') ensure(current.sessionData.pendingCartQuantity?.quantity === step.pendingQuantity &&
        current.sessionData.pendingCartQuantity.options?.length === 2, 'QUANTITY_AMBIGUITY_NOT_PERSISTED');
      if (step.pendingQuantity === false) ensure(!current.sessionData.pendingCartQuantity, 'QUANTITY_CHOICE_NOT_CLEARED');
      report.steps.push({ id: step.id, pass, inboundCount: incoming.length, outboundCount: outgoing.length,
        expectedCartLines: step.cart.length, actualCartLines: current.sessionData.cart.length });
      ensure(pass, 'PERSISTED_CART_DOES_NOT_MATCH_EXPECTED_LINES_ATTRIBUTES_NOTES_PRICE');
    }
    delete report.activeStep;
    report.ok = report.steps.length === report.expectedSteps && report.steps.every(s => s.pass);
  } catch (error) {
    report.checks.push({ name: 'conversation_execution', pass: false,
      code: error instanceof CheckError ? error.code : 'EXECUTION_FAILED_NO_RETRY' });
  } finally {
    if (cookie) {
      const logout = await check('logout', async () => {
        const r = await admin('/api/auth/logout', { method: 'POST' });
        ensure([200, 201].includes(r.status), 'LOGOUT_FAILED');
        ensure(['access_token', 'refresh_token'].every(name => r.headers.getSetCookie().some(v =>
          v.startsWith(`${name}=;`) && /Expires=/i.test(v))), 'LOGOUT_COOKIES_NOT_CLEARED');
      });
      cookie = ''; if (!logout) report.ok = false;
    }
    report.httpRequests = requests;
  }
  return report;
}

module.exports = { runRehearsal, cartMatches };
if (require.main === module) {
  runRehearsal().then(report => {
    const fs = require('node:fs'); fs.mkdirSync('tmp', { recursive: true });
    fs.writeFileSync('tmp/ppp-staging-chat-report.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report)); process.exitCode = report.ok ? 0 : 1;
  }).catch(() => { console.error('STAGING_CHAT_REHEARSAL_FAILED'); process.exitCode = 1; });
}
