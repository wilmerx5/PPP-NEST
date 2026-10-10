'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const {
  runCheckoutRehearsal,
} = require('./ppp-staging-checkout-rehearsal.cjs');

const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'wilmerx5/PPP-NEST',
  GITHUB_REF: 'refs/heads/fix/whatsapp-regression-baseline',
  GITHUB_EVENT_NAME: 'push',
  STAGING_CHECKOUT_EXECUTE: 'true',
  STAGING_ADMIN_EMAIL: 'automation@example.invalid',
  STAGING_ADMIN_PASSWORD: 'synthetic-password',
  STAGING_WHATSAPP_APP_SECRET: 'synthetic-app-secret',
  STAGING_WHATSAPP_PHONE_NUMBER_ID: '12345',
  STAGING_WHATSAPP_RECIPIENTS: '573001234567',
};

const soup = {
  id: 38,
  name: 'Sopa De Ajiaco',
  price: '10500.00',
  isActive: true,
  availableNow: true,
  attributes: [],
};

function fixture(options = {}) {
  let clock = Date.parse('2026-10-10T03:10:00Z');
  let nextId = 2;
  let takeover = false;
  let webhookCount = 0;
  const seen = new Set();
  const sentTexts = [];
  const orders = [];
  const conversation = {
    id: 42,
    waId: env.STAGING_WHATSAPP_RECIPIENTS,
    phoneE164: `+${env.STAGING_WHATSAPP_RECIPIENTS}`,
    humanTakeover: false,
    state: 'building_cart',
    customerName: 'Cliente Sintético',
    sessionData: {
      cart: options.existingDraft
        ? [
            {
              productId: soup.id,
              quantity: 1,
              unitPrice: Number(soup.price),
              attributes: [],
              note: '',
            },
          ]
        : [],
    },
    messages: [
      {
        id: 1,
        direction: 'in',
        body: 'Hola',
        createdAt: new Date(clock).toISOString(),
        sentBy: 'bot',
      },
    ],
  };

  const json = (body, status = 200, cookie) => {
    const response = new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
    if (cookie) response.headers.append('Set-Cookie', cookie);
    return response;
  };

  const addMessage = (direction, body) => {
    conversation.messages.push({
      id: nextId++,
      direction,
      body,
      createdAt: new Date(clock).toISOString(),
      sentBy: 'bot',
    });
  };

  const reset = () => {
    conversation.state = 'building_cart';
    conversation.sessionData = { cart: [] };
  };

  const applyInbound = text => {
    addMessage('in', text);
    if (takeover) {
      if (options.botRepliesTakeover) addMessage('out', 'Respuesta indebida');
      return;
    }

    if (text === 'Una sopa de ajiaco') {
      conversation.sessionData.cart = [
        {
          productId: soup.id,
          quantity: 1,
          unitPrice: Number(soup.price),
          attributes: [],
          note: '',
        },
      ];
      conversation.state = 'building_cart';
    } else if (text === 'No más') {
      if (conversation.sessionData.orderType === 'pickup') {
        conversation.state = 'awaiting_payment';
        conversation.sessionData.address = 'Recoge en el local';
        conversation.sessionData.addressConfirmed = true;
      } else {
        conversation.state = 'awaiting_address';
        conversation.sessionData.orderType = 'delivery';
        conversation.sessionData.fulfillmentChosen = true;
      }
    } else if (text === 'Dg 6 b #78 b 20, Castilla, Bogotá') {
      conversation.state = 'awaiting_payment';
      conversation.sessionData.address = options.wrongAddress
        ? 'Dirección distinta'
        : text;
      conversation.sessionData.addressConfirmed = true;
      conversation.sessionData.deliveryFeeCalculated = 2000;
    } else if (text === '1') {
      conversation.state = 'awaiting_final_confirm';
      conversation.sessionData.paymentMethod = 'cash';
    } else if (text === 'Paso a recoger') {
      conversation.state = 'building_cart';
      conversation.sessionData.orderType = 'pickup';
      conversation.sessionData.fulfillmentChosen = true;
      conversation.sessionData.addressConfirmed = true;
      conversation.sessionData.address = 'Recoge en el local';
    } else if (text === 'Reiniciar') {
      reset();
    }

    addMessage('out', 'Respuesta sintética del bot.');
  };

  const fetch = async (url, opts) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://dev.prontopolloportal.com');
    assert.equal(opts.redirect, 'manual');
    const path = parsed.pathname;

    if (path === '/api/health') {
      return json({ status: 'ok', db: 'connected' });
    }
    if (path === '/api/auth/login') {
      return json(
        {
          requires2FA: false,
          user: { email: env.STAGING_ADMIN_EMAIL, roles: ['admin'] },
        },
        201,
        `access_token=synthetic-cookie; HttpOnly; Secure; SameSite=Lax${
          options.unsafeCookie ? '; Domain=prontopolloportal.com' : ''
        }`,
      );
    }
    if (path === '/api/auth/logout') {
      const response = json({}, 201);
      for (const name of ['access_token', 'refresh_token']) {
        response.headers.append(
          'Set-Cookie',
          `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
        );
      }
      return response;
    }

    assert.ok(
      !path.startsWith('/api/admin/') ||
        opts.headers.Cookie === 'access_token=synthetic-cookie',
    );

    if (path === '/api/admin/whatsapp/staging/test-target') {
      return json(
        {
          staging: true,
          targetMatches: true,
          botEnabled: true,
          agentEnabled: true,
          approvedModel: true,
          credentialsPresent: true,
          conversationTestVersion: options.oldDeployment
            ? '2026-10-10.cart-v1'
            : '2026-10-10.cart-v7',
          rateLimitPerMinute: 25,
        },
        201,
      );
    }
    if (path === '/api/admin/whatsapp/conversations') {
      return json([{ id: 42, phoneE164: conversation.phoneE164 }]);
    }
    if (path === '/api/admin/whatsapp/conversations/42') {
      conversation.humanTakeover = takeover;
      return json(conversation);
    }
    if (path === '/api/admin/whatsapp/conversations/42/takeover') {
      takeover = JSON.parse(opts.body).takeover !== false;
      conversation.humanTakeover = takeover;
      if (!takeover) addMessage('out', 'El bot retomó la conversación.');
      return json({ success: true, humanTakeover: takeover }, 201);
    }
    if (path === '/api/orders/daily') {
      if (options.unexpectedOrder && webhookCount >= 4 && !orders.length) {
        orders.push({
          orderId: 99,
          phone: conversation.phoneE164,
        });
      }
      return json(orders);
    }
    if (path === '/api/products') {
      return json([soup]);
    }
    if (path === '/api/whatsapp/webhook') {
      const signature = `sha256=${createHmac(
        'sha256',
        env.STAGING_WHATSAPP_APP_SECRET,
      )
        .update(opts.body)
        .digest('hex')}`;
      assert.equal(opts.headers['X-Hub-Signature-256'], signature);
      const message = JSON.parse(opts.body).entry[0]?.changes[0]?.value
        ?.messages?.[0];
      if (!message) return json({ ok: true });
      webhookCount++;
      assert.equal(message.from, env.STAGING_WHATSAPP_RECIPIENTS);
      if (seen.has(message.id)) return json({ ok: true });
      seen.add(message.id);
      sentTexts.push(message.text.body);
      applyInbound(message.text.body);
      return json({ ok: true });
    }
    throw new Error(`unexpected path: ${path}`);
  };

  return {
    fetch,
    sentTexts,
    conversation,
    helpers: {
      now: () => clock,
      sleep: async ms => {
        clock += ms;
      },
    },
  };
}

test('validates delivery, pickup and takeover without creating an order', async () => {
  const f = fixture();
  const report = await runCheckoutRehearsal(env, f.fetch, f.helpers);
  assert.equal(report.ok, true);
  assert.equal(report.steps.length, 13);
  assert.ok(report.steps.every(step => step.pass));
  assert.equal(f.conversation.state, 'building_cart');
  assert.equal(f.conversation.sessionData.cart.length, 0);
  assert.equal(f.conversation.humanTakeover, false);
  assert.ok(f.sentTexts.every(text => normalizeForTest(text) !== 'confirmar'));
  const output = JSON.stringify(report);
  for (const secret of [
    env.STAGING_ADMIN_EMAIL,
    env.STAGING_ADMIN_PASSWORD,
    env.STAGING_WHATSAPP_APP_SECRET,
    env.STAGING_WHATSAPP_RECIPIENTS,
    'synthetic-cookie',
  ]) {
    assert.ok(!output.includes(secret));
  }
});

test('preflight performs no conversation writes', async () => {
  const f = fixture();
  const report = await runCheckoutRehearsal(
    { ...env, STAGING_CHECKOUT_EXECUTE: 'false' },
    f.fetch,
    f.helpers,
  );
  assert.equal(report.ok, true);
  assert.equal(report.mode, 'preflight');
  assert.equal(report.steps.length, 0);
  assert.equal(f.sentTexts.length, 0);
});

test('refuses to start from an existing cart', async () => {
  const f = fixture({ existingDraft: true });
  const report = await runCheckoutRehearsal(env, f.fetch, f.helpers);
  assert.equal(report.ok, false);
  assert.equal(report.steps.length, 0);
  assert.equal(f.sentTexts.length, 0);
});

test('fails if checkout creates an order before final confirmation', async () => {
  const f = fixture({ unexpectedOrder: true });
  const report = await runCheckoutRehearsal(env, f.fetch, f.helpers);
  assert.equal(report.ok, false);
  assert.ok(
    report.checks.some(
      item =>
        item.name === 'checkout_execution' &&
        item.code === 'UNEXPECTED_STAGING_ORDER_CREATED',
    ),
  );
});

test('fails if the bot answers while a human has takeover', async () => {
  const f = fixture({ botRepliesTakeover: true });
  const report = await runCheckoutRehearsal(env, f.fetch, f.helpers);
  assert.equal(report.ok, false);
  assert.ok(
    report.checks.some(
      item =>
        item.name === 'checkout_execution' &&
        item.code === 'BOT_REPLIED_DURING_HUMAN_TAKEOVER',
    ),
  );
});

test('fails if the confirmed address is not the one sent', async () => {
  const f = fixture({ wrongAddress: true });
  const report = await runCheckoutRehearsal(env, f.fetch, f.helpers);
  assert.equal(report.ok, false);
  assert.ok(
    report.checks.some(
      item =>
        item.name === 'checkout_execution' &&
        item.code === 'DELIVERY_ADDRESS_NOT_CONFIRMED_OR_QUOTED',
    ),
  );
});

function normalizeForTest(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
