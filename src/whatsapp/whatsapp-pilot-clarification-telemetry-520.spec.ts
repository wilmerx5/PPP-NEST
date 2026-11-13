import { WhatsappAiService } from './whatsapp-ai.service';
import { harness } from './whatsapp-accuracy.test-support';
import {
  observeWhatsappTurn,
  observeWhatsappState,
  observeWhatsappInference,
  observeWhatsappOrderRegistered,
  type WhatsappTurnSummary,
} from './whatsapp-turn-observation';
import { requestWhatsappInference } from './whatsapp-openai-request';

const menu = () => [
  {
    id: 5201,
    code: 11,
    name: 'Combo De Lentejas',
    price: 24000,
    availableNow: true,
    attributes: [
      { attributeName: 'Bebida', options: ['Colombiana', 'Manzana', 'Pepsi'] },
      { attributeName: 'Salsa', options: ['Suave', 'Picante'] },
    ],
    hasAttributes: true,
  },
  {
    id: 5202,
    code: 12,
    name: 'Combo De Falafel',
    price: 26000,
    availableNow: true,
    attributes: [
      { attributeName: 'Bebida', options: ['Colombiana', 'Manzana', 'Pepsi'] },
    ],
    hasAttributes: true,
  },
];

function setup() {
  const products = menu();
  const h = harness(products, true);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 520, dailyOrderNumber: 520 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
    cart: [
      {
        productId: 5201,
        code: 11,
        name: products[0].name,
        unitPrice: 24000,
        quantity: 2,
        note: 'Sin cebolla',
        attributes: [
          { attributeName: 'Bebida', attributeValue: 'Colombiana' },
          { attributeName: 'Salsa', attributeValue: 'Suave' },
        ],
      },
    ],
  });
  const summaries: WhatsappTurnSummary[] = [];
  jest
    .spyOn(h.service.turnTelemetry, 'recordSummary')
    .mockImplementation((summary: WhatsappTurnSummary) =>
      summaries.push(summary),
    );
  return { h, products, summaries };
}

for (const state of ['building_cart', 'awaiting_final_confirm']) {
  for (const field of ['Bebida', 'Salsa']) {
    test(`a rejected invented ${field} choice asks only its value in ${state}`, async () => {
      const { h, summaries } = setup();
      h.conv.state = state;
      h.agent.runTurn.mockResolvedValue({
        reply: 'Listo, cambié la opción.',
        toolCalls: ['set_attribute'],
        actions: {
          updateAttributes: [
            {
              productId: 5201,
              cartLineIndex: 0,
              attributeName: field,
              attributeValue: field === 'Bebida' ? 'Manzana' : 'Picante',
            },
          ],
        },
      });
      const before = structuredClone(h.conv.sessionData.cart);
      const reply = await h.sendQueued(
        `¿Podemos cambiar la ${field.toLowerCase()}?`,
      );
      expect(reply).toContain(field === 'Bebida' ? 'Pepsi' : 'Picante');
      expect(reply).not.toMatch(/qué plato|cuál plato|Algo más/i);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingCartOptionChoice?.selected).toBe(0);
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        acceptedMessages: 1,
        agentInvocations: 1,
        inferenceAttempts: 0,
        guardRejections: 1,
        missingOptionChoices: 1,
        cartChanged: false,
        hasPendingChoice: true,
        deliveryPipeline: 'completed',
      });
      await h.sendQueued(field === 'Bebida' ? 'Pepsi' : 'Picante');
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.cart[0]).toMatchObject({
        quantity: 2,
        note: 'Sin cebolla',
      });
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
        attributeName: field,
        attributeValue: field === 'Bebida' ? 'Pepsi' : 'Picante',
      });
      expect(summaries[1]).toMatchObject({
        agentInvocations: 0,
        cartChanged: true,
        ordersRegistered: 0,
      });
    });
  }
}

test('several meals ask their owner before asking the missing value', async () => {
  const { h, products } = setup();
  h.conv.sessionData.cart.push({
    productId: 5202,
    code: 12,
    name: products[1].name,
    unitPrice: 26000,
    quantity: 1,
    attributes: [{ attributeName: 'Bebida', attributeValue: 'Manzana' }],
  });
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo.',
    toolCalls: ['set_attribute'],
    actions: {
      updateAttributes: [
        {
          productId: 5201,
          cartLineIndex: 0,
          attributeName: 'Bebida',
          attributeValue: 'Pepsi',
        },
      ],
    },
  });
  const before = structuredClone(h.conv.sessionData.cart);
  const owner = await h.sendQueued('¿Podemos cambiar la bebida?');
  expect(owner).toMatch(/cuál plato/i);
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('3');
  expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
  expect(h.conv.sessionData.cart[1].attributes).toEqual([
    { attributeName: 'Bebida', attributeValue: 'Pepsi' },
  ]);
});

test('a vague correction does not infer an attribute from the rejected proposal', async () => {
  const { h } = setup();
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo.',
    toolCalls: ['set_attribute'],
    actions: {
      updateAttributes: [
        {
          productId: 5201,
          cartLineIndex: 0,
          attributeName: 'Bebida',
          attributeValue: 'Manzana',
        },
      ],
    },
  });
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('¿Podemos cambiarlo?');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
});

for (const scenario of [
  'reaction',
  'duplicate',
  'disabled',
  'human_takeover',
]) {
  test(`one summary covers ignored or disabled input ${scenario}`, async () => {
    const { h, summaries } = setup();
    if (scenario === 'duplicate')
      h.service.conversationService.claimInboundMessage = jest
        .fn()
        .mockResolvedValue(null);
    if (scenario === 'disabled') h.cfg.enabled = false;
    if (scenario === 'human_takeover')
      Object.assign(h.conv, { humanTakeover: true });
    await h.sendQueued(
      'hola',
      scenario === 'reaction'
        ? { messageType: 'other', raw: { type: 'reaction' } }
        : {},
    );
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      ignoredReason: scenario,
      inferenceAttempts: 0,
      failed: false,
    });
    expect(summaries[0].acceptedMessages).toBe(
      scenario === 'duplicate' ? 0 : 1,
    );
  });
}

test('summary logging failure does not prevent a valid option change', async () => {
  const { h } = setup();
  h.service.turnTelemetry.recordSummary.mockImplementation(() => {
    throw Error('sink failed');
  });
  await h.sendQueued('Cambio bebida');
  await h.sendQueued('Pepsi');
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({
    attributeName: 'Bebida',
    attributeValue: 'Pepsi',
  });
});

test('an order registered before a send failure remains visible in its summary', async () => {
  const { h, summaries } = setup();
  h.conv.state = 'awaiting_final_confirm';
  h.conv.sessionData.paymentMethod = 'cash';
  h.service.sendReplyNow = jest
    .fn()
    .mockRejectedValue(new Error('Meta send failed'));
  await expect(h.sendQueued('confirmar')).rejects.toThrow('Meta send failed');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(summaries).toHaveLength(1);
  expect(summaries[0]).toMatchObject({
    ordersRegistered: 1,
    failed: true,
    deliveryPipeline: 'failed',
  });
});

test('each actual provider retry is counted without customer text', async () => {
  const summaries: WhatsappTurnSummary[] = [];
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'slow_down' } }), {
        status: 429,
      }),
    )
    .mockResolvedValueOnce(new Response('{}', { status: 200 }));
  await observeWhatsappTurn(
    'text',
    async () => {
      observeWhatsappState(1, 'building_cart', {
        cart: [],
        orderType: 'pickup',
        customerNotes: 'Dirección y nombre privados',
      });
      await requestWhatsappInference(
        JSON.stringify({
          model: 'model-test',
          messages: [{ content: 'mensaje privado' }],
        }),
        'private-key',
        { fetcher, wait: async () => undefined, random: () => 0 },
      );
    },
    (summary) => summaries.push(summary),
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(summaries[0]).toMatchObject({
    inferenceAttempts: 2,
    inferenceRequestFailures: 1,
    inferenceByPurpose: { agent: 2 },
    inferenceByModel: { 'model-test': 2 },
    route: 'agent',
    deliveryPipeline: 'not_observed',
  });
  expect(JSON.stringify(summaries)).not.toMatch(
    /mensaje privado|Dirección|private-key/,
  );
});

test('parallel observations and their model failures remain independent', async () => {
  const summaries: WhatsappTurnSummary[] = [];
  await Promise.all(
    (['audio', 'vision'] as const).map((purpose) =>
      observeWhatsappTurn(
        purpose,
        async () => {
          await observeWhatsappInference(
            purpose,
            purpose + '-model',
            async () => {
              await new Promise<void>((resolve) => setImmediate(resolve));
              return { ok: purpose === 'audio' };
            },
          );
        },
        (summary) => summaries.push(summary),
      ),
    ),
  );
  expect(summaries).toHaveLength(2);
  expect(
    summaries.find((summary) => summary.messageType === 'audio'),
  ).toMatchObject({
    inferenceAttempts: 1,
    inferenceRequestFailures: 0,
    inferenceByPurpose: { audio: 1 },
    inferenceByModel: { 'audio-model': 1 },
  });
  expect(
    summaries.find((summary) => summary.messageType === 'other'),
  ).toMatchObject({
    inferenceAttempts: 1,
    inferenceRequestFailures: 1,
    inferenceByPurpose: { vision: 1 },
    inferenceByModel: { 'vision-model': 1 },
  });
});

test('nested processing emits one summary and one registered-order count', async () => {
  const summaries: WhatsappTurnSummary[] = [];
  await observeWhatsappTurn(
    'text',
    () =>
      observeWhatsappTurn(
        'text',
        async () => {
          observeWhatsappOrderRegistered();
        },
        () => {
          throw Error('nested summary must not be emitted');
        },
      ),
    (summary) => summaries.push(summary),
    true,
  );
  expect(summaries).toHaveLength(1);
  expect(summaries[0]).toMatchObject({
    ordersRegistered: 1,
    deliveryPipeline: 'completed',
  });
});

test('an error before conversation loading still emits one failed summary', async () => {
  const { h, summaries } = setup();
  h.service.settingsService.getEffectiveConfig = jest
    .fn()
    .mockRejectedValue(new Error('Settings unavailable'));
  await expect(h.sendQueued('hola')).rejects.toThrow('Settings unavailable');
  expect(summaries).toHaveLength(1);
  expect(summaries[0]).toMatchObject({
    failed: true,
    acceptedMessages: 0,
    deliveryPipeline: 'failed',
  });
});

test('a successful closure and the following thanks are separate observed turns', async () => {
  const { h, summaries } = setup();
  await h.sendQueued('no más');
  await h.sendQueued('efectivo');
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(summaries).toHaveLength(3);
  expect(summaries[2]).toMatchObject({
    ordersRegistered: 1,
    stateAfter: 'completed',
    failed: false,
  });
  await h.sendQueued('gracias');
  expect(summaries[3]).toMatchObject({
    ordersRegistered: 0,
    stateBefore: 'completed',
    stateAfter: 'completed',
  });
});

test('a real coalesced burst emits one summary for all claimed messages', async () => {
  const { h, summaries } = setup();
  jest.useFakeTimers();
  try {
    const messages = ['no más', 'recojo en el local'].map((text, index) =>
      h.service.handleIncoming({
        waId: 'customer',
        phoneE164: h.conv.phoneE164,
        messageId: `burst-520-${index}`,
        messageType: 'text',
        text,
        timestamp: Date.now() / 1000,
        raw: {},
      }),
    );
    await jest.advanceTimersByTimeAsync(4000);
    await Promise.all(messages);
  } finally {
    jest.useRealTimers();
  }
  expect(summaries).toHaveLength(1);
  expect(summaries[0]).toMatchObject({
    acceptedMessages: 2,
    deliveryPipeline: 'completed',
    failed: false,
  });
});

for (const purpose of [
  'classification',
  'assist',
  'audio',
  'vision',
] as const) {
  test(`the actual AI service observes the ${purpose} HTTP boundary`, async () => {
    const summaries: WhatsappTurnSummary[] = [];
    const service = new WhatsappAiService({
      getEffectiveConfig: async () => ({
        openaiApiKey: 'synthetic-key',
        openaiModel: 'test-model',
        systemPrompt: '',
        aiTemperature: 0,
      }),
    } as never);
    const response =
      purpose === 'audio'
        ? { text: 'mensaje sintético' }
        : {
            choices: [
              {
                message: {
                  content: JSON.stringify(
                    purpose === 'classification'
                      ? {
                          intent: 'question',
                          normalizedText: 'hola',
                          confidence: 0.9,
                          hasFoodItems: false,
                        }
                      : purpose === 'vision'
                        ? { kind: 'other', textForBot: '' }
                        : { reply: 'Hola', actions: {} },
                  ),
                },
              },
            ],
          };
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(response)));
    try {
      await observeWhatsappTurn(
        purpose === 'vision' ? 'image' : purpose === 'audio' ? 'audio' : 'text',
        async () => {
          if (purpose === 'classification')
            await service.classifyMessage({
              userMessage: 'hola',
              cartLength: 0,
            });
          if (purpose === 'assist')
            await service.generateTurn({
              userMessage: 'hola',
              businessRulesBlock: '',
              menuDetailedText: '',
              sessionSummary: '',
              recentMessages: [],
              customerHint: '',
            });
          if (purpose === 'audio')
            await service.transcribeAudio(
              Buffer.from('audio sintético'),
              'audio/ogg',
            );
          if (purpose === 'vision')
            await service.analyzeOrderImage({
              buffer: Buffer.from('imagen sintética'),
              mimeType: 'image/png',
              menuSummary: '',
            });
        },
        (summary) => summaries.push(summary),
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(summaries[0]).toMatchObject({
        inferenceAttempts: 1,
        inferenceRequestFailures: 0,
        inferenceByPurpose: { [purpose]: 1 },
        route: 'assist',
      });
      expect(JSON.stringify(summaries)).not.toMatch(/sintétic|synthetic-key/);
    } finally {
      fetch.mockRestore();
    }
  });
}

test('a provider transport error preserves its error and increments the failure count', async () => {
  const summaries: WhatsappTurnSummary[] = [];
  const failure = new Error('provider unavailable');
  await expect(
    observeWhatsappTurn(
      'text',
      () =>
        observeWhatsappInference('assist', 'test-model', async () => {
          throw failure;
        }),
      (summary) => summaries.push(summary),
    ),
  ).rejects.toBe(failure);
  expect(summaries[0]).toMatchObject({
    failed: true,
    inferenceAttempts: 1,
    inferenceRequestFailures: 1,
  });
});

test('assist and agent requests share their turn while retaining separate purposes', async () => {
  const summaries: WhatsappTurnSummary[] = [];
  await observeWhatsappTurn(
    'audio',
    async () => {
      await observeWhatsappInference('audio', 'audio-model', async () => ({
        ok: true,
      }));
      await observeWhatsappInference('agent', 'agent-model', async () => ({
        ok: true,
      }));
    },
    (summary) => summaries.push(summary),
  );
  expect(summaries[0]).toMatchObject({
    route: 'hybrid',
    inferenceAttempts: 2,
    inferenceByPurpose: { audio: 1, agent: 1 },
  });
});

test('a handled agent error is visible even when the router recovers', async () => {
  const { h, summaries } = setup();
  h.agent.runTurn.mockResolvedValue({
    reply: '',
    actions: {},
    toolCalls: [],
    error: 'provider_failed',
  });
  await h.sendQueued('¿Podemos cambiar la bebida?');
  expect(summaries[0]).toMatchObject({ agentInvocations: 1, agentErrors: 1 });
});

test('equivalent attribute order does not count as a changed cart', async () => {
  const { h } = setup();
  const summaries: WhatsappTurnSummary[] = [];
  const before = structuredClone(h.conv.sessionData);
  const after = structuredClone(before);
  after.cart[0].attributes!.reverse();
  await observeWhatsappTurn(
    'text',
    async () => {
      observeWhatsappState(1, 'building_cart', before);
      observeWhatsappState(1, 'building_cart', after);
    },
    (summary) => summaries.push(summary),
  );
  expect(summaries[0].cartChanged).toBe(false);
});

test('an existing add offer is preserved while an unrelated option edit is rejected', async () => {
  const { h, products } = setup();
  h.conv.sessionData.pendingAddOffer = {
    productId: 5202,
    name: products[1].name,
    code: products[1].code,
    price: products[1].price,
    quantity: 1,
    createdAt: Date.now(),
  };
  h.agent.runTurn.mockResolvedValue({
    reply: 'Listo.',
    toolCalls: ['set_attribute'],
    actions: {
      updateAttributes: [
        {
          productId: 5201,
          cartLineIndex: 0,
          attributeName: 'Bebida',
          attributeValue: 'Manzana',
        },
      ],
    },
  });
  const before = structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('¿Podemos cambiar la bebida?');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(5202);
  expect(h.conv.sessionData.pendingCartOptionChoice).toBeUndefined();
});

test('an invalid grouped option cannot throw or mutate the cart', async () => {
  const { h, products } = setup();
  const before = structuredClone(h.conv.sessionData.cart);
  const result = h.service.actionGuard.sanitize({
    actions: {
      updateUnitOptions: [
        {
          productId: 5201,
          cartLineIndex: 0,
          affectedQuantity: 1,
          attributes: [null],
        },
      ],
    },
    products,
    cart: before,
    sourceText: 'cambia la bebida',
    businessOpen: true,
    allowMercadoPago: false,
  });
  expect(result.actions).toBeUndefined();
  expect(h.conv.sessionData.cart).toEqual(before);
});

test('a delayed task starts its own observation after the parent finishes', async () => {
  const summaries: WhatsappTurnSummary[] = [];
  let later: Promise<void>;
  await observeWhatsappTurn(
    'text',
    async () => {
      later = new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          observeWhatsappTurn(
            'image',
            async () => {
              await observeWhatsappInference(
                'vision',
                'vision-model',
                async () => ({ ok: true }),
              );
            },
            (summary) => summaries.push(summary),
          ).then(resolve, reject);
        }, 0),
      );
    },
    (summary) => summaries.push(summary),
  );
  await later!;
  expect(summaries).toHaveLength(2);
  expect(summaries[0].inferenceAttempts).toBe(0);
  expect(summaries[1]).toMatchObject({
    messageType: 'image',
    inferenceAttempts: 1,
  });
});

test('a separately queued turn receives its own observation inside an active parent', async () => {
  const summaries: WhatsappTurnSummary[] = [];
  await observeWhatsappTurn(
    'text',
    () =>
      observeWhatsappTurn(
        'image',
        async () => {
          await observeWhatsappInference(
            'vision',
            'vision-model',
            async () => ({ ok: true }),
          );
        },
        (summary) => summaries.push(summary),
        true,
      ),
    (summary) => summaries.push(summary),
    true,
  );
  expect(summaries).toHaveLength(2);
  expect(
    summaries.find((summary) => summary.messageType === 'text')
      ?.inferenceAttempts,
  ).toBe(0);
  expect(
    summaries.find((summary) => summary.messageType === 'image')
      ?.inferenceAttempts,
  ).toBe(1);
});
