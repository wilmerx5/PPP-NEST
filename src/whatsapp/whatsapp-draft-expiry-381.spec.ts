import { WhatsappCleanupService } from './whatsapp-cleanup.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';

const NOW = new Date('2026-11-03T17:00:00Z').getTime();
const before = (minutes: number) => new Date(NOW - minutes * 60000);
const draft = (overrides: Record<string, unknown> = {}) => ({
  id: 52, waId: 'offline-only', state: 'building_cart', humanTakeover: false,
  lastInboundAt: before(46), lastMessageAt: before(46), updatedAt: before(46),
  sessionData: { cart: [{ productId: 1, quantity: 1 }], address: 'calle de prueba' },
  ...overrides,
});
function setup(live = draft(), cfg = {}) {
  let current = live;
  const conversations = {
    findAgentIdleTakeovers: jest.fn().mockResolvedValue([]),
    findClientIdleTakeovers: jest.fn().mockResolvedValue([]),
    findIdlePendingChoices: jest.fn().mockResolvedValue([]),
    findIdleMpPayments: jest.fn().mockResolvedValue([]),
    findIdleOrderDrafts: jest.fn().mockResolvedValue([draft()]),
    reloadConversation: jest.fn(async () => current),
    getSession: jest.fn((conv) => ({ cart: [], ...conv.sessionData })),
    resetIdleOrderDraft: jest.fn(async () => {
      current = { ...current, state: 'building_cart', sessionData: { cart: [] } } as any;
      return true;
    }),
    resetOrderSession: jest.fn(), logMessage: jest.fn(), touchOutbound: jest.fn(),
  };
  const meta = { sendText: jest.fn() };
  const service = new WhatsappCleanupService(conversations as any, {
    getEffectiveConfig: async () => ({ orderDraftIdleMinutes: 45, ...cfg }),
  } as any, meta as any);
  return { conversations, meta, run: () => (service as any).runSessionExpiry() };
}

describe('381: draft expiry does not reopen or mislabel confirmed orders', () => {
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
  afterEach(() => jest.restoreAllMocks());

  it.each(['completed', 'closed', 'confirming', 'awaiting_mp_payment'])('skips live state %s even with stale cart', async (state) => {
    const h = setup(draft({ state })); await h.run();
    expect(h.conversations.resetIdleOrderDraft).not.toHaveBeenCalled();
    expect(h.meta.sendText).not.toHaveBeenCalled();
  });
  it.each([
    { humanTakeover: true }, { lastInboundAt: before(1) },
    { lastInboundAt: new Date('invalid') },
    { sessionData: { cart: [], address: 'saved address', paymentMethod: 'cash' } },
    { state: 'awaiting_name', sessionData: { cart: [] } },
    { state: 'awaiting_final_confirm', lastInboundAt: before(89) },
  ])('does not expire changed/empty/not-yet-idle conversation %j', async (override) => {
    const h = setup(draft(override)); await h.run();
    expect(h.conversations.resetIdleOrderDraft).not.toHaveBeenCalled();
    expect(h.meta.sendText).not.toHaveBeenCalled();
  });
  it.each([1440, 2880, 56])('clears genuinely abandoned draft at %i minutes without a late notice', async (age) => {
    const h = setup(draft({ lastInboundAt: before(age) })); await h.run();
    expect(h.conversations.resetIdleOrderDraft).toHaveBeenCalledTimes(1);
    expect(h.meta.sendText).not.toHaveBeenCalled();
  });
  it.each(['building_cart', 'awaiting_final_confirm'])('expires timely draft in %s once and logs notice', async (state) => {
    const h = setup(draft({ state, lastInboundAt: before(state === 'building_cart' ? 46 : 91) }));
    await h.run(); await h.run();
    expect(h.conversations.resetIdleOrderDraft).toHaveBeenCalledTimes(1);
    expect(h.meta.sendText).toHaveBeenCalledTimes(1);
    expect(h.conversations.logMessage).toHaveBeenCalledWith(expect.objectContaining({ sentBy: 'system', body: expect.stringContaining('expiró') }));
    expect(h.conversations.resetOrderSession).not.toHaveBeenCalled();
  });
  it('suppresses notification when conditional reset loses a race', async () => {
    const h = setup(); h.conversations.resetIdleOrderDraft.mockResolvedValue(false);
    await h.run(); expect(h.meta.sendText).not.toHaveBeenCalled();
  });
  it.each([
    { state: 'completed' }, { humanTakeover: true },
    { lastInboundAt: before(0) },
    { sessionData: { cart: [{ productId: 2, quantity: 1 }] } },
  ])('rechecks changes before notification: %j', async (override) => {
    const h = setup();
    h.conversations.reloadConversation.mockResolvedValueOnce(draft()).mockResolvedValue(draft(override));
    await h.run(); expect(h.meta.sendText).not.toHaveBeenCalled();
  });
  it('respects disabled notifications', async () => {
    const h = setup(draft(), { sessionIdleNotify: false }); await h.run();
    expect(h.conversations.resetIdleOrderDraft).toHaveBeenCalledTimes(1);
    expect(h.meta.sendText).not.toHaveBeenCalled();
  });
  it('respects disabled expiry even with stale candidates', async () => {
    const h = setup(draft(), { orderDraftIdleMinutes: 0 }); await h.run();
    expect(h.conversations.resetIdleOrderDraft).not.toHaveBeenCalled();
  });
});

describe('381: conditional draft reset persistence', () => {
  function persistence(affected = 1) {
    const query: any = { execute: jest.fn().mockResolvedValue({ affected }) };
    for (const method of ['update', 'set', 'setParameter', 'where', 'andWhere']) query[method] = jest.fn().mockReturnValue(query);
    const repo = { createQueryBuilder: jest.fn(() => query), save: jest.fn() };
    const service = new WhatsappConversationService(repo as any, {} as any, {} as any, {} as any);
    return { service, repo, query };
  }
  it.each([0, 1])('returns success only for an affected row (%i)', async (affected) => {
    const h = persistence(affected); const conv = draft(); const snapshot = JSON.stringify(conv);
    expect(await h.service.resetIdleOrderDraft(conv as any)).toBe(affected === 1);
    expect(JSON.stringify(conv)).toBe(snapshot);
    expect(h.repo.save).not.toHaveBeenCalled();
    const filters = h.query.andWhere.mock.calls;
    expect(filters).toContainEqual(['state = :state', { state: conv.state }]);
    expect(filters).toContainEqual(['human_takeover = 0']);
    expect(filters).toContainEqual(['last_inbound_at <=> :lastInboundAt', { lastInboundAt: conv.lastInboundAt }]);
    expect(filters).toContainEqual(['BINARY session_data <=> BINARY :snapshot', { snapshot: JSON.stringify(conv.sessionData) }]);
    expect(JSON.parse(h.query.setParameter.mock.calls[0][1])).toEqual(expect.objectContaining({ cart: [], ignorePriorOrderHistory: true }));
    expect(h.query.set).toHaveBeenCalledWith(expect.objectContaining({ state: 'building_cart', sessionData: expect.any(Function) }));
  });
  it.each(['completed', 'closed', 'confirming'])('refuses to reset %s before SQL', async (state) => {
    const h = persistence(); expect(await h.service.resetIdleOrderDraft(draft({ state }) as any)).toBe(false);
    expect(h.repo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
