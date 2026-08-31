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
exports.WhatsappMessage = void 0;
const typeorm_1 = require("typeorm");
const whatsapp_conversation_entity_1 = require("./whatsapp-conversation.entity");
let WhatsappMessage = class WhatsappMessage {
    id;
    conversationId;
    direction;
    messageType;
    body;
    mediaId;
    mimeType;
    waMessageId;
    sentBy;
    rawPayload;
    createdAt;
    conversation;
};
exports.WhatsappMessage = WhatsappMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: 'bigint' }),
    __metadata("design:type", String)
], WhatsappMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'conversation_id', type: 'int' }),
    __metadata("design:type", Number)
], WhatsappMessage.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['in', 'out'] }),
    __metadata("design:type", String)
], WhatsappMessage.prototype, "direction", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'message_type', type: 'varchar', length: 20, default: 'text' }),
    __metadata("design:type", String)
], WhatsappMessage.prototype, "messageType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappMessage.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'media_id', type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], WhatsappMessage.prototype, "mediaId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], WhatsappMessage.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wa_message_id', type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], WhatsappMessage.prototype, "waMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_by', type: 'varchar', length: 20, default: 'bot' }),
    __metadata("design:type", String)
], WhatsappMessage.prototype, "sentBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'raw_payload', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WhatsappMessage.prototype, "rawPayload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], WhatsappMessage.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => whatsapp_conversation_entity_1.WhatsappConversation, (c) => c.messages, {
        onDelete: 'CASCADE',
        nullable: false,
        createForeignKeyConstraints: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'conversation_id' }),
    __metadata("design:type", whatsapp_conversation_entity_1.WhatsappConversation)
], WhatsappMessage.prototype, "conversation", void 0);
exports.WhatsappMessage = WhatsappMessage = __decorate([
    (0, typeorm_1.Entity)('ppp_whatsapp_messages')
], WhatsappMessage);
//# sourceMappingURL=whatsapp-message.entity.js.map