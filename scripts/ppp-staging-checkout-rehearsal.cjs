'use strict';

const { createHmac, randomUUID } = require('node:crypto');

const TARGET = 'https://dev.prontopolloportal.com';
const normalize = value =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const digits = value => String(value || '').replace(/\D/g, '');
const hasPendingState = sessionData =>
  Object.entries(sessionData || {}).some(
    ([key, value]) => key.startsWith('pending') && value != null,
  );

class CheckError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const ensure = (condition, code) => {
  if (!condition) throw new CheckError(code);
};

async function runCheckoutRehearsal(
  env = process.env,
  fetchImpl = globalThis.fetch,
  helpers = {},
) {
  const now = helpers.now || Date.now;
  const sleep = helpers.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const report = {
    ok: false,
    mode: env.STAGING_CHECKOUT_EXECUTE === 'true' ? 'execute' : 'preflight',
    checks: [],
    steps: [],
    webhookPosts: 0,
    limits:
      'Authorized synthetic signed inbound events, real staging persistence and Meta outbound. Checkout stops before order confirmation. No order, payment preference or kitchen event is intentionally created.',
  };

  let cookie = '';
  let requests = 0;
  let startedAt = now();
  let recipient = '';
  let channel = '';
  let conversationId;
  let rateLimit = 25;
  let lastSent = 0;
  let lastPayload = null;
  let baselineOrderIds = new Set();
  const resumeFailedSoup =
    env.STAGING_CHECKOUT_RESUME === 'known-failed-soup-phrase';

  const check = async (name, work) => {
    try {
      await work();
      report.checks.push({ name, pass: true });
      return true;
    } catch (error) {
      report.checks.push({
        name,
        pass: false,
        code: error instanceof CheckError ? error.code : 'REQUEST_FAILED',
      });
      return false;
    }
  };

  const request = async (path, options = {}) => {
    const url = new URL(path, TARGET);
    ensure(url.origin === TARGET && url.pathname.startsWith('/api/'), 'TARGET_NOT_ALLOWED');
    ensure(++requests <= 90 && now() - startedAt < 480000, 'HTTP_OR_TIME_BUDGET_EXCEEDED');
    const response = await fetchImpl(url.href, {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(45000),
    });
    ensure(response.status < 300 || response.status >= 400, 'REDIRECT_REJECTED');
    return response;
  };

  const admin = (path, options = {}) =>
    request(path, {
      ...options,
      headers: { ...options.headers, Cookie: cookie },
    });

  const detail = async () => {
    const response = await admin(`/api/admin/whatsapp/conversations/${conversationId}`);
    ensure(response.status === 200, 'CONVERSATION_READ_FAILED');
    const body = await response.json();
    ensure(
      body.id === conversationId &&
        digits(body.phoneE164) === recipient &&
        digits(body.waId) === recipient,
      'CONVERSATION_RECIPIENT_MISMATCH',
    );
    ensure(
      Array.isArray(body.messages) && Array.isArray(body.sessionData?.cart),
      'CONVERSATION_DETAIL_INVALID',
    );
    ensure(
      new Set(body.messages.map(message => String(message.id))).size === body.messages.length,
      'DUPLICATE_MESSAGE_IDS',
    );
    return body;
  };

  const authorizedOrderIds = async () => {
    const response = await admin('/api/orders/daily');
    ensure(response.status === 200, 'DAILY_ORDERS_READ_FAILED');
    const body = await response.json();
    const orders = Array.isArray(body) ? body : body?.orders;
    ensure(Array.isArray(orders), 'DAILY_ORDERS_INVALID');
    return new Set(
      orders
        .filter(order => digits(order.phone) === recipient)
        .map(order => String(order.orderId ?? order.id))
        .filter(Boolean),
    );
  };

  const assertNoNewOrder = async () => {
    const current = await authorizedOrderIds();
    ensure(
      [...current].every(id => baselineOrderIds.has(id)),
      'UNEXPECTED_STAGING_ORDER_CREATED',
    );
  };

  try {
    if (
      !(await check('authorized_context', async () => {
        ensure(
          env.GITHUB_ACTIONS === 'true' &&
            env.GITHUB_REPOSITORY === 'wilmerx5/PPP-NEST' &&
            env.GITHUB_REF === 'refs/heads/fix/whatsapp-regression-baseline' &&
            ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME),
          'UNAPPROVED_EXECUTION_CONTEXT',
        );
        ensure(env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS_VERIFICATION_REQUIRED');
        ensure(
          !env.STAGING_CHECKOUT_EXECUTE ||
            ['true', 'false'].includes(env.STAGING_CHECKOUT_EXECUTE),
          'INVALID_EXECUTION_MODE',
        );
        ensure(
          !env.STAGING_CHECKOUT_RESUME ||
            env.STAGING_CHECKOUT_RESUME === 'known-failed-soup-phrase',
          'INVALID_RESUME_MODE',
        );
        ensure(
          [
            'STAGING_ADMIN_EMAIL',
            'STAGING_ADMIN_PASSWORD',
            'STAGING_WHATSAPP_APP_SECRET',
            'STAGING_WHATSAPP_PHONE_NUMBER_ID',
            'STAGING_WHATSAPP_RECIPIENTS',
          ].every(key => env[key]?.trim()),
          'REQUIRED_SECRET_MISSING',
        );
        const recipients = env.STAGING_WHATSAPP_RECIPIENTS.split(',').map(digits);
        ensure(
          recipients.length === 1 && /^\d{8,15}$/.test(recipients[0]),
          'SINGLE_TEST_RECIPIENT_REQUIRED',
        );
        recipient = recipients[0];
        channel = env.STAGING_WHATSAPP_PHONE_NUMBER_ID.trim();
        ensure(/^\d{5,30}$/.test(channel), 'INVALID_TEST_CHANNEL');
      }))
    ) {
      return report;
    }

    if (
      !(await check('health_database', async () => {
        const response = await request('/api/health');
        ensure(response.status === 200, 'HEALTH_HTTP_FAILED');
        const body = await response.json();
        ensure(body.status === 'ok' && body.db === 'connected', 'DATABASE_NOT_CONNECTED');
      }))
    ) {
      return report;
    }

    if (
      !(await check('staging_admin_login', async () => {
        const response = await request('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: env.STAGING_ADMIN_EMAIL.trim(),
            password: env.STAGING_ADMIN_PASSWORD,
          }),
        });
        ensure([200, 201].includes(response.status), 'LOGIN_REJECTED');
        const body = await response.json();
        const access = response.headers
          .getSetCookie()
          .find(value => value.startsWith('access_token='));
        if (access) cookie = access.split(';', 1)[0];
        ensure(
          body.requires2FA === false &&
            body.user?.roles?.includes('admin') &&
            body.user.email?.toLowerCase() ===
              env.STAGING_ADMIN_EMAIL.trim().toLowerCase(),
          'WRONG_TEST_ADMIN_OR_2FA',
        );
        const domain = access
          ?.match(/;\s*Domain=([^;]+)/i)?.[1]
          ?.toLowerCase()
          .replace(/^\./, '');
        ensure(
          access &&
            /;\s*Secure(?:;|$)/i.test(access) &&
            /;\s*HttpOnly(?:;|$)/i.test(access) &&
            (!domain || domain === 'dev.prontopolloportal.com'),
          'UNSAFE_ADMIN_COOKIE',
        );
      }))
    ) {
      return report;
    }

    if (
      !(await check('effective_staging_target', async () => {
        const response = await admin('/api/admin/whatsapp/staging/test-target', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumberId: channel, recipient }),
        });
        ensure([200, 201].includes(response.status), 'TARGET_VERIFICATION_FAILED');
        const body = await response.json();
        ensure(
          body.staging === true &&
            body.targetMatches === true &&
            body.botEnabled === true &&
            body.agentEnabled === true &&
            body.approvedModel === true &&
            body.credentialsPresent === true,
          'STAGING_TARGET_NOT_READY',
        );
        ensure(
          typeof body.conversationTestVersion === 'string' &&
            body.conversationTestVersion.startsWith('2026-10-10.cart-v'),
          'CHECKOUT_PATCH_LEVEL_NOT_DEPLOYED',
        );
        ensure(
          Number.isInteger(body.rateLimitPerMinute) &&
            body.rateLimitPerMinute >= 5 &&
            body.rateLimitPerMinute <= 120,
          'INVALID_RATE_LIMIT',
        );
        rateLimit = body.rateLimitPerMinute;
      }))
    ) {
      return report;
    }

    const sign = payload =>
      `sha256=${createHmac('sha256', env.STAGING_WHATSAPP_APP_SECRET.trim())
        .update(payload)
        .digest('hex')}`;

    if (
      !(await check('signed_webhook_preflight', async () => {
        const payload = JSON.stringify({
          object: 'whatsapp_business_account',
          entry: [],
        });
        const response = await request('/api/whatsapp/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': sign(payload),
          },
          body: payload,
        });
        ensure(
          response.status === 200 && (await response.json()).ok === true,
          'SIGNED_WEBHOOK_HTTP_FAILED',
        );
      }))
    ) {
      return report;
    }

    let current;
    let soup;
    if (
      !(await check('clean_authorized_conversation', async () => {
        const listResponse = await admin('/api/admin/whatsapp/conversations');
        ensure(listResponse.status === 200, 'CONVERSATION_LIST_FAILED');
        const list = await listResponse.json();
        ensure(Array.isArray(list), 'INVALID_CONVERSATION_LIST');
        const matches = list.filter(row => digits(row.phoneE164) === recipient);
        ensure(
          matches.length === 1 && Number.isSafeInteger(matches[0].id),
          'TEST_CONVERSATION_MISSING_OR_AMBIGUOUS',
        );
        conversationId = matches[0].id;
        current = await detail();
        const lastInbound = current.messages
          .filter(message => message.direction === 'in')
          .at(-1);
        report.conversationSnapshot = {
          state: String(current.state || ''),
          humanTakeover: current.humanTakeover === true,
          cart: current.sessionData.cart.map(line => ({
            productId: Number(line.productId),
            quantity: Number(line.quantity),
          })),
          pendingKeys: Object.entries(current.sessionData)
            .filter(
              ([key, value]) => key.startsWith('pending') && value != null,
            )
            .map(([key]) => key)
            .sort(),
          pendingMatch: current.sessionData.pendingMatch
            ? {
                quantity: Number(current.sessionData.pendingMatch.quantity),
                candidateProductIds: Array.isArray(
                  current.sessionData.pendingMatch.candidates,
                )
                  ? current.sessionData.pendingMatch.candidates.map(candidate =>
                      Number(candidate.id),
                    )
                  : [],
              }
            : null,
          hasAddress: Boolean(current.sessionData.address),
          hasPaymentMethod: Boolean(current.sessionData.paymentMethod),
          lastInboundMatchesFailedSoup:
            lastInbound?.body === 'Una sopa de ajiaco',
          lastInboundAgeSeconds: Number.isFinite(
            Date.parse(lastInbound?.createdAt),
          )
            ? Math.max(
                0,
                Math.round((now() - Date.parse(lastInbound.createdAt)) / 1000),
              )
            : null,
        };
        if (resumeFailedSoup) {
          ensure(
            current.state === 'building_cart' &&
              current.humanTakeover === false &&
              current.sessionData.cart.length === 0 &&
              current.sessionData.pendingMatch?.quantity === 1 &&
              Array.isArray(current.sessionData.pendingMatch?.candidates) &&
              current.sessionData.pendingMatch.candidates.some(
                candidate => candidate.name === 'Sopa De Ajiaco',
              ) &&
              !current.sessionData.address &&
              !current.sessionData.paymentMethod &&
              lastInbound?.body === 'Una sopa de ajiaco',
            'KNOWN_FAILED_SOUP_STATE_CHANGED',
          );
        } else {
          ensure(
            current.state === 'building_cart' &&
              current.humanTakeover === false &&
              current.sessionData.cart.length === 0 &&
              !hasPendingState(current.sessionData) &&
              !current.sessionData.address &&
              !current.sessionData.paymentMethod,
            'TEST_CHAT_NOT_CLEAN',
          );
        }
        const recentInbound = current.messages.some(
          message =>
            message.direction === 'in' &&
            Number.isFinite(Date.parse(message.createdAt)) &&
            now() - Date.parse(message.createdAt) >= 0 &&
            now() - Date.parse(message.createdAt) < 23 * 3600000,
        );
        ensure(recentInbound, 'RECENT_TEST_CHAT_REQUIRED_META_WINDOW_NOT_GUARANTEED');
      }))
    ) {
      return report;
    }

    if (
      !(await check('catalog_and_order_baseline', async () => {
        const productsResponse = await request('/api/products');
        ensure(productsResponse.status === 200, 'CATALOG_HTTP_FAILED');
        const products = await productsResponse.json();
        ensure(Array.isArray(products), 'INVALID_CATALOG');
        soup = products.find(product => product.name === 'Sopa De Ajiaco');
        report.catalogSnapshot = products
          .filter(
            product =>
              product.id === 38 ||
              normalize(product.name).includes('sopa de ajiaco'),
          )
          .map(product => ({
            id: Number(product.id),
            name: String(product.name || ''),
            price: Number(product.price),
            isActive: product.isActive === true,
            availableNow: product.availableNow === true,
          }));
        ensure(
          soup &&
            Number.isSafeInteger(soup.id) &&
            soup.isActive === true &&
            soup.availableNow === true &&
            Number(soup.price) === 10500,
          'REQUIRED_SOUP_UNAVAILABLE_OR_CHANGED',
        );
        baselineOrderIds = await authorizedOrderIds();
      }))
    ) {
      return report;
    }

    if (report.mode === 'preflight') {
      report.ok = true;
      return report;
    }

    const runId = randomUUID();
    const send = async ({
      id,
      text,
      duplicate = false,
      expectReply = true,
      validate,
      allowTakeover = false,
    }) => {
      report.activeStep = id;
      const before = await detail();
      ensure(
        allowTakeover || before.humanTakeover === false,
        'UNEXPECTED_HUMAN_TAKEOVER',
      );
      ensure(
        JSON.stringify(before.sessionData) === JSON.stringify(current.sessionData) &&
          JSON.stringify(before.messages) === JSON.stringify(current.messages),
        'CONCURRENT_CHAT_ACTIVITY',
      );
      const previousIds = new Set(before.messages.map(message => String(message.id)));
      const wait = Math.max(0, 60000 / rateLimit + 1000 - (now() - lastSent));
      if (wait) await sleep(wait);
      const payload = duplicate
        ? lastPayload
        : JSON.stringify({
            object: 'whatsapp_business_account',
            entry: [
              {
                changes: [
                  {
                    field: 'messages',
                    value: {
                      messaging_product: 'whatsapp',
                      metadata: { phone_number_id: channel },
                      messages: [
                        {
                          from: recipient,
                          id: `wamid.ppp-staging-checkout-${runId}-${id}`,
                          timestamp: String(Math.floor(now() / 1000)),
                          type: 'text',
                          text: { body: text },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          });
      ensure(payload, 'DUPLICATE_WITHOUT_PREVIOUS_MESSAGE');
      lastSent = now();
      report.webhookPosts++;
      const response = await request('/api/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': sign(payload),
        },
        body: payload,
      });
      ensure(
        response.status === 200 && (await response.json()).ok === true,
        'WEBHOOK_HTTP_FAILED_NO_RETRY',
      );
      if (!duplicate) lastPayload = payload;
      current = await detail();
      const messages = current.messages.filter(
        message => !previousIds.has(String(message.id)),
      );
      const inbound = messages.filter(message => message.direction === 'in');
      const outbound = messages.filter(message => message.direction === 'out');
      if (duplicate) {
        ensure(
          messages.length === 0 &&
            JSON.stringify(current.sessionData) === JSON.stringify(before.sessionData),
          'DUPLICATE_PROCESSED_TWICE',
        );
      } else {
        ensure(
          inbound.length === 1 && inbound[0].body === text,
          'MISSING_OR_CONCURRENT_INBOUND',
        );
        if (expectReply) {
          ensure(
            outbound.length >= 1 &&
              outbound.every(
                message => message.sentBy === 'bot' && message.body?.trim(),
              ),
            'BOT_REPLY_NOT_PERSISTED_OR_MANUAL_INTERFERENCE',
          );
        } else {
          ensure(outbound.length === 0, 'BOT_REPLIED_DURING_HUMAN_TAKEOVER');
        }
      }
      if (validate) validate(current);
      report.steps.push({
        id,
        pass: true,
        inboundCount: inbound.length,
        outboundCount: outbound.length,
        state: current.state,
        cartLines: current.sessionData.cart.length,
      });
      return current;
    };

    if (resumeFailedSoup) {
      await send({
        id: 'reset-known-failed-soup-phrase',
        text: 'Reiniciar',
        validate: body => {
          ensure(
            body.state === 'building_cart' &&
              body.sessionData.cart.length === 0 &&
              !hasPendingState(body.sessionData) &&
              !body.sessionData.address &&
              !body.sessionData.paymentMethod,
            'KNOWN_FAILED_SOUP_NOT_CLEARED',
          );
        },
      });
    }

    const expectSoup = (body, quantity = 2) => {
      ensure(
        body.sessionData.cart.length === 1 &&
          body.sessionData.cart[0].productId === soup.id &&
          body.sessionData.cart[0].quantity === quantity,
        'SOUP_CART_MISMATCH',
      );
    };

    await send({
      id: 'delivery-request-soups',
      text: 'Quiero dos sopas',
      validate: body => {
        ensure(
          body.state === 'building_cart' &&
            body.sessionData.cart.length === 0 &&
            body.sessionData.pendingMatch?.quantity === 2 &&
            body.sessionData.pendingMatch.candidates?.some(
              candidate => candidate.id === soup.id,
            ),
          'DELIVERY_SOUP_CHOICE_NOT_REACHED',
        );
      },
    });
    const deliverySoupRow =
      current.sessionData.pendingMatch.candidates.findIndex(
        candidate => candidate.id === soup.id,
      ) + 1;
    ensure(deliverySoupRow > 0, 'DELIVERY_SOUP_CHOICE_MISSING');
    await send({
      id: 'delivery-select-ajiaco',
      text: String(deliverySoupRow),
      validate: body => {
        expectSoup(body);
        ensure(
          body.state === 'building_cart' && !body.sessionData.pendingMatch,
          'DELIVERY_ADD_STATE_INVALID',
        );
      },
    });
    await send({
      id: 'delivery-finish-items',
      text: 'No más',
      validate: body => {
        expectSoup(body);
        ensure(
          body.state === 'awaiting_address' &&
            body.sessionData.orderType === 'delivery' &&
            body.sessionData.fulfillmentChosen === true,
          'DELIVERY_ADDRESS_STEP_NOT_REACHED',
        );
      },
    });
    await send({
      id: 'delivery-address',
      text: 'Dg 6 b #78 b 20, Castilla, Bogotá',
      validate: body => {
        expectSoup(body);
        ensure(
          body.state === 'awaiting_payment' &&
            body.sessionData.orderType === 'delivery' &&
            body.sessionData.addressConfirmed === true &&
            normalize(body.sessionData.address).includes('castilla') &&
            Number(body.sessionData.deliveryFeeCalculated) >= 0,
          'DELIVERY_ADDRESS_NOT_CONFIRMED_OR_QUOTED',
        );
      },
    });
    await send({
      id: 'delivery-cash',
      text: '1',
      validate: body => {
        expectSoup(body);
        ensure(
          body.state === 'awaiting_final_confirm' &&
            body.sessionData.paymentMethod === 'cash',
          'DELIVERY_FINAL_CONFIRM_NOT_REACHED',
        );
      },
    });
    await send({
      id: 'duplicate-payment-webhook',
      text: '1',
      duplicate: true,
      validate: body => {
        expectSoup(body);
        ensure(
          body.state === 'awaiting_final_confirm',
          'DUPLICATE_CHANGED_CHECKOUT_STATE',
        );
      },
    });
    await assertNoNewOrder();
    await send({
      id: 'reset-delivery-checkout',
      text: 'Reiniciar',
      validate: body => {
        ensure(
          body.state === 'building_cart' &&
            body.sessionData.cart.length === 0 &&
            !body.sessionData.address &&
            !body.sessionData.paymentMethod,
          'DELIVERY_CHECKOUT_NOT_CLEARED',
        );
      },
    });

    await send({
      id: 'pickup-request-soups',
      text: 'Quiero dos sopas',
      validate: body => {
        ensure(
          body.state === 'building_cart' &&
            body.sessionData.cart.length === 0 &&
            body.sessionData.pendingMatch?.quantity === 2 &&
            body.sessionData.pendingMatch.candidates?.some(
              candidate => candidate.id === soup.id,
            ),
          'PICKUP_SOUP_CHOICE_NOT_REACHED',
        );
      },
    });
    const pickupSoupRow =
      current.sessionData.pendingMatch.candidates.findIndex(
        candidate => candidate.id === soup.id,
      ) + 1;
    ensure(pickupSoupRow > 0, 'PICKUP_SOUP_CHOICE_MISSING');
    await send({
      id: 'pickup-select-ajiaco',
      text: String(pickupSoupRow),
      validate: body => {
        expectSoup(body);
        ensure(
          body.state === 'building_cart' && !body.sessionData.pendingMatch,
          'PICKUP_ADD_STATE_INVALID',
        );
      },
    });
    await send({
      id: 'pickup-selection',
      text: 'Paso a recoger',
      validate: body => {
        expectSoup(body);
        ensure(
          body.state === 'building_cart' &&
            body.sessionData.orderType === 'pickup' &&
            body.sessionData.fulfillmentChosen === true,
          'PICKUP_NOT_SELECTED',
        );
      },
    });
    await send({
      id: 'pickup-finish-items',
      text: 'No más',
      validate: body => {
        expectSoup(body);
        ensure(
          body.state === 'awaiting_payment' &&
            body.sessionData.orderType === 'pickup' &&
            body.sessionData.addressConfirmed === true,
          'PICKUP_PAYMENT_STEP_NOT_REACHED',
        );
      },
    });
    await send({
      id: 'pickup-cash',
      text: '1',
      validate: body => {
        expectSoup(body);
        ensure(
          body.state === 'awaiting_final_confirm' &&
            body.sessionData.paymentMethod === 'cash',
          'PICKUP_FINAL_CONFIRM_NOT_REACHED',
        );
      },
    });
    await assertNoNewOrder();
    await send({
      id: 'reset-pickup-checkout',
      text: 'Reiniciar',
      validate: body => {
        ensure(
          body.state === 'building_cart' &&
            body.sessionData.cart.length === 0 &&
            !body.sessionData.address &&
            !body.sessionData.paymentMethod,
          'PICKUP_CHECKOUT_NOT_CLEARED',
        );
      },
    });

    if (
      !(await check('takeover_enabled', async () => {
        const response = await admin(
          `/api/admin/whatsapp/conversations/${conversationId}/takeover`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ takeover: true }),
          },
        );
        ensure([200, 201].includes(response.status), 'TAKEOVER_ENABLE_FAILED');
        const body = await response.json();
        ensure(body.success === true && body.humanTakeover === true, 'TAKEOVER_NOT_ENABLED');
        current = await detail();
        ensure(
          current.humanTakeover === true && current.sessionData.cart.length === 0,
          'TAKEOVER_STATE_INVALID',
        );
      }))
    ) {
      throw new CheckError('TAKEOVER_ENABLE_FAILED');
    }

    await send({
      id: 'message-during-takeover',
      text: 'Mensaje sintético durante takeover',
      expectReply: false,
      allowTakeover: true,
      validate: body => {
        ensure(
          body.humanTakeover === true && body.sessionData.cart.length === 0,
          'TAKEOVER_MESSAGE_CHANGED_ORDER',
        );
      },
    });

    if (
      !(await check('takeover_released', async () => {
        const before = await detail();
        const response = await admin(
          `/api/admin/whatsapp/conversations/${conversationId}/takeover`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ takeover: false }),
          },
        );
        ensure([200, 201].includes(response.status), 'TAKEOVER_RELEASE_FAILED');
        const body = await response.json();
        ensure(
          body.success === true && body.humanTakeover === false,
          'TAKEOVER_NOT_RELEASED',
        );
        current = await detail();
        ensure(
          current.humanTakeover === false &&
            current.sessionData.cart.length === 0 &&
            current.messages.length >= before.messages.length,
          'RELEASE_CHANGED_ORDER_OR_MESSAGES',
        );
      }))
    ) {
      throw new CheckError('TAKEOVER_RELEASE_FAILED');
    }

    await send({
      id: 'bot-resumes-after-takeover',
      text: 'Reiniciar',
      validate: body => {
        ensure(
          body.humanTakeover === false &&
            body.state === 'building_cart' &&
            body.sessionData.cart.length === 0,
          'BOT_DID_NOT_RESUME_CLEANLY',
        );
      },
    });

    await assertNoNewOrder();
    delete report.activeStep;
    report.ok =
      report.steps.length === (resumeFailedSoup ? 16 : 15) &&
      report.steps.every(step => step.pass) &&
      report.checks.every(item => item.pass);
  } catch (error) {
    report.checks.push({
      name: 'checkout_execution',
      pass: false,
      code: error instanceof CheckError ? error.code : 'EXECUTION_FAILED_NO_RETRY',
    });
  } finally {
    if (cookie) {
      const logout = await check('logout', async () => {
        const response = await admin('/api/auth/logout', { method: 'POST' });
        ensure([200, 201].includes(response.status), 'LOGOUT_FAILED');
        ensure(
          ['access_token', 'refresh_token'].every(name =>
            response.headers
              .getSetCookie()
              .some(
                value =>
                  value.startsWith(`${name}=;`) && /Expires=/i.test(value),
              ),
          ),
          'LOGOUT_COOKIES_NOT_CLEARED',
        );
      });
      cookie = '';
      if (!logout) report.ok = false;
    }
    report.httpRequests = requests;
  }
  return report;
}

module.exports = { runCheckoutRehearsal };

if (require.main === module) {
  runCheckoutRehearsal()
    .then(report => {
      const fs = require('node:fs');
      fs.mkdirSync('tmp', { recursive: true });
      fs.writeFileSync(
        'tmp/ppp-staging-checkout-report.json',
        JSON.stringify(report, null, 2),
      );
      console.log(JSON.stringify(report));
      process.exitCode = report.ok ? 0 : 1;
    })
    .catch(() => {
      console.error('STAGING_CHECKOUT_REHEARSAL_FAILED');
      process.exitCode = 1;
    });
}
