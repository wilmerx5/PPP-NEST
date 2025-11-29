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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const orderDTO_1 = require("./DTOS/orderDTO");
const orders_service_1 = require("./orders.service");
let OrdersController = class OrdersController {
    orderService;
    constructor(orderService) {
        this.orderService = orderService;
    }
    async createOrder(createOrderDto) {
        return this.orderService.create(createOrderDto);
    }
    async getTodayOrders() {
        return this.orderService.findOrdersToday();
    }
    async deleteOrder(id) {
        const orderId = parseInt(id, 10);
        return this.orderService.removeOrder(orderId);
    }
    async updateItems(id, dto) {
        const orderId = parseInt(id, 10);
        return this.orderService.updateOrderItems(orderId, dto);
    }
    async updateOrderGeneral(id, dto) {
        return this.orderService.updateOrderGeneral(+id, dto);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a new order',
        description: 'Creates a new order with customer info, items, attributes and notifies kitchen via WebSockets.',
    }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.CreateOrderDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Order created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [orderDTO_1.CreateOrderDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Get)('daily'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get all orders of today',
        description: 'Returns all orders created today (Bogotá timezone), excluding canceled ones.',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Orders retrieved successfully' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getTodayOrders", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel an order',
        description: 'Marks the order as canceled and notifies kitchen.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15, description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Order canceled successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "deleteOrder", null);
__decorate([
    (0, common_1.Patch)(':id/items'),
    (0, swagger_1.ApiOperation)({
        summary: 'Update the list of items in an order',
        description: 'Replaces all items and attributes of the order. If items are empty, the order is canceled.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.UpdateOrderItemsDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Order items updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orderDTO_1.UpdateOrderItemsDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updateItems", null);
__decorate([
    (0, common_1.Patch)(':id/info'),
    (0, swagger_1.ApiOperation)({
        summary: 'Update general information of an order',
        description: 'Updates order fields such as customerName, phone, address, orderStatus, orderType, printed flag, etc.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.UpdateOrderGeneralDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Order updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, orderDTO_1.UpdateOrderGeneralDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updateOrderGeneral", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)('Orders'),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map