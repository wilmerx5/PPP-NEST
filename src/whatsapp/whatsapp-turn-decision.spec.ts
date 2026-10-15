import {
  beginTurnDecision,
  captureActionDecision,
  capturePurchaseDecision,
  finishTurnDecision,
} from './whatsapp-turn-decision';
import { WhatsappTurnTelemetryService } from './whatsapp-turn-telemetry.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';

const session = (): WhatsappSessionData => ({
  orderType: 'delivery',
  address: 'Calle privada 123',
  contactPhone: '+573001234567',
  cart: [
    {
      productId: 20,
      name: 'Plato privado',
      code: 20,
      unitPrice: 18000,
      quantity: 2,
      note: 'Llamar a Ana al llegar',
      attributes: [{ attributeName: 'Salsa', attributeValue: 'Suave' }],
    },
  ],
});

describe('Turn decision contract — diagnostic and immutable', () => {
  it('freezes stages and captures the applied delta', () => {
    const before = session();
    const frame = beginTurnDecision('building_cart', before);
    const actions = {
      addItems: [{ productId: 20, quantity: 3, note: 'nota privada' }],
    };
    captureActionDecision(frame, 'proposed', actions);
    actions.addItems[0].quantity = 1;
    captureActionDecision(frame, 'catalog_validated', actions);
    const after = session();
    after.cart[0].quantity = 3;
    const decision = finishTurnDecision(frame, 'awaiting_payment', after);
    expect(decision.stages.map((stage) => stage.additions[0].quantity)).toEqual(
      [3, 1],
    );
    expect(decision.before.cart[0].quantity).toBe(2);
    expect(decision.observedUnitDelta).toEqual([
      { productId: 20, quantity: 1 },
    ]);
    expect(decision.after.state).toBe('awaiting_payment');
    after.cart[0].quantity = 9;
    expect(decision.after.cart[0].quantity).toBe(3);
  });

  it('keeps a readonly interruption visible without inventing a semantic classification', () => {
    const before = session();
    const frame = beginTurnDecision('awaiting_phone', before);
    const after = {
      ...before,
      pendingCompositionAsk: {
        originalText: 'consulta privada',
        resumeState: 'awaiting_phone',
      },
    };
    const decision = finishTurnDecision(frame, 'awaiting_phone', after);
    expect(decision.stages).toEqual([]);
    expect(decision.observedUnitDelta).toEqual([]);
    expect(decision.after.pending).toContain('pendingCompositionAsk');
    expect(decision.before.cart).toEqual(decision.after.cart);
  });

  it('does not retain customer or message text', () => {
    const before = session();
    const frame = beginTurnDecision('building_cart', before);
    captureActionDecision(frame, 'proposed', {
      setAddress: before.address,
      setCustomerName: 'Nombre secreto',
      setCustomerNotes: 'Mensaje secreto',
      addItems: [
        {
          productId: 20,
          note: before.cart[0].note,
          attributes: before.cart[0].attributes,
        },
      ],
    });
    const exported = JSON.stringify(
      finishTurnDecision(frame, 'building_cart', before),
    );
    for (const raw of [
      'Calle privada',
      '+573001234567',
      'Nombre secreto',
      'Mensaje secreto',
      'Llamar a Ana',
      'Suave',
      'Plato privado',
    ])
      expect(exported).not.toContain(raw);
    expect(exported).toContain('setAddress');
  });

  it('captures prepared quantities and diagnostic reasons', () => {
    const frame = beginTurnDecision('building_cart', session());
    capturePurchaseDecision(frame, {
      lines: [
        {
          product: {
            id: 21,
            name: 'Otra carta',
            code: 21,
            price: 10,
            hasAttributes: false,
            attributes: [],
          },
          quantity: 2,
        },
      ],
      diagnostics: [
        {
          code: 'quantity_recomputed',
          productId: 21,
          proposedQuantity: 1,
          resolvedQuantity: 2,
        },
      ],
    });
    expect(frame.stages[0].stage).toBe('prepared');
    expect(frame.stages[0].additions[0].quantity).toBe(2);
    expect(frame.stages[0].diagnostics[0].code).toBe('quantity_recomputed');
  });

  it('bounds stage history and marks errors explicitly', () => {
    const frame = beginTurnDecision('building_cart', session());
    for (let n = 0; n < 40; n++) captureActionDecision(frame, 'proposed', {});
    expect(frame.stages).toHaveLength(32);
    expect(
      finishTurnDecision(frame, 'building_cart', session(), true).failed,
    ).toBe(true);
    expect(() =>
      captureActionDecision(undefined, 'proposed', {}),
    ).not.toThrow();
  });

  it('keeps only a bounded memory buffer and returns copies', () => {
    const telemetry = new WhatsappTurnTelemetryService();
    const decision = finishTurnDecision(
      beginTurnDecision('building_cart', session()),
      'awaiting_phone',
      session(),
    );
    const log = jest.spyOn((telemetry as any).logger, 'log');
    for (let i = 0; i < 110; i++) telemetry.recordDecision(decision);
    expect(telemetry.getRecentDecisions(100)).toHaveLength(100);
    telemetry.getRecentDecisions(1)[0].after.state = 'tampered';
    expect(telemetry.getRecentDecisions(1)[0].after.state).toBe(
      'awaiting_phone',
    );
    expect(log).not.toHaveBeenCalled();
  });
  it.each(['different', 'pending_choice', 'not_comparable'])(
    'distinguishes application outcome %s',
    (status) => {
      const before = session();
      const frame = beginTurnDecision('building_cart', before);
      capturePurchaseDecision(frame, {
        lines: [
          {
            product: {
              id: 20,
              code: 20,
              name: 'Plato',
              price: 18000,
              hasAttributes: false,
              attributes: [],
            },
            quantity: 3,
          },
        ],
        diagnostics: [],
      });
      const after = session();
      after.cart[0].quantity = 3;
      if (status === 'pending_choice')
        after.pendingAttribute = {
          productId: 20,
          name: 'Plato',
          code: 20,
          price: 18000,
          attributes: [],
          selected: [],
        };
      if (status === 'not_comparable')
        captureActionDecision(frame, 'reconciled', { clearCart: true });
      expect(
        finishTurnDecision(frame, 'building_cart', after).unitComparison
          ?.status,
      ).toBe(status);
    },
  );
});
