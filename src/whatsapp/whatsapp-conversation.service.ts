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

  async reloadConversation(id: number): Promise<WhatsappConversation> {
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }

  async countInboundMessages(conversationId: number): Promise<number> {
    return this.msgRepo.count({ where: { conversationId, direction: 'in' } });
  }

  async logMessage(params: {
    conversationId: number;
    direction: 'in' | 'out';
    body: string;
    waMessageId?: string;
    sentBy?: 'bot' | 'human' | 'system';
    raw?: Record<string, unknown>;
  }) {
    const msg = this.msgRepo.create({
      conversationId: params.conversationId,
      direction: params.direction,
      body: params.body,
      waMessageId: params.waMessageId ?? null,
      sentBy: params.sentBy ?? (params.direction === 'in' ? 'bot' : 'bot'),
      rawPayload: params.raw ?? null,
      messageType: 'text',
    });
    return this.msgRepo.save(msg);
  }

  async listConversations(limit = 50) {
    return this.convRepo.find({
      order: { updatedAt: 'DESC' },
      take: limit,
    });
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
    conv.humanTakeover = takeover;
    conv.humanAgentId = takeover && agent ? agent.id : null;
    conv.humanAgentName = takeover && agent ? agent.fullName : null;
    return this.convRepo.save(conv);
  }

  async getRecentMessageTexts(conversationId: number, limit = 10): Promise<string[]> {
    const rows = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.reverse().map((r) => `${r.direction === 'in' ? 'Cliente' : 'Bot'}: ${r.body || ''}`);
  }
}
