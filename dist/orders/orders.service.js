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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
const typeorm_2 = require("typeorm");
const order_item_attribute_entity_1 = require("./entities/order-item-attribute.entity");
const order_item_entity_1 = require("./entities/order-item.entity");
const order_entity_1 = require("./entities/order.entity");
const order_gateway_1 = require("./Websocket/order.gateway");
let OrdersService = class OrdersService {
    orderRepo;
    itemRepo;
    attrRepo;
    productRepo;
    gateway;
    constructor(orderRepo, itemRepo, attrRepo, productRepo, gateway) {
        this.orderRepo = orderRepo;
        this.itemRepo = itemRepo;
        this.attrRepo = attrRepo;
        this.productRepo = productRepo;
        this.gateway = gateway;
    }
    timeZone = 'America/Bogota';
    getTodayUtcRange() {
        const nowInBogota = (0, date_fns_tz_1.toZonedTime)(new Date(), this.timeZone);
        const startOfBogotaDay = (0, date_fns_1.startOfDay)(nowInBogota);
        const endOfBogotaDay = (0, date_fns_1.endOfDay)(nowInBogota);
        return { todayStartUtc: startOfBogotaDay, todayEndUtc: endOfBogotaDay };
    }
    async create(createOrderDto) {
        const { customerName, phone, address, items } = createOrderDto;
        const { todayStartUtc, todayEndUtc } = this.getTodayUtcRange();
        const ordersTodayCount = await this.orderRepo.count({
            where: {
                createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
            },
        });
        const newOrderNumber = ordersTodayCount + 1;
        const order = this.orderRepo.create({
            customerName,
            phone,
            address,
            dailyOrderNumber: newOrderNumber,
            orderType: createOrderDto.orderType ?? 'pickup',
        });
        await this.orderRepo.save(order);
        for (const item of items) {
            const orderItem = this.itemRepo.create({
                order,
                product: { id: item.productId },
                note: item.note,
            });
            await this.itemRepo.save(orderItem);
            if (item.attributes && item.attributes.length > 0) {
                const attrs = item.attributes.map((attr) => this.attrRepo.create({
                    orderItem,
                    attributeName: attr.attributeName,
                    attributeValue: attr.attributeValue,
                }));
                await this.attrRepo.save(attrs);
            }
        }
        const fullOrder = await this.orderRepo.findOne({
            where: { id: order.id },
            relations: ['items', 'items.product', 'items.attributes'],
        });
        if (fullOrder) {
            const formattedOrder = this.mapOrderToGroupedFormat(fullOrder);
            this.gateway.emitOrdersUpdates("created_order", formattedOrder);
        }
        return {
            success: true,
            orderId: order.id,
            dailyOrderNumber: newOrderNumber,
        };
    }
    async findOrdersToday() {
        const { todayStartUtc, todayEndUtc } = this.getTodayUtcRange();
        const orders = await this.orderRepo.find({
            where: {
                createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
                orderStatus: (0, typeorm_2.Not)('canceled'),
            },
            relations: ['items', 'items.product', 'items.attributes'],
            order: {
                createdAt: 'DESC',
            },
        });
        return orders.map((order) => {
            const groupedItems = {};
            for (const item of order.items) {
                const productId = item.product.id;
                const productName = item.product.name;
                const code = item.product.code;
                const attributeMap = item.attributes?.reduce((acc, attr) => {
                    acc[attr.attributeName] = attr.attributeValue;
                    return acc;
                }, {});
                if (!groupedItems[productId]) {
                    groupedItems[productId] = {
                        productId,
                        productName,
                        quantity: 0,
                        code: code,
                        variants: [],
                    };
                }
                groupedItems[productId].quantity += 1;
                groupedItems[productId].variants.push({
                    note: item.note || null,
                    attributes: attributeMap,
                });
            }
            return {
                orderId: order.id,
                dailyOrderNumber: order.dailyOrderNumber,
                customerName: order.customerName,
                phone: order.phone,
                address: order.address,
                createdAt: order.createdAt,
                orderType: order.orderType,
                orderStatus: order.orderStatus,
                printed: order.printed,
                items: Object.values(groupedItems)
            };
        });
    }
    async removeOrder(orderId) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
        });
        if (!order) {
            throw new Error(`Order with ID ${orderId} not found`);
        }
        order.orderStatus = 'canceled';
        await this.orderRepo.save(order);
        this.gateway.emitOrdersUpdates("deleted_order", order);
        return {
            success: true,
            message: `Order #${orderId} marked as canceled`,
        };
    }
    async updateOrderItems(orderId, dto) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.attributes'],
        });
        if (!order)
            throw new Error(`Order not found`);
        for (const item of order.items) {
            await this.attrRepo.delete({ orderItem: { id: item.id } });
            await this.itemRepo.delete(item.id);
        }
        if (!dto.items || dto.items.length === 0) {
            order.orderStatus = 'canceled';
            await this.orderRepo.save(order);
            this.gateway.emitOrdersUpdates("deleted_order", order);
            return {
                success: true,
                message: `Order #${orderId} was marked as canceled because item list was empty`,
            };
        }
        for (const itemDto of dto.items) {
            const orderItem = this.itemRepo.create({
                order,
                product: { id: itemDto.productId },
                note: itemDto.note,
            });
            await this.itemRepo.save(orderItem);
            if (itemDto.attributes?.length) {
                const attributes = itemDto.attributes.map(attr => this.attrRepo.create({
                    orderItem,
                    attributeName: attr.attributeName,
                    attributeValue: attr.attributeValue,
                }));
                await this.attrRepo.save(attributes);
            }
        }
        const fullOrder = await this.orderRepo.findOne({
            where: { id: order.id },
            relations: ['items', 'items.product', 'items.attributes'],
        });
        if (fullOrder) {
            const formattedOrder = this.mapOrderToGroupedFormat(fullOrder);
            this.gateway.emitOrdersUpdates("updated_order_items", formattedOrder);
        }
        return {
            success: true,
            message: `Order #${fullOrder?.dailyOrderNumber} updated successfully`,
        };
    }
    async updateOrderGeneral(orderId, dto) {
        const order = await this.orderRepo.findOneBy({ id: orderId });
        if (!order)
            throw new Error('Order not found');
        if (dto.customerName !== undefined)
            order.customerName = dto.customerName;
        if (dto.phone !== undefined)
            order.phone = dto.phone;
        if (dto.address !== undefined)
            order.address = dto.address;
        if (dto.orderType !== undefined)
            order.orderType = dto.orderType;
        if (dto.orderStatus !== undefined)
            order.orderStatus = dto.orderStatus;
        if (dto.printed !== undefined)
            order.printed = dto.printed;
        await this.orderRepo.save(order);
        const fullOrder = await this.orderRepo.findOne({
            where: { id: order.id },
            relations: ['items', 'items.product', 'items.attributes'],
        });
        if (fullOrder) {
            const formattedOrder = this.mapOrderToGroupedFormat(fullOrder);
            this.gateway.emitOrdersUpdates("updated_order_items", formattedOrder);
        }
        return {
            success: true,
            message: `Order #${orderId} updated successfully`,
            updatedFields: dto,
        };
    }
    mapOrderToGroupedFormat(order) {
        const groupedItems = {};
        for (const item of order.items) {
            const productId = item.product.id;
            const productName = item.product.name;
            const code = item.product.code;
            const attributeMap = item.attributes?.reduce((acc, attr) => {
                acc[attr.attributeName] = attr.attributeValue;
                return acc;
            }, {});
            if (!groupedItems[productId]) {
                groupedItems[productId] = {
                    productId,
                    code,
                    productName,
                    quantity: 0,
                    variants: [],
                };
            }
            groupedItems[productId].quantity += 1;
            groupedItems[productId].variants.push({
                note: item.note || null,
                attributes: attributeMap,
            });
        }
        const localCreatedAt = (0, date_fns_tz_1.toZonedTime)(order.createdAt, this.timeZone);
        return {
            orderId: order.id,
            dailyOrderNumber: order.dailyOrderNumber,
            customerName: order.customerName,
            phone: order.phone,
            address: order.address,
            createdAt: localCreatedAt,
            orderType: order.orderType,
            orderStatus: order.orderStatus,
            printed: order.printed,
            items: Object.values(groupedItems),
        };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(order_item_entity_1.OrderItem)),
    __param(2, (0, typeorm_1.InjectRepository)(order_item_attribute_entity_1.OrderItemAttribute)),
    __param(3, (0, typeorm_1.InjectRepository)(order_item_attribute_entity_1.OrderItemAttribute)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        order_gateway_1.OrdersGateway])
], OrdersService);
//# sourceMappingURL=orders.service.js.map