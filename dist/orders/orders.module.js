"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const order_item_attribute_entity_1 = require("./entities/order-item-attribute.entity");
const order_item_entity_1 = require("./entities/order-item.entity");
const order_entity_1 = require("./entities/order.entity");
const order_extra_entity_1 = require("./entities/order-extra.entity");
const orders_controller_1 = require("./orders.controller");
const orders_service_1 = require("./orders.service");
const order_gateway_1 = require("./Websocket/order.gateway");
const auth_module_1 = require("../auth/auth.module");
const products_module_1 = require("../products/products.module");
const common_module_1 = require("../common/common.module");
const user_entity_1 = require("../auth/entities/user.entity");
const product_entity_1 = require("../products/entities/product.entity");
const user_points_entity_1 = require("../auth/entities/user-points.entity");
const point_redemption_entity_1 = require("../auth/entities/point-redemption.entity");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        controllers: [orders_controller_1.OrdersController],
        providers: [orders_service_1.OrdersService, order_gateway_1.OrdersGateway],
        imports: [
            typeorm_1.TypeOrmModule.forFeature([order_entity_1.Order, order_item_entity_1.OrderItem, order_item_attribute_entity_1.OrderItemAttribute, order_extra_entity_1.OrderExtra, user_entity_1.User, product_entity_1.Product, user_points_entity_1.UserPoints, point_redemption_entity_1.PointRedemption]),
            (0, common_1.forwardRef)(() => auth_module_1.AuthModule),
            products_module_1.ProductsModule,
            common_module_1.CommonModule,
        ],
        exports: [orders_service_1.OrdersService],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map