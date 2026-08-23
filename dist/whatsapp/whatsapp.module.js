"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const whatsapp_settings_entity_1 = require("./entities/whatsapp-settings.entity");
const whatsapp_conversation_entity_1 = require("./entities/whatsapp-conversation.entity");
const whatsapp_message_entity_1 = require("./entities/whatsapp-message.entity");
const whatsapp_settings_service_1 = require("./whatsapp-settings.service");
const whatsapp_meta_service_1 = require("./whatsapp-meta.service");
const whatsapp_catalog_service_1 = require("./whatsapp-catalog.service");
const whatsapp_ai_service_1 = require("./whatsapp-ai.service");
const whatsapp_conversation_service_1 = require("./whatsapp-conversation.service");
const whatsapp_orchestrator_service_1 = require("./whatsapp-orchestrator.service");
const whatsapp_webhook_controller_1 = require("./whatsapp-webhook.controller");
const whatsapp_admin_controller_1 = require("./whatsapp-admin.controller");
const auth_module_1 = require("../auth/auth.module");
const products_module_1 = require("../products/products.module");
const business_module_1 = require("../business/business.module");
const orders_module_1 = require("../orders/orders.module");
const payments_module_1 = require("../payments/payments.module");
const user_entity_1 = require("../auth/entities/user.entity");
let WhatsappModule = class WhatsappModule {
};
exports.WhatsappModule = WhatsappModule;
exports.WhatsappModule = WhatsappModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([whatsapp_settings_entity_1.WhatsappSettings, whatsapp_conversation_entity_1.WhatsappConversation, whatsapp_message_entity_1.WhatsappMessage, user_entity_1.User]),
            auth_module_1.AuthModule,
            products_module_1.ProductsModule,
            business_module_1.BusinessModule,
            orders_module_1.OrdersModule,
            payments_module_1.PaymentsModule,
        ],
        controllers: [whatsapp_webhook_controller_1.WhatsappWebhookController, whatsapp_admin_controller_1.WhatsappAdminController],
        providers: [
            whatsapp_settings_service_1.WhatsappSettingsService,
            whatsapp_meta_service_1.WhatsappMetaService,
            whatsapp_catalog_service_1.WhatsappCatalogService,
            whatsapp_ai_service_1.WhatsappAiService,
            whatsapp_conversation_service_1.WhatsappConversationService,
            whatsapp_orchestrator_service_1.WhatsappOrchestratorService,
        ],
        exports: [whatsapp_settings_service_1.WhatsappSettingsService],
    })
], WhatsappModule);
//# sourceMappingURL=whatsapp.module.js.map