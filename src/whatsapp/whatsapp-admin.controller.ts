import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid.roles.interface';
import { Request, Response } from 'express';
import { User } from '../auth/entities/user.entity';
import {
  SendWhatsappMessageDto,
  TakeoverWhatsappConversationDto,
  TestDeliveryQuoteDto,
  UpdateWhatsappSettingsDto,
} from './dto/whatsapp.dto';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';

@ApiTags('Admin WhatsApp')
@Controller('admin/whatsapp')
@Auth(ValidRoles.admin)
@ApiBearerAuth()
export class WhatsappAdminController {
  constructor(
    private readonly settingsService: WhatsappSettingsService,
    private readonly conversationService: WhatsappConversationService,
    private readonly orchestrator: WhatsappOrchestratorService,
    private readonly metaService: WhatsappMetaService,
    private readonly deliveryRouting: WhatsappDeliveryRoutingService,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Configuración del bot WhatsApp' })
  async getSettings() {
    const row = await this.settingsService.getSettings();
    return this.settingsService.maskSettings(row);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Actualizar configuración WhatsApp' })
  async updateSettings(@Body() dto: UpdateWhatsappSettingsDto) {
    const row = await this.settingsService.updateSettings(dto);
    return this.settingsService.maskSettings(row);
  }

  @Post('delivery/quote-test')
  @ApiOperation({
    summary: 'Probar cálculo de domicilio por ruta (Geocoding + Directions)',
  })
  async testDeliveryQuote(@Body() dto: TestDeliveryQuoteDto) {
    const cfg = await this.settingsService.getEffectiveConfig();
    const address = (dto.address || '').trim();
    const hasCoords =
      dto.lat != null &&
      dto.lng != null &&
      Number.isFinite(Number(dto.lat)) &&
      Number.isFinite(Number(dto.lng));

    if (!address && !hasCoords) {
      return {
        ok: false,
        error: 'Envía address y/o lat+lng',
        hint: 'Ej: { "address": "Calle 80 #100-20, Bogotá" }',
      };
    }

    const apiKeyConfigured = this.deliveryRouting.hasApiKey();
    const restaurant = {
      lat: Number(cfg.restaurantLat),
      lng: Number(cfg.restaurantLng),
    };

    if (cfg.deliveryFeeMode === 'fixed') {
      return {
        ok: true,
        mode: 'fixed',
        apiKeyConfigured,
        restaurant,
        fee: cfg.defaultDeliveryFee,
        message: `Modo tarifa fija: $${cfg.defaultDeliveryFee.toLocaleString('es-CO')}`,
      };
    }

    const quote = await this.deliveryRouting.quoteDeliveryFee({
      customerAddress: address || `${dto.lat},${dto.lng}`,
      customerCoords: hasCoords
        ? { lat: Number(dto.lat), lng: Number(dto.lng) }
        : null,
      restaurant,
      tiers: cfg.deliveryFeeTiers || [],
      maxKm: Number(cfg.deliveryMaxKm) || 5.5,
      fallbackFee: cfg.defaultDeliveryFee,
      regionBias: 'co',
    });

    return {
      ok: quote.ok,
      mode: cfg.deliveryFeeMode,
      apiKeyConfigured,
      restaurant,
      tiers: cfg.deliveryFeeTiers,
      maxKm: cfg.deliveryMaxKm,
      input: {
        address: address || null,
        lat: hasCoords ? Number(dto.lat) : null,
        lng: hasCoords ? Number(dto.lng) : null,
      },
      quote,
    };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Listar conversaciones recientes' })
  async listConversations() {
    const rows = await this.conversationService.listConversations(80);
    return rows.map(({ conversation: c, lastMessage, inboxStatus }) => ({
      id: c.id,
      phoneE164: c.phoneE164,
      customerName: c.customerName,
      state: c.state,
      inboxStatus,
      humanTakeover: !!c.humanTakeover,
      humanAgentName: c.humanAgentName,
      lastMessageAt: c.lastMessageAt,
      lastInboundAt: c.lastInboundAt,
      updatedAt: c.updatedAt,
      cartCount: (c.sessionData as WhatsappSessionData | null)?.cart?.length ?? 0,
      lastMessagePreview: lastMessage?.body?.slice(0, 120) ?? null,
      lastMessageDirection: lastMessage?.direction ?? null,
      lastMessageSentBy: lastMessage?.sentBy ?? null,
    }));
  }

  @Get('conversations/:id')
  async getConversation(@Param('id', ParseIntPipe) id: number) {
    const conv = await this.conversationService.getConversation(id);
    const session = conv.sessionData as WhatsappSessionData | null;
    return {
      id: conv.id,
      waId: conv.waId,
      phoneE164: conv.phoneE164,
      customerName: conv.customerName,
      state: conv.state,
      inboxStatus: this.conversationService.deriveInboxStatus(conv),
      sessionData: conv.sessionData,
      humanTakeover: !!conv.humanTakeover,
      humanAgentName: conv.humanAgentName,
      cartCount: session?.cart?.length ?? 0,
      orderType: session?.orderType ?? null,
      paymentMethod: session?.paymentMethod ?? null,
      address: session?.address ?? null,
      messages: (conv.messages || []).map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        sentBy: m.sentBy,
        createdAt: m.createdAt,
        messageType: m.messageType || 'text',
        mediaId: m.mediaId,
        mimeType: m.mimeType,
        hasMedia: !!m.mediaId,
      })),
    };
  }

  @Get('conversations/:id/messages/:messageId/media')
  @ApiOperation({ summary: 'Proxy de audio/imagen desde Meta' })
  async getMessageMedia(
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId') messageId: string,
    @Res() res: Response,
  ) {
    const msg = await this.conversationService.getMessage(id, messageId);
    if (!msg.mediaId) {
      return res.status(404).json({ message: 'Este mensaje no tiene media' });
    }
    try {
      const { buffer, mimeType } = await this.metaService.downloadMedia(msg.mediaId);
      res.setHeader('Content-Type', msg.mimeType || mimeType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.send(buffer);
    } catch {
      return res.status(404).json({
        message: 'No se pudo cargar el archivo (puede haber expirado en Meta)',
      });
    }
  }

  @Post('conversations/:id/takeover')
  async takeover(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TakeoverWhatsappConversationDto,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    const takeover = body.takeover !== false;
    await this.conversationService.setHumanTakeover(id, takeover, {
      id: user.id,
      fullName: user.fullName,
    });
    return { success: true, humanTakeover: takeover };
  }

  @Post('conversations/:id/close')
  @ApiOperation({ summary: 'Archivar / cerrar conversación en el inbox' })
  async closeConversation(@Param('id', ParseIntPipe) id: number) {
    await this.conversationService.closeConversation(id);
    return { success: true, state: 'closed' };
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendWhatsappMessageDto,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    await this.orchestrator.sendHumanReply(id, dto.body, {
      id: user.id,
      fullName: user.fullName,
    });
    return { success: true };
  }
}
