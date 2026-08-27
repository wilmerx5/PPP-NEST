"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const business_module_1 = require("../business/business.module");
const whatsapp_delivery_routing_service_1 = require("../whatsapp/whatsapp-delivery-routing.service");
const web_delivery_service_1 = require("./web-delivery.service");
let DeliveryModule = class DeliveryModule {
};
exports.DeliveryModule = DeliveryModule;
exports.DeliveryModule = DeliveryModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, business_module_1.BusinessModule],
        providers: [whatsapp_delivery_routing_service_1.WhatsappDeliveryRoutingService, web_delivery_service_1.WebDeliveryService],
        exports: [whatsapp_delivery_routing_service_1.WhatsappDeliveryRoutingService, web_delivery_service_1.WebDeliveryService],
    })
], DeliveryModule);
//# sourceMappingURL=delivery.module.js.map