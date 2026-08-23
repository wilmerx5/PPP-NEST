import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid.roles.interface';
import { Request } from 'express';
import { User } from '../auth/entities/user.entity';
import {
  SendWhatsappMessageDto,
  TakeoverWhatsappConversationDto,
  UpdateWhatsappSettingsDto,
} from './dto/whatsapp.dto';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
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

  @Get('conversations')
  @ApiOperation({ summary: 'Listar conversaciones recientes' })
  async listConversations() {
    const rows = await this.conversationService.listConversations(80);
    return rows.map((c) => ({
      id: c.id,
      phoneE164: c.phoneE164,
      customerName: c.customerName,
      state: c.state,
      humanTakeover: !!c.humanTakeover,
      humanAgentName: c.humanAgentName,
      lastMessageAt: c.lastMessageAt,
      updatedAt: c.updatedAt,
      cartCount: (c.sessionData as WhatsappSessionData | null)?.cart?.length ?? 0,
    }));
  }

  @Get('conversations/:id')
  async getConversation(@Param('id', ParseIntPipe) id: number) {
    const conv = await this.conversationService.getConversation(id);
    return {
      id: conv.id,
      waId: conv.waId,
      phoneE164: conv.phoneE164,
      customerName: conv.customerName,
      state: conv.state,
      sessionData: conv.sessionData,
      humanTakeover: !!conv.humanTakeover,
      humanAgentName: conv.humanAgentName,
      messages: (conv.messages || []).map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        sentBy: m.sentBy,
        createdAt: m.createdAt,
      })),
    };
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
