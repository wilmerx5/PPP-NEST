import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';
import { WhatsappMessage } from './entities/whatsapp-message.entity';
import { EMPTY_SESSION, type WhatsappSessionData } from './types/whatsapp-session.types';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class WhatsappConversationService {
  constructor(
    @InjectRepository(WhatsappConversation)
    private readonly convRepo: Repository<WhatsappConversation>,
    @InjectRepository(WhatsappMessage)
    private readonly msgRepo: Repository<WhatsappMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findOrCreateConversation(waId: string, phoneE164: string): Promise<WhatsappConversation> {
    let conv = await this.convRepo.findOne({ where: { waId } });
    if (conv) return conv;

    const linked = await this.findUserByPhone(phoneE164);
    conv = this.convRepo.create({
      waId,
      phoneE164,
      state: 'building_cart',
      sessionData: {
        ...EMPTY_SESSION,
        linkedUserId: linked?.id ?? null,
        linkedUserName: linked?.fullName ?? null,
      },
      customerName: linked?.fullName ?? null,
    });
    return this.convRepo.save(conv);
  }

  async touchInbound(conv: WhatsappConversation) {
    conv.lastInboundAt = new Date();
    conv.lastMessageAt = new Date();
    return this.convRepo.save(conv);
  }

  async touchOutbound(conv: WhatsappConversation, kind: 'bot' | 'human' = 'bot') {
    const now = new Date();
    conv.lastMessageAt = now;
    if (kind === 'human') {
      conv.lastHumanOutboundAt = now;
    }
    return this.convRepo.save(conv);
  }

  async updateCustomerName(conv: WhatsappConversation, name: string) {
    conv.customerName = name.trim();
    return this.convRepo.save(conv);
  }

  async findUserByPhone(phoneE164: string): Promise<User | null> {
    const digits = phoneE164.replace(/\D/g, '');
    const tail = digits.slice(-10);
    if (tail.length < 10) return null;
    return this.userRepo
      .createQueryBuilder('u')
      .where('REPLACE(REPLACE(REPLACE(u.phone, " ", ""), "+", ""), "-", "") LIKE :tail', {
        tail: `%${tail}`,
      })
      .andWhere('u.isActive = 1')
      .getOne();
  }

  getSession(conv: WhatsappConversation): WhatsappSessionData {
    const raw = (conv.sessionData || {}) as Partial<WhatsappSessionData>;
    return {
      ...EMPTY_SESSION,
      ...raw,
      cart: Array.isArray(raw.cart) ? raw.cart : [],
    };
  }

  async saveSession(conv: WhatsappConversation, patch: Partial<WhatsappSessionData>, state?: string) {
    const current = this.getSession(conv);
    const next: WhatsappSessionData = {
      ...current,
      ...patch,
      // Nunca perder el carrito si el patch no trae cart explícito
      cart: patch.cart !== undefined ? patch.cart : current.cart,
    };
    // Limpiar claves undefined para JSON limpio en MariaDB
    conv.sessionData = JSON.parse(JSON.stringify(next)) as WhatsappSessionData;
    if (state) conv.state = state;
    conv.lastMessageAt = new Date();
    const saved = await this.convRepo.save(conv);
    // Releer para asegurar session_data desde DB
    const fresh = await this.convRepo.findOne({ where: { id: saved.id } });
    if (fresh) {
      conv.sessionData = fresh.sessionData;
      conv.state = fresh.state;
      conv.customerName = fresh.customerName;
    }
    return conv;
  }

  /**
   * Limpia carrito y checkout por completo (post-pedido / reopen / reinicio).
   * Conserva vínculo web y última dirección de domicilio.
   */
  async resetOrderSession(
    conv: WhatsappConversation,
    state: string,
    opts?: { ignorePriorHistory?: boolean; rememberDeliveryAddress?: boolean },
  ): Promise<WhatsappConversation> {
    const current = this.getSession(conv);
    const currentAddr = (current.address || '').trim();
    const isPickupPlaceholder = /^recoge en el local/i.test(currentAddr);
    const remembered =
      opts?.rememberDeliveryAddress &&
      current.orderType === 'delivery' &&
      currentAddr &&
      !isPickupPlaceholder
        ? currentAddr
        : current.lastDeliveryAddress ?? null;

    const next: WhatsappSessionData = {
      cart: [],
      orderType: 'delivery',
      linkedUserId: current.linkedUserId ?? null,
      linkedUserName: current.linkedUserName ?? null,
      ignorePriorOrderHistory: opts?.ignorePriorHistory !== false,
      fulfillmentChosen: false,
      addressConfirmed: false,
      phoneConfirmed: false,
      contactPhone: null,
      lastDeliveryAddress: remembered,
    };
    // Asignación directa: no mergear con el carrito viejo
    conv.sessionData = next;
    conv.state = state;
    conv.lastMessageAt = new Date();
    const saved = await this.convRepo.save(conv);
    const fresh = await this.convRepo.findOne({ where: { id: saved.id } });
    if (fresh) {
      conv.sessionData = fresh.sessionData;
      conv.state = fresh.state;
      conv.customerName = fresh.customerName;
      conv.humanTakeover = fresh.humanTakeover;
    }
    return conv;
  }

  async reloadConversation(id: number): Promise<WhatsappConversation> {
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }

  async countInboundMessages(conversationId: number): Promise<number> {
    return this.msgRepo.count({ where: { conversationId, direction: 'in' } });
  }

  async findByWaMessageId(waMessageId: string): Promise<WhatsappMessage | null> {
    const id = (waMessageId || '').trim();
    if (!id) return null;
    return this.msgRepo.findOne({ where: { waMessageId: id } });
  }

  async logMessage(params: {
    conversationId: number;
    direction: 'in' | 'out';
    body: string;
    waMessageId?: string;
    sentBy?: 'bot' | 'human' | 'system';
    raw?: Record<string, unknown>;
    messageType?: string;
    mediaId?: string;
    mimeType?: string;
  }) {
    if (params.waMessageId) {
      const existing = await this.findByWaMessageId(params.waMessageId);
      if (existing) return existing;
    }
    try {
      const msg = this.msgRepo.create({
        conversationId: params.conversationId,
        direction: params.direction,
        body: params.body,
        waMessageId: params.waMessageId ?? null,
        sentBy: params.sentBy ?? (params.direction === 'in' ? 'bot' : 'bot'),
        rawPayload: params.raw ?? null,
        messageType: params.messageType || 'text',
        mediaId: params.mediaId ?? null,
        mimeType: params.mimeType ?? null,
      });
      return await this.msgRepo.save(msg);
    } catch (err: unknown) {
      // Carrera de dedupe: unique wa_message_id
      if (params.waMessageId) {
        const again = await this.findByWaMessageId(params.waMessageId);
        if (again) return again;
      }
      throw err;
    }
  }

  async updateMessageBody(messageId: string, body: string) {
    await this.msgRepo.update({ id: messageId }, { body });
  }

  async getMessage(conversationId: number, messageId: string) {
    const msg = await this.msgRepo.findOne({
      where: { id: messageId, conversationId },
    });
    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    return msg;
  }

  async listConversations(limit = 80) {
    const rows = await this.convRepo.find({
      order: { updatedAt: 'DESC' },
      take: limit,
    });
    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    const lastByConv = new Map<
      number,
      { body: string; direction: string; sentBy: string; createdAt: Date }
    >();

    const placeholders = ids.map(() => '?').join(',');
    const lastRows: Array<{
      conversation_id: number;
      body: string | null;
      direction: string;
      sent_by: string;
      created_at: Date;
    }> = await this.msgRepo.query(
      `
      SELECT m.conversation_id, m.body, m.direction, m.sent_by, m.created_at
      FROM ppp_whatsapp_messages m
      INNER JOIN (
        SELECT conversation_id, MAX(id) AS max_id
        FROM ppp_whatsapp_messages
        WHERE conversation_id IN (${placeholders})
        GROUP BY conversation_id
      ) t ON m.id = t.max_id
      `,
      ids,
    );

    for (const row of lastRows) {
      lastByConv.set(Number(row.conversation_id), {
        body: row.body || '',
        direction: row.direction,
        sentBy: row.sent_by,
        createdAt: row.created_at,
      });
    }

    return rows.map((c) => {
      const last = lastByConv.get(c.id) ?? null;
      return {
        conversation: c,
        lastMessage: last,
        inboxStatus: this.deriveInboxStatus(c),
      };
    });
  }

  deriveInboxStatus(c: WhatsappConversation): 'needs_human' | 'ordering' | 'completed' | 'closed' {
    if (c.humanTakeover) return 'needs_human';
    if (c.state === 'closed') return 'closed';
    if (c.state === 'completed') return 'completed';
    return 'ordering';
  }

  async getConversation(id: number) {
    const conv = await this.convRepo.findOne({
      where: { id },
      relations: ['messages'],
      order: { messages: { createdAt: 'ASC' } } as any,
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    conv.messages = (conv.messages || []).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return conv;
  }

  async setHumanTakeover(
    id: number,
    takeover: boolean,
    agent?: { id: string; fullName: string },
  ) {
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    const now = new Date();
    conv.humanTakeover = takeover;
    conv.humanAgentId = takeover && agent ? agent.id : null;
    conv.humanAgentName = takeover && agent ? agent.fullName : null;
    if (takeover) {
      conv.humanTakeoverAt = now;
      // Si el agente acaba de tomar el chat, cuenta como actividad
      conv.lastHumanOutboundAt = now;
      if (conv.state === 'closed') conv.state = 'building_cart';
    } else {
      conv.humanTakeoverAt = null;
    }
    return this.convRepo.save(conv);
  }

  async closeConversation(id: number) {
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    conv.state = 'closed';
    conv.humanTakeover = false;
    conv.humanAgentId = null;
    conv.humanAgentName = null;
    conv.humanTakeoverAt = null;
    conv.sessionData = {
      cart: [],
      orderType: 'delivery',
      linkedUserId: this.getSession(conv).linkedUserId ?? null,
      linkedUserName: this.getSession(conv).linkedUserName ?? null,
      ignorePriorOrderHistory: true,
    };
    return this.convRepo.save(conv);
  }

  /** Libera takeover sin tocar el carrito (bot retoma). */
  async releaseHumanTakeover(id: number) {
    return this.setHumanTakeover(id, false);
  }

  /** Limpia solo pendingMatch / pendingAttribute. */
  async clearPendingChoices(conv: WhatsappConversation) {
    const session = this.getSession(conv);
    return this.saveSession(
      conv,
      {
        ...session,
        pendingMatch: undefined,
        pendingAttribute: undefined,
      },
      conv.state === 'awaiting_attribute' ? 'building_cart' : conv.state,
    );
  }

  /**
   * Conversaciones con takeover donde el agente no escribe hace `minutes`.
   * Usa COALESCE(last_human_outbound_at, human_takeover_at).
   */
  async findAgentIdleTakeovers(minutes: number, limit = 50): Promise<WhatsappConversation[]> {
    if (minutes <= 0) return [];
    return this.convRepo
      .createQueryBuilder('c')
      .where('c.humanTakeover = 1')
      .andWhere(
        'COALESCE(c.lastHumanOutboundAt, c.humanTakeoverAt, c.updatedAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)',
        { m: minutes },
      )
      .orderBy('c.updatedAt', 'ASC')
      .take(limit)
      .getMany();
  }

  /** Takeover + cliente sin inbound hace `minutes`. */
  async findClientIdleTakeovers(minutes: number, limit = 50): Promise<WhatsappConversation[]> {
    if (minutes <= 0) return [];
    return this.convRepo
      .createQueryBuilder('c')
      .where('c.humanTakeover = 1')
      .andWhere(
        'COALESCE(c.lastInboundAt, c.humanTakeoverAt, c.createdAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)',
        { m: minutes },
      )
      .orderBy('c.updatedAt', 'ASC')
      .take(limit)
      .getMany();
  }

  /** Pedidos a medias (sin humano) sin actividad. */
  async findIdleOrderDrafts(minutes: number, limit = 50): Promise<WhatsappConversation[]> {
    if (minutes <= 0) return [];
    const states = [
      'building_cart',
      'awaiting_name',
      'awaiting_fulfillment',
      'awaiting_address',
      'awaiting_phone',
      'awaiting_payment',
      'awaiting_notes',
      'awaiting_final_confirm',
      'confirming',
    ];
    return this.convRepo
      .createQueryBuilder('c')
      .where('c.humanTakeover = 0')
      .andWhere('c.state IN (:...states)', { states })
      .andWhere(
        'COALESCE(c.lastInboundAt, c.lastMessageAt, c.updatedAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)',
        { m: minutes },
      )
      .orderBy('c.updatedAt', 'ASC')
      .take(limit)
      .getMany();
  }

  async findIdlePendingChoices(minutes: number, limit = 50): Promise<WhatsappConversation[]> {
    if (minutes <= 0) return [];
    return this.convRepo
      .createQueryBuilder('c')
      .where('c.humanTakeover = 0')
      .andWhere(
        `(c.state = :attr
          OR JSON_EXTRACT(c.session_data, '$.pendingMatch') IS NOT NULL
          OR JSON_EXTRACT(c.session_data, '$.pendingAttribute') IS NOT NULL)`,
        { attr: 'awaiting_attribute' },
      )
      .andWhere(
        'COALESCE(c.lastInboundAt, c.lastMessageAt, c.updatedAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)',
        { m: minutes },
      )
      .orderBy('c.updatedAt', 'ASC')
      .take(limit)
      .getMany();
  }

  async findIdleMpPayments(minutes: number, limit = 50): Promise<WhatsappConversation[]> {
    if (minutes <= 0) return [];
    return this.convRepo
      .createQueryBuilder('c')
      .where('c.humanTakeover = 0')
      .andWhere('c.state = :st', { st: 'awaiting_mp_payment' })
      .andWhere(
        'COALESCE(c.lastInboundAt, c.lastMessageAt, c.updatedAt) < DATE_SUB(NOW(), INTERVAL :m MINUTE)',
        { m: minutes },
      )
      .orderBy('c.updatedAt', 'ASC')
      .take(limit)
      .getMany();
  }

  /** Segundo pedido / reabrir: mismo chat por número, estado fresco. */
  async reopenForNewOrder(conv: WhatsappConversation) {
    if (conv.state !== 'completed' && conv.state !== 'closed') return conv;
    return this.resetOrderSession(conv, 'building_cart', { ignorePriorHistory: true });
  }

  async getRecentMessageTexts(conversationId: number, limit = 10): Promise<string[]> {
    const rows = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.reverse().map((r) => `${r.direction === 'in' ? 'Cliente' : 'Bot'}: ${r.body || ''}`);
  }

  /**
   * Borra mensajes más viejos que `retentionDays` (por defecto 90).
   * Lotes para no bloquear la tabla.
   */
  async purgeMessagesOlderThan(retentionDays = 90, batchSize = 2000): Promise<number> {
    const days = Math.max(1, Math.floor(retentionDays));
    const batch = Math.min(5000, Math.max(100, Math.floor(batchSize)));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let total = 0;
    for (let i = 0; i < 50; i++) {
      const oldIds = await this.msgRepo
        .createQueryBuilder('m')
        .select('m.id', 'id')
        .where('m.createdAt < :cutoff', { cutoff })
        .orderBy('m.id', 'ASC')
        .take(batch)
        .getRawMany<{ id: string }>();
      if (!oldIds.length) break;

      const ids = oldIds.map((r) => r.id);
      const del = await this.msgRepo
        .createQueryBuilder()
        .delete()
        .from(WhatsappMessage)
        .where('id IN (:...ids)', { ids })
        .execute();

      const n = del.affected ?? 0;
      total += n;
      if (n < batch) break;
    }
    return total;
  }
}
