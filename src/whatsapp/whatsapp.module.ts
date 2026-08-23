import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappSettings } from './entities/whatsapp-settings.entity';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';
import { WhatsappMessage } from './entities/whatsapp-message.entity';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappCleanupService } from './whatsapp-cleanup.service';
import { WhatsappRateLimitService } from './whatsapp-rate-limit.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappAdminController } from './whatsapp-admin.controller';
import { WhatsappDeskController } from './whatsapp-desk.controller';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { BusinessModule } from '../business/business.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappSettings, WhatsappConversation, WhatsappMessage, User]),
    AuthModule,
    ProductsModule,
    BusinessModule,
    OrdersModule,
    PaymentsModule,
  ],
  controllers: [WhatsappWebhookController, WhatsappAdminController, WhatsappDeskController],
  providers: [
    WhatsappSettingsService,
    WhatsappMetaService,
    WhatsappCatalogService,
    WhatsappAiService,
    WhatsappConversationService,
    WhatsappOrchestratorService,
    WhatsappActionGuardService,
    WhatsappCleanupService,
    WhatsappRateLimitService,
  ],
  exports: [WhatsappSettingsService, WhatsappOrchestratorService, WhatsappMetaService],
})
export class WhatsappModule {}
