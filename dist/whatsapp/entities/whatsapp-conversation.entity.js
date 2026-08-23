"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappConversation = void 0;
const typeorm_1 = require("typeorm");
const whatsapp_message_entity_1 = require("./whatsapp-message.entity");
let WhatsappConversation = class WhatsappConversation {
    id;
    waId;
    phoneE164;
    customerName;
    state;
    sessionData;
    humanTakeover;
    humanAgentId;
    humanAgentName;
    lastMessageAt;
    lastInboundAt;
    createdAt;
    updatedAt;
    messages;
};
exports.WhatsappConversation = WhatsappConversation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: 'int' }),
    __metadata("design:type", Number)
], WhatsappConversation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wa_id', type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], WhatsappConversation.prototype, "waId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'phone_e164', type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], WhatsappConversation.prototype, "phoneE164", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'customer_name', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], WhatsappConversation.prototype, "customerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, default: 'building_cart' }),
    __metadata("design:type", String)
], WhatsappConversation.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'session_data', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WhatsappConversation.prototype, "sessionData", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'human_takeover', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], WhatsappConversation.prototype, "humanTakeover", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'human_agent_id', type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], WhatsappConversation.prototype, "humanAgentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'human_agent_name', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], WhatsappConversation.prototype, "humanAgentName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_message_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], WhatsappConversation.prototype, "lastMessageAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_inbound_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], WhatsappConversation.prototype, "lastInboundAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], WhatsappConversation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], WhatsappConversation.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => whatsapp_message_entity_1.WhatsappMessage, (m) => m.conversation),
    __metadata("design:type", Array)
], WhatsappConversation.prototype, "messages", void 0);
exports.WhatsappConversation = WhatsappConversation = __decorate([
    (0, typeorm_1.Entity)('ppp_whatsapp_conversations')
], WhatsappConversation);
//# sourceMappingURL=whatsapp-conversation.entity.js.map