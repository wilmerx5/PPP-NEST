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
exports.WhatsappSettings = void 0;
const typeorm_1 = require("typeorm");
let WhatsappSettings = class WhatsappSettings {
    id;
    enabled;
    displayPhone;
    phoneNumberId;
    wabaId;
    accessToken;
    appSecret;
    verifyToken;
    openaiApiKey;
    openaiModel;
    systemPrompt;
    defaultDeliveryFee;
    deliveryFeeMode;
    restaurantLat;
    restaurantLng;
    deliveryMaxKm;
    deliveryFeeTiers;
    allowMercadoPago;
    paymentMethods;
    menuConceptGroups;
    welcomeMessage;
    aiDisclaimerMessage;
    restaurantName;
    restaurantAddress;
    restaurantCity;
    restaurantNeighborhood;
    mapsUrl;
    publicPhone;
    landmarks;
    pickupNotes;
    deliveryNotes;
    aiExtraContext;
    menuUrl;
    websiteUrl;
    instagramUrl;
    ignoreBusinessHours;
    prepTimeNote;
    deliveryTimeNote;
    minOrderAmount;
    maxOrderAmount;
    maxUnitsPerItem;
    maxTotalUnits;
    maxCartLines;
    handoffWhenMaxExceeded;
    largeOrderHandoffMessage;
    allergensNote;
    promotionsNote;
    serviceAreaNote;
    cashChangeNote;
    transferInfoNote;
    specialRequestsNote;
    askOrderNotes;
    rateLimitPerMinute;
    humanAgentIdleMinutes;
    humanClientIdleMinutes;
    orderDraftIdleMinutes;
    pendingChoiceIdleMinutes;
    mpPaymentIdleMinutes;
    sessionIdleNotify;
    paymentInstructions;
    hoursNote;
    cancelPolicyNote;
    humanHandoffMessage;
    closedMessage;
    menuLinkMessage;
    orderSuccessMessage;
    aiTemperature;
    updatedAt;
};
exports.WhatsappSettings = WhatsappSettings;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'int' }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], WhatsappSettings.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'display_phone', type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "displayPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'phone_number_id', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "phoneNumberId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'waba_id', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "wabaId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'access_token', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "accessToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'app_secret', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "appSecret", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'verify_token', type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "verifyToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'openai_api_key', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "openaiApiKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'openai_model', type: 'varchar', length: 64, default: 'gpt-4o-mini' }),
    __metadata("design:type", String)
], WhatsappSettings.prototype, "openaiModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'system_prompt', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "systemPrompt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'default_delivery_fee', type: 'int', default: 2000 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "defaultDeliveryFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_fee_mode', type: 'varchar', length: 20, default: 'route_tiers' }),
    __metadata("design:type", String)
], WhatsappSettings.prototype, "deliveryFeeMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'restaurant_lat', type: 'decimal', precision: 10, scale: 7, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "restaurantLat", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'restaurant_lng', type: 'decimal', precision: 10, scale: 7, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "restaurantLng", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_max_km', type: 'decimal', precision: 6, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "deliveryMaxKm", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_fee_tiers', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "deliveryFeeTiers", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allow_mercado_pago', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WhatsappSettings.prototype, "allowMercadoPago", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'payment_methods', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "paymentMethods", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'menu_concept_groups', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "menuConceptGroups", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'welcome_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "welcomeMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_disclaimer_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "aiDisclaimerMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'restaurant_name', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "restaurantName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'restaurant_address', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "restaurantAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'restaurant_city', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "restaurantCity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'restaurant_neighborhood', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "restaurantNeighborhood", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'maps_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "mapsUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'public_phone', type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "publicPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'landmarks', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "landmarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pickup_notes', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "pickupNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_notes', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "deliveryNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_extra_context', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "aiExtraContext", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'menu_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "menuUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'website_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "websiteUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'instagram_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "instagramUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ignore_business_hours', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], WhatsappSettings.prototype, "ignoreBusinessHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'prep_time_note', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "prepTimeNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_time_note', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "deliveryTimeNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'min_order_amount', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "minOrderAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_order_amount', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "maxOrderAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_units_per_item', type: 'int', default: 10 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "maxUnitsPerItem", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_total_units', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "maxTotalUnits", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_cart_lines', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "maxCartLines", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'handoff_when_max_exceeded', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WhatsappSettings.prototype, "handoffWhenMaxExceeded", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'large_order_handoff_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "largeOrderHandoffMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allergens_note', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "allergensNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'promotions_note', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "promotionsNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'service_area_note', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "serviceAreaNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cash_change_note', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "cashChangeNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'transfer_info_note', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "transferInfoNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'special_requests_note', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "specialRequestsNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ask_order_notes', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WhatsappSettings.prototype, "askOrderNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rate_limit_per_minute', type: 'int', default: 25 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "rateLimitPerMinute", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'human_agent_idle_minutes', type: 'int', default: 30 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "humanAgentIdleMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'human_client_idle_minutes', type: 'int', default: 120 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "humanClientIdleMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_draft_idle_minutes', type: 'int', default: 45 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "orderDraftIdleMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pending_choice_idle_minutes', type: 'int', default: 15 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "pendingChoiceIdleMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mp_payment_idle_minutes', type: 'int', default: 60 }),
    __metadata("design:type", Number)
], WhatsappSettings.prototype, "mpPaymentIdleMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'session_idle_notify', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WhatsappSettings.prototype, "sessionIdleNotify", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'payment_instructions', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "paymentInstructions", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hours_note', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "hoursNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cancel_policy_note', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "cancelPolicyNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'human_handoff_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "humanHandoffMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'closed_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "closedMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'menu_link_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "menuLinkMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_success_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "orderSuccessMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ai_temperature',
        type: 'decimal',
        precision: 3,
        scale: 2,
        default: 0.2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], WhatsappSettings.prototype, "aiTemperature", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], WhatsappSettings.prototype, "updatedAt", void 0);
exports.WhatsappSettings = WhatsappSettings = __decorate([
    (0, typeorm_1.Entity)('ppp_whatsapp_settings')
], WhatsappSettings);
//# sourceMappingURL=whatsapp-settings.entity.js.map