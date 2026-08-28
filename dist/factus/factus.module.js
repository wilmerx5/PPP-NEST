"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactusModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const order_entity_1 = require("../orders/entities/order.entity");
const factus_api_client_1 = require("./factus-api.client");
const factus_auth_service_1 = require("./factus-auth.service");
const factus_invoice_mapper_1 = require("./factus-invoice.mapper");
const factus_service_1 = require("./factus.service");
const factus_controller_1 = require("./factus.controller");
const invoice_customer_entity_1 = require("./entities/invoice-customer.entity");
let FactusModule = class FactusModule {
};
exports.FactusModule = FactusModule;
exports.FactusModule = FactusModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([order_entity_1.Order, invoice_customer_entity_1.InvoiceCustomer])],
        controllers: [factus_controller_1.FactusController],
        providers: [factus_auth_service_1.FactusAuthService, factus_api_client_1.FactusApiClient, factus_invoice_mapper_1.FactusInvoiceMapper, factus_service_1.FactusService],
        exports: [factus_service_1.FactusService, factus_auth_service_1.FactusAuthService],
    })
], FactusModule);
//# sourceMappingURL=factus.module.js.map