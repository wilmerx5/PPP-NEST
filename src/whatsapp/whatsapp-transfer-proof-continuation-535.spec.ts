import { harness } from './whatsapp-accuracy.test-support';

function setup(state = 'awaiting_final_confirm', kind = 'payment_proof') {
  const h = harness(
    [
      {
        id: 5351,
        code: 31,
        name: 'Sopa Vegetal',
        price: 12000,
        availableNow: true,
        attributes: [],
      },
    ],
    true,
  );
  h.conv.state = state;
  h.conv.customerName = 'Camila Rojas';
  Object.assign(h.conv.sessionData, {
    fulfillmentChosen: true,
    orderType: 'delivery',
    address: 'Calle 10 #20-30 apto 302',
    addressConfirmed: true,
    deliveryFeeCalculated: 2000,
    deliveryDistanceKm: 0.5,
    deliveryLat: 4.63,
    deliveryLng: -74.15,
    phoneConfirmed: true,
    contactPhone: h.conv.phoneE164,
    notesCollected: true,
    paymentMethod: 'transfer',
    cart: [
      {
        productId: 5351,
        code: 31,
        name: 'Sopa Vegetal',
        unitPrice: 12000,
        quantity: 1,
        attributes: [],
      },
    ],
  });
  h.service.conversationService.updateMessageBody = jest.fn();
  h.service.metaService = {
    downloadMedia: jest
      .fn()
      .mockResolvedValue({
        buffer: Buffer.from('synthetic receipt'),
        mimeType: 'image/png',
      }),
  };
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.aiService.analyzeOrderImage = jest
    .fn()
    .mockResolvedValue({ kind, reply: 'Pago aprobado y pedido confirmado' });
  h.service.ordersService.create = jest
    .fn()
    .mockResolvedValue({ id: 535, dailyOrderNumber: 535 });
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  return h;
}

for (const kind of ['payment_proof', 'unclear']) {
  test(`proof acknowledgement resumes the explicit confirmation ${kind}`, async () => {
    const h = setup('awaiting_final_confirm', kind);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('', { messageType: 'image', mediaId: 'synthetic' });
    expect(h.replies.at(-1)).toMatch(/confirmar/);
    expect(h.replies.at(-1)).toMatch(/equipo debe verificar/);
    expect(h.replies.at(-1)).not.toContain('Pago aprobado');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('Confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(
      1,
    );
    expect(h.conv.state).toBe('completed');
  });
}

for (const [state, question] of [
  ['awaiting_name', /nombre|quién/],
  ['awaiting_phone', /teléfono/],
  ['awaiting_address', /dirección/],
  ['awaiting_payment', /método de pago/],
] as const)
  test(`proof retains the current checkout step ${state}`, async () => {
    const h = setup(state);
    if (state === 'awaiting_name') h.conv.customerName = '';
    if (state === 'awaiting_address')
      h.conv.sessionData.addressConfirmed = false;
    if (state === 'awaiting_phone') h.conv.sessionData.phoneConfirmed = false;
    if (state === 'awaiting_payment')
      h.conv.sessionData.paymentMethod = undefined;
    await h.sendQueued('', { messageType: 'image', mediaId: 'synthetic' });
    expect(h.replies.at(-1)).toMatch(question);
    expect(h.replies.at(-1)).not.toMatch(/escribe confirmar/);
    expect(h.conv.state).toBe(state);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

for (const state of ['completed', 'closed', 'human_takeover'])
  test(`a receipt after closure does not reopen confirmation ${state}`, async () => {
    const h = setup(state);
    const cart = structuredClone(h.conv.sessionData.cart);
    await h.service.resolveImageMessage(
      { waId: 'customer', messageType: 'image', mediaId: 'synthetic' },
      'logged',
      h.conv,
      h.cfg,
    );
    expect(h.replies.at(-1)).toMatch(/equipo debe verificar/);
    expect(h.replies.at(-1)).not.toMatch(/escribe confirmar/);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.state).toBe(state);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

for (const unresolved of ['empty', 'address', 'distribution', 'human'])
  test(`an unresolved or human-owned checkout does not get a final confirmation prompt ${unresolved}`, async () => {
    const h = setup();
    if (unresolved === 'empty') h.conv.sessionData.cart = [];
    if (unresolved === 'address') h.conv.sessionData.addressConfirmed = false;
    if (unresolved === 'distribution')
      h.conv.sessionData.pendingUnitDistribution = {} as never;
    if (unresolved === 'human') Object.assign(h.conv, { humanTakeover: true });
    await h.service.resolveImageMessage(
      { waId: 'customer', messageType: 'image', mediaId: 'synthetic' },
      'logged',
      h.conv,
      h.cfg,
    );
    expect(h.replies.at(-1)).not.toMatch(/escribe confirmar/);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });

test('a pending cart edit keeps priority in the receipt response', async () => {
  const h = setup();
  h.conv.sessionData.pendingReplacementClarification = {
    cartSignature: JSON.stringify(h.conv.sessionData.cart),
  };
  await h.sendQueued('', { messageType: 'image', mediaId: 'synthetic' });
  expect(h.replies.at(-1)).toMatch(/cambio anterior sigue pendiente/);
  expect(h.replies.at(-1)).not.toMatch(/escribe confirmar/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
