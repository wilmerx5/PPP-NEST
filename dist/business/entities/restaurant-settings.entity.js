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
exports.RestaurantSettings = void 0;
const typeorm_1 = require("typeorm");
let RestaurantSettings = class RestaurantSettings {
    id;
    timezone;
    weeklyClosedDays;
    openTime;
    closeTime;
    weeklyHours;
    webDeliveryDefaultFee;
    webDeliveryMaxKm;
    webDeliveryFeeTiers;
    factusItemTaxes;
    factusPricesIncludeTax;
    updatedAt;
};
exports.RestaurantSettings = RestaurantSettings;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", Number)
], RestaurantSettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64, default: 'America/Bogota' }),
    __metadata("design:type", String)
], RestaurantSettings.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'weekly_closed_days', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], RestaurantSettings.prototype, "weeklyClosedDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'open_time', length: 5, default: '11:00' }),
    __metadata("design:type", String)
], RestaurantSettings.prototype, "openTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'close_time', length: 5, default: '22:00' }),
    __metadata("design:type", String)
], RestaurantSettings.prototype, "closeTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'weekly_hours', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], RestaurantSettings.prototype, "weeklyHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'web_delivery_default_fee', type: 'int', default: 4000 }),
    __metadata("design:type", Number)
], RestaurantSettings.prototype, "webDeliveryDefaultFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'web_delivery_max_km', type: 'decimal', precision: 6, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], RestaurantSettings.prototype, "webDeliveryMaxKm", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'web_delivery_fee_tiers', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], RestaurantSettings.prototype, "webDeliveryFeeTiers", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'factus_item_taxes', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], RestaurantSettings.prototype, "factusItemTaxes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'factus_prices_include_tax', type: 'boolean', nullable: true }),
    __metadata("design:type", Object)
], RestaurantSettings.prototype, "factusPricesIncludeTax", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], RestaurantSettings.prototype, "updatedAt", void 0);
exports.RestaurantSettings = RestaurantSettings = __decorate([
    (0, typeorm_1.Entity)('ppp_restaurant_settings')
], RestaurantSettings);
//# sourceMappingURL=restaurant-settings.entity.js.map