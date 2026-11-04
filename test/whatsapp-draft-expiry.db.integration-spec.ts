import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { WhatsappConversation } from '../src/whatsapp/entities/whatsapp-conversation.entity';
import { WhatsappMessage } from '../src/whatsapp/entities/whatsapp-message.entity';
import { WhatsappConversationService } from '../src/whatsapp/whatsapp-conversation.service';

if (process.env.WHATSAPP_DB_TEST !== '1' || process.env.TEST_DB_HOST !== '127.0.0.1' ||
    process.env.TEST_DB_DATABASE !== 'ppp_test_whatsapp_381') {
  throw new Error('Requires explicit isolated loopback ppp_test_whatsapp_381 database');
}

describe('381: real MariaDB atomic draft expiry', () => {
  const db = new DataSource({ type: 'mariadb', host: '127.0.0.1',
    port: Number(process.env.TEST_DB_PORT), username: process.env.TEST_DB_USERNAME,
    password: process.env.TEST_DB_PASSWORD, database: 'ppp_test_whatsapp_381',
    entities: [WhatsappConversation, WhatsappMessage], synchronize: true, timezone: 'Z' });
  let service: WhatsappConversationService;
  beforeAll(async () => {
    await db.initialize();
    service = new WhatsappConversationService(db.getRepository(WhatsappConversation),
      db.getRepository(WhatsappMessage), {} as never, {} as never);
  });
  afterAll(async () => { if (db.isInitialized) await db.destroy(); });
  async function fixture() {
    const saved = await db.getRepository(WhatsappConversation).save({
      waId: 'synthetic', phoneE164: 'synthetic', state: 'awaiting_final_confirm',
      lastInboundAt: new Date('2026-11-01T12:00:00Z'),
      lastMessageAt: new Date('2026-11-01T12:00:00Z'),
      sessionData: { cart: [{ productId: 7, quantity: 1 }], linkedUserId: 3,
        lastDeliveryAddress: 'saved reference', address: 'draft address' },
    });
    return service.reloadConversation(saved.id);
  }
  it('clears an unchanged draft, preserves profile memory and cannot repeat', async () => {
    const snapshot = await fixture();
    expect(await service.resetIdleOrderDraft(snapshot)).toBe(true);
    const live = await service.reloadConversation(snapshot.id);
    expect(live.state).toBe('building_cart');
    expect(live.sessionData).toEqual(expect.objectContaining({ cart: [], linkedUserId: 3, lastDeliveryAddress: 'saved reference' }));
    expect(live.sessionData?.address).toBeUndefined();
    expect(await service.resetIdleOrderDraft(snapshot)).toBe(false);
  });
  it.each([
    ['state', 'completed'], ['human_takeover', 1],
    ['updated_at', new Date('2026-11-03T12:00:00Z')],
    ['last_inbound_at', new Date('2026-11-03T12:00:00Z')],
    ['last_message_at', new Date('2026-11-03T12:00:00Z')],
    ['session_data', JSON.stringify({ cart: [{ productId: 7, quantity: 2 }] })],
  ])('does not overwrite concurrent %s change even when updated_at is unchanged', async (column, value) => {
    const snapshot = await fixture();
    // Fixed allowlist above; simulate second-resolution updates without relying on updated_at.
    if (column === 'updated_at') {
      await db.query('UPDATE ppp_whatsapp_conversations SET updated_at = ? WHERE id = ?', [value, snapshot.id]);
    } else {
      // Explicit assignment prevents MariaDB ON UPDATE from protecting this test for us.
      await db.query(`UPDATE ppp_whatsapp_conversations SET ${column} = ?, updated_at = ? WHERE id = ?`,
        [value, snapshot.updatedAt, snapshot.id]);
    }
    const before = await service.reloadConversation(snapshot.id);
    expect(await service.resetIdleOrderDraft(snapshot)).toBe(false);
    expect(await service.reloadConversation(snapshot.id)).toEqual(before);
  });
  it('only one of two concurrent cleaners can clear the draft', async () => {
    const snapshot = await fixture();
    const results = await Promise.all([service.resetIdleOrderDraft(snapshot), service.resetIdleOrderDraft(snapshot)]);
    expect(results.sort()).toEqual([false, true]);
  });
});
