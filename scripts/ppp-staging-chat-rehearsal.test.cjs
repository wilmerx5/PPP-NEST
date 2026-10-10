'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { runRehearsal, cartMatches } = require('./ppp-staging-chat-rehearsal.cjs');
const { buildPlan, knownVariantDraft, buildKnownVariantResumePlan,
  knownCollapsedVariantDraft, buildCollapsedVariantResumePlan } = require('./ppp-staging-chat-plan.cjs');
const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'wilmerx5/PPP-NEST',
  GITHUB_REF: 'refs/heads/fix/whatsapp-regression-baseline', GITHUB_EVENT_NAME: 'push',
  STAGING_CHAT_EXECUTE: 'true', STAGING_ADMIN_EMAIL: 'automation@example.invalid',
  STAGING_ADMIN_PASSWORD: 'synthetic-password', STAGING_WHATSAPP_APP_SECRET: 'synthetic-app-secret',
  STAGING_WHATSAPP_PHONE_NUMBER_ID: '12345', STAGING_WHATSAPP_RECIPIENTS: '573001234567' };
const products = [
  { id: 17, name: 'Churrasco', price: '38000.00', isActive: true, availableNow: true, attributes: [] },
  { id: 13, name: 'Sobrebarriga', price: '33000.00', isActive: true, availableNow: true,
    attributes: [{ attributeName: 'Seleccion', options: ['Asada', 'En Salsa'] }] },
  { id: 60, name: 'Costillas De Cerdo', price: '29500.00', isActive: true, availableNow: true, attributes: [] },
  { id: 14, name: 'Mojarra', price: '29500.00', isActive: true, availableNow: true,
    attributes: [{ attributeName: 'Seleccion', options: ['Frita', 'Asada'] }] },
  ...[[1, '1 Pollo Frito', '41000.00'], [4, '1 Pollo Broaster', '43000.00']].map(([id, name, price]) =>
    ({ id, name, price, isActive: true, availableNow: true, attributes: [{ attributeName: 'Arepas', options: ['Blancas', 'Fritas'] }] })),
];
function fixture(options = {}) {
  let clock = Date.parse('2026-10-09T21:31:00Z'), nextId = 2, seen = new Set(), sentTexts = [], simulatedStepIndex = 0;
  const calls = [], plan = options.resumeKnownDraft ? buildKnownVariantResumePlan(products) :
    options.resumeCollapsedDraft ? buildCollapsedVariantResumePlan(products) : buildPlan(products);
  const conversation = { id: 42, waId: env.STAGING_WHATSAPP_RECIPIENTS, phoneE164: '+' + env.STAGING_WHATSAPP_RECIPIENTS,
    humanTakeover: false, state: 'building_cart', customerName: null,
    sessionData: { cart: options.existingDraft ? [{ productId: 17, quantity: 1 }] : [] },
    messages: [{ id: 1, direction: 'in', body: 'Hola', createdAt: new Date(clock).toISOString(), sentBy: 'bot' }] };
  if (options.resumeKnownDraft) {
    conversation.messages[0].body = options.changedDraftInput ? 'Nuevo mensaje humano' : 'Solo era una sobrebarriga asada';
    conversation.sessionData.cart = knownVariantDraft(products).map(line => ({ productId: line.productId,
      quantity: line.quantity, unitPrice: line.unitPrice, attributes: line.attrs, note: line.note.join('. ') }));
    if (options.changedDraftQuantity) conversation.sessionData.cart[0].quantity = 7;
  }
  if (options.resumeCollapsedDraft) {
    conversation.messages[0].body = options.changedDraftInput ? 'Nuevo mensaje humano' :
      'Quiero un churrasco sin ensalada y dos sobrebarrigas: una asada y otra en salsa.';
    conversation.sessionData.cart = knownCollapsedVariantDraft(products).map(line => ({ productId: line.productId,
      quantity: line.quantity, unitPrice: line.unitPrice, attributes: line.attrs, note: line.note.join('. ') }));
    if (options.changedDraftQuantity) conversation.sessionData.cart[1].quantity = 5;
    if (options.changedDraftPending) conversation.sessionData.pendingAttribute = { productId: 13 };
  }
  const json = (body, status = 200, cookie) => {
    const payload = body === conversation && options.bigintMessageIds ? { ...body, messages: body.messages.map(m =>
      ({ ...m, id: String(9007199254740993n + BigInt(m.id)) })) } : body;
    const r = new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
    if (cookie) r.headers.append('Set-Cookie', cookie);
    return r;
  };
  const fetch = async (url, opts) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    assert.equal(new URL(url).origin, 'https://dev.prontopolloportal.com');
    assert.equal(opts.redirect, 'manual');
    const path = new URL(url).pathname;
    if (path === '/api/health') return json({ status: 'ok', db: 'connected' });
    if (path === '/api/auth/login') return json({ requires2FA: false, user: { email: env.STAGING_ADMIN_EMAIL, roles: ['admin'] } }, 201,
      `access_token=synthetic-cookie; HttpOnly; Secure; SameSite=Lax${options.unsafeCookie ? '; Domain=prontopolloportal.com' : ''}`);
    if (path === '/api/auth/logout') {
      const r = json({}, 201); for (const name of ['access_token', 'refresh_token']) r.headers.append('Set-Cookie', `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT`); return r;
    }
    assert.ok(!path.startsWith('/api/admin/') || opts.headers.Cookie === 'access_token=synthetic-cookie');
    if (path === '/api/admin/whatsapp/staging/test-target') return options.missingEndpoint ? json({}, 404) : json({
      staging: !options.notStaging, targetMatches: !options.wrongTarget, botEnabled: true,
      conversationTestVersion: options.oldDeployment ? undefined : '2026-10-10.cart-v3',
      agentEnabled: true, approvedModel: true, credentialsPresent: true, rateLimitPerMinute: 25 }, 201);
    if (path === '/api/admin/whatsapp/conversations') return json([{ id: 42, phoneE164: conversation.phoneE164 }]);
    if (path === '/api/admin/whatsapp/conversations/42') return json(conversation);
    if (path === '/api/products') return json(products);
    if (path === '/api/whatsapp/webhook') {
      const signature = 'sha256=' + createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET).update(opts.body).digest('hex');
      assert.equal(opts.headers['X-Hub-Signature-256'], signature);
      const msg = JSON.parse(opts.body).entry[0]?.changes[0]?.value?.messages[0];
      if (!msg) {
        if (options.signatureMismatch) return json({ ok: false, error: 'invalid_signature' }, 401);
        if (options.rawBodyMissing) return json({ ok: false, error: 'raw_body_missing' }, 401);
        return json({ ok: true });
      }
      assert.equal(msg.from, env.STAGING_WHATSAPP_RECIPIENTS);
      if (options.timeout) throw Error('synthetic transport error with sensitive response text');
      const duplicate = seen.has(msg.id);
      if (duplicate && !options.breakDedup) return json({ ok: true });
      seen.add(msg.id); sentTexts.push(msg.text.body);
      while (plan[simulatedStepIndex]?.duplicatePrevious) simulatedStepIndex++;
      const step = duplicate ? plan[simulatedStepIndex - 2] : plan[simulatedStepIndex++];
      assert.equal(step.text, msg.text.body);
      conversation.sessionData.cart = step.cart.map(want => ({ productId: want.productId, quantity: want.quantity,
        unitPrice: want.unitPrice, attributes: want.attrs, note: want.note.join('. ') }));
      if (typeof step.pendingQuantity === 'number' && !options.breakQuantityQuestion) conversation.sessionData.pendingCartQuantity =
        { quantity: step.pendingQuantity, options: [{ cartIndex: 2 }, { cartIndex: 3 }] };
      if (step.pendingQuantity === false && !options.breakQuantityChoice) delete conversation.sessionData.pendingCartQuantity;
      if (options.wrongCart && step.id === 'multiple-products-variants-note') conversation.sessionData.cart[0].quantity = 7;
      if (options.nameContamination && step.id === 'multiple-products-variants-note') conversation.customerName = 'Sin ensalada';
      if (options.orderCreation && step.id === 'multiple-products-variants-note') conversation.state = 'completed';
      conversation.messages.push({ id: nextId++, direction: 'in', body: msg.text.body, createdAt: new Date(clock).toISOString(), sentBy: 'bot' });
      if (options.concurrentHuman) conversation.messages.push({ id: nextId++, direction: 'in', body: 'Mensaje humano', createdAt: new Date(clock).toISOString(), sentBy: 'bot' });
      const reply = step.reply === 'meat' ? 'Churrasco $38.000 y sobrebarriga $33.000.' : step.reply === 'ribs' ? 'No incluyen ensalada: traen yuca frita, papa francesa y arroz.' : 'Listo, anotado.';
      conversation.messages.push({ id: nextId++, direction: 'out', body: reply, createdAt: new Date(clock).toISOString(), sentBy: 'bot' });
      return json({ ok: true });
    }
    throw Error('unexpected path');
  };
  return { fetch, calls, sentTexts, helpers: { now: () => clock, sleep: async ms => { clock += ms; } } };
}

test('executes 21 bounded steps, validates HMAC, checks persisted cart and clears its successful draft', async () => {
  const f = fixture(); const report = await runRehearsal(env, f.fetch, f.helpers);
  assert.equal(report.ok, true); assert.equal(report.steps.length, 21); assert.equal(report.webhookPosts, 21);
  assert.ok(report.steps.every(s => s.pass)); assert.equal(report.steps.at(-1).actualCartLines, 0);
  assert.equal(f.sentTexts.length, 20); // Duplicate does not process again.
  assert.ok(f.sentTexts.every(text => !/^confirmar$/i.test(text)));
  const output = JSON.stringify(report);
  for (const value of ['synthetic-password', 'synthetic-app-secret', 'synthetic-cookie', env.STAGING_WHATSAPP_RECIPIENTS, env.STAGING_ADMIN_EMAIL]) assert.ok(!output.includes(value));
});
test('preflight verifies routing and signature without sending message payloads', async () => {
  const f = fixture(); const report = await runRehearsal({ ...env, STAGING_CHAT_EXECUTE: 'false' }, f.fetch, f.helpers);
  assert.equal(report.ok, true); assert.equal(report.webhookPosts, 0); assert.equal(f.sentTexts.length, 0);
});
test('resumes only the known failed draft, rechecks both failures and all remaining edits in 23 steps', async () => {
  const f = fixture({ resumeKnownDraft: true });
  const report = await runRehearsal({ ...env, STAGING_CHAT_RESUME: 'known-variant-draft' }, f.fetch, f.helpers);
  assert.equal(report.ok, true); assert.equal(report.steps.length, 23);
  assert.equal(report.webhookPosts, 23); assert.equal(report.steps.at(-1).actualCartLines, 0);
  assert.ok(!f.sentTexts.includes('Hola, ¿qué tienen para almorzar? ¿Hay algo con carne?'));
  assert.ok(report.steps.every(step => step.pass));
});
for (const option of ['changedDraftInput', 'changedDraftQuantity']) {
  test(`preserves the failed draft without sending when ${option}`, async () => {
    const f = fixture({ resumeKnownDraft: true, [option]: true });
    const report = await runRehearsal({ ...env, STAGING_CHAT_RESUME: 'known-variant-draft' }, f.fetch, f.helpers);
    assert.equal(report.ok, false); assert.equal(report.webhookPosts, 0);
    assert.equal(report.checks.find(check => !check.pass).code, 'KNOWN_FAILED_DRAFT_CHANGED');
  });
}
test('requires the deployed cart patch version before sending any conversation', async () => {
  const f = fixture({ oldDeployment: true }); const report = await runRehearsal(env, f.fetch, f.helpers);
  assert.equal(report.ok, false); assert.equal(report.webhookPosts, 0);
  assert.equal(report.checks.find(check => !check.pass).code, 'CURRENT_CART_PATCHES_NOT_DEPLOYED');
});
test('resets only the verified collapsed synthetic draft and runs 20 pending steps', async () => {
  const f = fixture({ resumeCollapsedDraft: true });
  const report = await runRehearsal({ ...env, STAGING_CHAT_RESUME: 'known-collapsed-variant-draft' }, f.fetch, f.helpers);
  assert.equal(report.ok, true); assert.equal(report.webhookPosts, 20); assert.equal(report.steps.length, 20);
  assert.equal(report.steps.at(-1).actualCartLines, 0);
  assert.ok(!f.sentTexts.includes('¿Las costillas de cerdo traen ensalada?'));
});
for (const option of ['changedDraftInput', 'changedDraftQuantity', 'changedDraftPending']) {
  test(`does not reset the collapsed draft when ${option}`, async () => {
    const f = fixture({ resumeCollapsedDraft: true, [option]: true });
    const report = await runRehearsal({ ...env, STAGING_CHAT_RESUME: 'known-collapsed-variant-draft' }, f.fetch, f.helpers);
    assert.equal(report.ok, false); assert.equal(report.webhookPosts, 0); assert.equal(f.sentTexts.length, 0);
    assert.equal(report.checks.find(check => !check.pass).code, 'KNOWN_FAILED_DRAFT_CHANGED');
  });
}
test('accepts the real bigint string message IDs without losing precision during deduplication', async () => {
  const f = fixture({ bigintMessageIds: true });
  const report = await runRehearsal(env, f.fetch, f.helpers);
  assert.equal(report.ok, true); assert.equal(report.steps.length, 21);
  assert.equal(report.steps.find(s => s.id === 'duplicate-webhook').inboundCount, 0);
});
test('distinguishes mismatched secret from missing raw body without exposing the response', async () => {
  for (const [option, code] of [['signatureMismatch', 'APP_SECRET_MISMATCH'], ['rawBodyMissing', 'WEBHOOK_RAW_BODY_MISSING']]) {
    const f = fixture({ [option]: true }); const report = await runRehearsal(env, f.fetch, f.helpers);
    assert.equal(report.webhookSignatureHttpStatus, 401);
    assert.equal(report.checks.find(c => !c.pass).code, code);
    assert.equal(report.webhookPosts, 0);
  }
});
for (const option of ['missingEndpoint', 'notStaging', 'wrongTarget', 'unsafeCookie', 'existingDraft', 'signatureMismatch']) {
  test(`blocks all conversation messages when ${option}`, async () => {
    const f = fixture({ [option]: true }); const report = await runRehearsal(env, f.fetch, f.helpers);
    assert.equal(report.ok, false); assert.equal(report.webhookPosts, 0); assert.equal(f.sentTexts.length, 0);
    assert.ok(report.checks.some(c => !c.pass));
    assert.equal(f.calls.at(-1).url.endsWith('/api/auth/logout'), true);
  });
}
for (const option of ['wrongCart', 'breakDedup', 'concurrentHuman', 'nameContamination', 'orderCreation', 'breakQuantityQuestion', 'breakQuantityChoice']) {
  test(`fails closed on ${option} without continuing or clearing the failure`, async () => {
    const f = fixture({ [option]: true }); const report = await runRehearsal(env, f.fetch, f.helpers);
    assert.equal(report.ok, false); assert.ok(report.webhookPosts < 21);
    assert.ok(!f.sentTexts.includes('Vacía el carrito y empieza de cero.'));
    assert.ok(report.activeStep);
  });
}
test('does not retry an ambiguous webhook transport failure', async () => {
  const f = fixture({ timeout: true }); const report = await runRehearsal(env, f.fetch, f.helpers);
  assert.equal(report.ok, false); assert.equal(report.webhookPosts, 1);
  assert.equal(f.calls.filter(c => c.url.endsWith('/webhook') && JSON.parse(c.body).entry.length).length, 1);
  assert.ok(!JSON.stringify(report).includes('sensitive response text'));
});
test('requires the approved repository and branch, TLS and a single recipient before any network', async () => {
  for (const patch of [{ GITHUB_REF: 'refs/heads/Main' }, { GITHUB_REPOSITORY: 'other/repo' },
    { GITHUB_EVENT_NAME: 'pull_request' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { STAGING_WHATSAPP_RECIPIENTS: '573001234567,573009999999' }]) {
    const f = fixture(); const r = await runRehearsal({ ...env, ...patch }, f.fetch, f.helpers);
    assert.equal(r.ok, false); assert.equal(f.calls.length, 0);
  }
});
test('cart oracle matches variants one-to-one and rejects quantity, price, attrs and note changes', () => {
  const want = [{ productId: 13, quantity: 1, unitPrice: 33000, attrs: [{ attributeName: 'Seleccion', attributeValue: 'Asada' }], note: ['sin ensalada'], forbidNote: ['crocantes'] }];
  const line = { productId: 13, quantity: 1, unitPrice: 33000, attributes: want[0].attrs, note: 'Sin ensalada' };
  assert.equal(cartMatches(want, [line]), true);
  for (const patch of [{ quantity: 2 }, { unitPrice: 1 }, { attributes: [] }, { note: 'Sin ensalada. Crocantes' }]) assert.equal(cartMatches(want, [{ ...line, ...patch }]), false);
  assert.equal(cartMatches([...want, ...want], [line]), false);
  assert.equal(cartMatches([{ ...want[0], note: [] }], [line]), false);
});
