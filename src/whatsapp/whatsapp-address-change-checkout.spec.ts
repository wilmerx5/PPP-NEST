import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappPointsService } from './whatsapp-points.service';
import { WhatsappTurnTelemetryService } from './whatsapp-turn-telemetry.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const products = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));

function harness() {
  let count = 0;
  const conv = {
    id: 1, waId: 'customer', phoneE164: '+573000000001', customerName: 'Wilmer', state: 'awaiting_payment',
    sessionData: {
      cart: [{ productId: 17, name: 'Churrasco', code: 17, unitPrice: 38000, quantity: 2, attributes: [], note: 'sin ensalada' }],
      orderType: 'delivery', fulfillmentChosen: true, addressConfirmed: true,
      address: 'Dg 6 b #78 b 20, Castilla, Bogotá', deliveryFeeCalculated: 4000,
    } as WhatsappSessionData,
  };
  const replies: string[] = [];
  const conversations = {
    findOrCreateConversation: async () => conv,
    touchInbound: async () => undefined,
    claimInboundMessage: async () => ({ id: ++count }),
    reloadConversation: async () => structuredClone(conv),
    getSession: () => structuredClone(conv.sessionData),
    saveSession: async (_conv: unknown, session: WhatsappSessionData, state?: string) => {
      conv.sessionData = structuredClone(session); if (state) conv.state = state;
    },
    countInboundMessages: async () => count + 1,
    getRecentMessageTexts: async () => [],
    getLastOutboundBody: async () => replies.at(-1) || null,
    updateCustomerName: async () => undefined,
  };
  const catalog = new WhatsappCatalogService({} as never);
  jest.spyOn(catalog, 'getMenuProducts').mockResolvedValue(products);
  const agent = { runTurn: jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {}, toolCalls: [] }) };
  const deliveryRouting = { quoteDeliveryFee: jest.fn().mockResolvedValue({
    ok: true, fee: 4500, distanceKm: 2.2, source: 'google_directions', customer: { lat: 4.65, lng: -74.1 },
  }) };
  const cfg = { enabled: true, agentV1Enabled: true, ignoreBusinessHours: true, brandName: 'PPP',
    localContext: {}, paymentMethods: DEFAULT_PAYMENT_METHODS, menuConceptGroups: [], defaultDeliveryFee: 4000,
    deliveryFeeMode: 'distance', deliveryFeeTiers: [], restaurantLat: 4.6, restaurantLng: -74.08 };
  const service = new WhatsappOrchestratorService(
    { getEffectiveConfig: async () => cfg } as never, {} as never, catalog, {} as never,
    conversations as never, { getStatus: async () => ({ isOpen: true, message: 'Abierto', openTime: '00:00', closeTime: '23:59' }) } as never,
    {} as never, {} as never, new WhatsappActionGuardService(catalog), new WhatsappPointsService({} as never),
    deliveryRouting as never, agent as never, new WhatsappTurnTelemetryService(),
  ) as any;
  service.reply = async (_conv: unknown, _waId: string, reply: string) => { replies.push(reply); };
  const send = (text: string) => service.handleIncomingUnlocked({
    waId: 'customer', phoneE164: conv.phoneE164, messageId: `test-${count}`, messageType: 'text', text, raw: {},
  });
  return { conv, send, agent, replies, deliveryRouting };
}

describe('Address changes during checkout', () => {
  it('requotes a new street while payment is being chosen and keeps the cart', async () => {
    const h = harness();
    await h.send('Cambia la direccion a cll 6 b 81 b 51, Castilla, Bogotá');
    expect(h.agent.runTurn).not.toHaveBeenCalled();
    expect(h.conv.sessionData.address?.toLowerCase()).toContain('81');
    expect(h.conv.sessionData.deliveryFeeCalculated).toBe(4500);
    expect(h.conv.sessionData.cart).toEqual([
      expect.objectContaining({ productId: 17, quantity: 2, note: 'sin ensalada' }),
    ]);
    expect(h.conv.sessionData.paymentMethod).toBeUndefined();
    expect(h.conv.state).not.toBe('completed');
    expect(h.replies.at(-1)).toMatch(/direcci[oó]n actualizada/i);
  });

  it('still accepts a cash choice after the address was quoted', async () => {
    const h = harness();
    await h.send('1');
    expect(h.conv.sessionData.address).toContain('78');
    expect(h.conv.sessionData.paymentMethod).toBeTruthy();
    expect(h.conv.state).not.toBe('completed');
  });
});
