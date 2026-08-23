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
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
const valid_roles_interface_1 = require("../auth/interfaces/valid.roles.interface");
const STAFF = [
    valid_roles_interface_1.ValidRoles.admin,
    valid_roles_interface_1.ValidRoles.ordersUser,
    valid_roles_interface_1.ValidRoles.tableUser,
    valid_roles_interface_1.ValidRoles.kitchenUser,
];
const OPS = [
    valid_roles_interface_1.ValidRoles.admin,
    valid_roles_interface_1.ValidRoles.ordersUser,
    valid_roles_interface_1.ValidRoles.tableUser,
];
let OrdersController = class OrdersController {
    orderService;
    constructor(orderService) {
        this.orderService = orderService;
    }
    async getMine(req) {
        const email = req.user?.email;
        if (!email) {
            return [];
        }
        return this.orderService.findMine(email);
    }
    async createOrder(createOrderDto, idempotencyKey) {
        const key = (createOrderDto.clientRequestId || idempotencyKey || '').trim();
        if (key) {
            createOrderDto.clientRequestId = key.slice(0, 64);
        }
        return this.orderService.create(createOrderDto);
    }
    async getTodayOrders(orderType) {
        return this.orderService.findOrdersToday(orderType);
    }
    async validateRedemptionPrize(body) {
        const { code } = body;
        if (!code) {
            throw new common_1.BadRequestException('Redemption code is required');
        }
        const redemption = await this.orderService.validateRedemptionCodePublic(code.toUpperCase().trim());
        return {
            valid: true,
            code: redemption.code,
            expiresAt: redemption.expiresAt,
            message: 'Redemption code is valid and can be used',
        };
    }
    async deleteOrder(id, force) {
        const orderId = parseInt(id, 10);
        const forceCancel = force === '1' || force === 'true';
        return this.orderService.removeOrder(orderId, forceCancel);
    }
    async updateItemUnitPrice(id, dto) {
        const orderId = parseInt(id, 10);
        return this.orderService.updateOrderItemUnitPrice(orderId, dto);
    }
    async appendItems(id, dto) {
        return this.orderService.appendOrderItems(parseInt(id, 10), dto);
    }
    async removeItems(id, dto) {
        return this.orderService.removeOrderItems(parseInt(id, 10), dto);
    }
    async updateItems(id, dto) {
        const orderId = parseInt(id, 10);
        return this.orderService.updateOrderItems(orderId, dto);
    }
    async addExtra(id, dto) {
        return this.orderService.addExtra(parseInt(id, 10), dto);
    }
    async deleteExtra(id, extraId) {
        return this.orderService.deleteExtra(parseInt(id, 10), parseInt(extraId, 10));
    }
    async updateExtra(id, extraId, dto) {
        return this.orderService.updateExtra(parseInt(id, 10), parseInt(extraId, 10), dto);
    }
    async updateOrderGeneral(id, dto) {
        return this.orderService.updateOrderGeneral(+id, dto);
    }
    async changeTable(id, dto) {
        return this.orderService.changeTable(parseInt(id, 10), dto);
    }
    async linkTables(id, dto) {
        return this.orderService.linkTables(parseInt(id, 10), dto.tableNumbers);
    }
    async unlinkTable(id) {
        return this.orderService.unlinkTable(parseInt(id, 10));
    }
    async applyRedemptionVoucher(id, body) {
        const { redemptionCode } = body;
        if (!redemptionCode) {
            throw new common_1.BadRequestException('Redemption code is required');
        }
        await this.orderService.applyRedemptionVoucher(+id, redemptionCode);
        return {
            success: true,
            message: 'Redemption prize applied successfully',
        };
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Get)('mine'),
    (0, auth_decorator_1.Auth)(),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Mis pedidos',
        description: 'Devuelve las órdenes del usuario autenticado (por email). Requiere JWT.',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lista de órdenes del usuario' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'No autenticado' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getMine", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a new order',
        description: 'Creates a new order with customer info, items, attributes and notifies kitchen via WebSockets. Public for online checkout.',
    }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.CreateOrderDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Order created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [orderDTO_1.CreateOrderDto, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Get)('daily'),
    (0, auth_decorator_1.Auth)(...STAFF),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get all orders of today',
        description: 'Returns all orders created today (Bogotá timezone), excluding canceled ones. Optional orderType (e.g. "table") filters by type for lighter payload (e.g. mesas app).',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Orders retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'No autenticado' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Sin permiso' }),
    __param(0, (0, common_1.Query)('orderType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getTodayOrders", null);
__decorate([
    (0, common_1.Post)('validate-redemption-prize'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Validate a redemption prize code',
        description: 'Validates a redemption prize code. Requires staff auth.',
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                code: {
                    type: 'string',
                    example: 'REDEEM9PTSX7',
                    description: '12-character redemption code',
                },
            },
            required: ['code'],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Prize code is valid' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid or expired code' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Prize code not found' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Prize code already used' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "validateRedemptionPrize", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel an order',
        description: 'Cancels the order and restores inventory. Use force=true to annul an already completed order (operational mistake).',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15, description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Order canceled successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('force')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "deleteOrder", null);
__decorate([
    (0, common_1.Patch)(':id/items/unit-price'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Apply unit price (discount) to a product in the order',
        description: 'Updates the unit price for all order items of the given product. Does not change inventory.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.UpdateOrderItemUnitPriceDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Unit price updated; returns formatted order' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order or product not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orderDTO_1.UpdateOrderItemUnitPriceDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updateItemUnitPrice", null);
__decorate([
    (0, common_1.Post)(':id/items'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Append items to an order (delta)',
        description: 'Adds ONLY the given items to the order without replacing existing ones. Prefer this over PATCH for "add product".',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.AppendOrderItemsDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Items appended; returns formatted order' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orderDTO_1.AppendOrderItemsDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "appendItems", null);
__decorate([
    (0, common_1.Delete)(':id/items'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Remove items from an order (delta)',
        description: 'Removes all units of a product, or a single unit by unitIndex. Does not require resending the rest of the order.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.RemoveOrderItemsDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Items removed; returns formatted order' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orderDTO_1.RemoveOrderItemsDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "removeItems", null);
__decorate([
    (0, common_1.Patch)(':id/items'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Replace all items in an order',
        description: 'Full replace of items (legacy). Prefer POST/DELETE delta endpoints for add/remove. Still used for edit-variants.',
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
    (0, common_1.Post)(':id/extras'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Add an extra to an order', description: 'Adds an additional charge (código 90) to an existing order.' }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.AddOrderExtraDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Extra added' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found or canceled' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orderDTO_1.AddOrderExtraDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "addExtra", null);
__decorate([
    (0, common_1.Delete)(':id/extras/:extraId'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Delete an extra from an order' }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiParam)({ name: 'extraId', example: 1 }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Extra deleted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Extra not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('extraId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "deleteExtra", null);
__decorate([
    (0, common_1.Patch)(':id/extras/:extraId'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update an extra on an order' }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiParam)({ name: 'extraId', example: 1 }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.UpdateOrderExtraDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Extra updated' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Extra not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('extraId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, orderDTO_1.UpdateOrderExtraDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updateExtra", null);
__decorate([
    (0, common_1.Patch)(':id/info'),
    (0, auth_decorator_1.Auth)(...STAFF),
    (0, swagger_1.ApiBearerAuth)(),
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
__decorate([
    (0, common_1.Patch)(':id/table'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin, valid_roles_interface_1.ValidRoles.tableUser),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Change table of an order (mesas)',
        description: 'Moves order to another table. If the target table has an active order, both orders swap tables.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.ChangeTableDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Table changed (or swapped) successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid request (e.g. same table, non-table order)' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orderDTO_1.ChangeTableDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "changeTable", null);
__decorate([
    (0, common_1.Post)(':id/table-link'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin, valid_roles_interface_1.ValidRoles.tableUser),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Link table orders (mesas)',
        description: 'Links this table order with other active table orders for a unified bill.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiBody)({ type: orderDTO_1.LinkTablesDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tables linked successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, orderDTO_1.LinkTablesDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "linkTables", null);
__decorate([
    (0, common_1.Delete)(':id/table-link'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin, valid_roles_interface_1.ValidRoles.tableUser),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Unlink table from group (mesas)',
        description: 'Removes this table from the linked group.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Table unlinked successfully' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "unlinkTable", null);
__decorate([
    (0, common_1.Post)(':id/apply-voucher'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Apply a redemption prize to an order',
        description: 'Applies a redemption prize (from 9 points redemption) to an order. Validates that the order contains a half chicken (product code 2 or 5).',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 15 }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                redemptionCode: {
                    type: 'string',
                    example: 'REDEEM9PTSX7',
                    description: '12-character redemption code',
                },
            },
            required: ['redemptionCode'],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Prize applied successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid prize or order does not contain half chicken' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order or prize not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "applyRedemptionVoucher", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)('Orders'),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map