import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService, IncomingWhatsappText } from './whatsapp-meta.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { BusinessService } from '../business/business.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
export declare class WhatsappOrchestratorService {
    private readonly settingsService;
    private readonly metaService;
    private readonly catalogService;
    private readonly aiService;
    private readonly conversationService;
    private readonly businessService;
    private readonly ordersService;
    private readonly paymentsService;
    private readonly logger;
    constructor(settingsService: WhatsappSettingsService, metaService: WhatsappMetaService, catalogService: WhatsappCatalogService, aiService: WhatsappAiService, conversationService: WhatsappConversationService, businessService: BusinessService, ordersService: OrdersService, paymentsService: PaymentsService);
    handleIncoming(msg: IncomingWhatsappText): Promise<void>;
    private applyActions;
    private addProductToCart;
    private buildSessionSummary;
    private formatOrderSummary;
    private isReadyToConfirm;
    private tryConfirmOrder;
    sendHumanReply(conversationId: number, body: string, _agent: {
        id: string;
        fullName: string;
    }): Promise<void>;
    private reply;
}
