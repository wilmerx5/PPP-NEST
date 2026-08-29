import {
  BadRequestException,
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid.roles.interface';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { User } from '../auth/entities/user.entity';
import {
  SendWhatsappMessageDto,
  TakeoverWhatsappConversationDto,
} from './dto/whatsapp.dto';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { WhatsappAdminAlertService } from './whatsapp-admin-alert.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';

/**
 * Inbox para asesores (whatsappUser) y admin.
 * Sin acceso a tokens Meta / OpenAI / settings.
 */
@ApiTags('WhatsApp Desk')
@Controller('whatsapp-desk')
@Auth(ValidRoles.admin, ValidRoles.whatsappUser)
@ApiBearerAuth()
export class WhatsappDeskController {
  constructor(
    private readonly conversationService: WhatsappConversationService,
    private readonly orchestrator: WhatsappOrchestratorService,
    private readonly metaService: WhatsappMetaService,
    private readonly adminAlerts: WhatsappAdminAlertService,
  ) {}

  @Sse('alerts/stream')
  @ApiOperation({
    summary: 'SSE: aviso inmediato cuando un chat pide ASESOR (pestaña en segundo plano)',
  })
  alertsStream(): Observable<MessageEvent> {
    return this.adminAlerts.asSse();
  }

  @Get('me')
  @ApiOperation({ summary: 'Perfil mínimo del agente' })
  me(@Req() req: Request) {
    const user = req.user as User;
    return {
      id: user.id,
      fullName: user.fullName,
      roles: user.roles,
    };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Listar conversaciones' })
  async listConversations() {
    const rows = await this.conversationService.listConversations(100);
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
    if (!takeover) {
      await this.orchestrator.releaseToBot(id, { reason: 'manual' });
    } else {
      await this.conversationService.setHumanTakeover(id, takeover, {
        id: user.id,
        fullName: user.fullName,
      });
    }
    return { success: true, humanTakeover: takeover };
  }

  @Post('conversations/:id/close')
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

  @Post('conversations/:id/messages/media')
  @ApiOperation({ summary: 'Enviar imagen, documento, video o audio' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async sendMedia(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
    @Body('caption') caption: string | undefined,
    @Req() req: Request,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Adjunta un archivo (campo file)');
    }
    const user = req.user as User;
    return this.orchestrator.sendHumanMedia(
      id,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      },
      { id: user.id, fullName: user.fullName },
      caption,
    );
  }
}
