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
const product_entity_1 = require("../products/entities/product.entity");
const typeorm_2 = require("typeorm");
const order_item_attribute_entity_1 = require("./entities/order-item-attribute.entity");
const order_item_entity_1 = require("./entities/order-item.entity");
const order_entity_1 = require("./entities/order.entity");
const order_gateway_1 = require("./Websocket/order.gateway");
const date_util_1 = require("../common/utils/date.util");
const points_service_1 = require("../auth/services/points.service");
const user_entity_1 = require("../auth/entities/user.entity");
const user_points_entity_1 = require("../auth/entities/user-points.entity");
let OrdersService = class OrdersService {
    orderRepo;
    itemRepo;
    attrRepo;
    productRepo;
    userRepo;
    gateway;
    dataSource;
    pointsService;
    constructor(orderRepo, itemRepo, attrRepo, productRepo, userRepo, gateway, dataSource, pointsService) {
        this.orderRepo = orderRepo;
        this.itemRepo = itemRepo;
        this.attrRepo = attrRepo;
        this.productRepo = productRepo;
        this.userRepo = userRepo;
        this.gateway = gateway;
        this.dataSource = dataSource;
        this.pointsService = pointsService;
    }
    async generateNextOrderNumber(todayStartUtc, todayEndUtc, manager) {
        const repo = manager ? manager.getRepository(order_entity_1.Order) : this.orderRepo;
        const result = await repo
            .createQueryBuilder('order')
            .select('MAX(order.dailyOrderNumber)', 'maxNumber')
            .where('order.createdAt BETWEEN :start AND :end', {
            start: todayStartUtc,
            end: todayEndUtc,
        })
            .setLock('pessimistic_write')
            .getRawOne();
        const maxNumber = result?.maxNumber || 0;
        return maxNumber + 1;
    }
    async create(createOrderDto) {
        const { customerName, phone, address, items, customerEmail, orderSource, redemptionCode } = createOrderDto;
        const orderType = createOrderDto.orderType ?? 'pickup';
        const deliveryFee = createOrderDto.deliveryFee;
        const source = orderSource ?? 'internal';
        if (!items || items.length === 0) {
            throw new common_1.BadRequestException('Order must have at least one item');
        }
        const { start: todayStartUtc, end: todayEndUtc } = (0, date_util_1.getBogotaDayRange)();
        let finalDeliveryFee = 0;
        if (orderType === 'delivery') {
            if (deliveryFee == null) {
                throw new common_1.BadRequestException('Delivery fee is required for delivery orders');
            }
            finalDeliveryFee = deliveryFee;
        }
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const newOrderNumber = await this.generateNextOrderNumber(todayStartUtc, todayEndUtc, queryRunner.manager);
            const existingOrder = await queryRunner.manager.findOne(order_entity_1.Order, {
                where: {
                    dailyOrderNumber: newOrderNumber,
                    createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
                },
            });
            if (existingOrder) {
                throw new common_1.InternalServerErrorException('Order number conflict detected. Please try again.');
            }
            const order = queryRunner.manager.create(order_entity_1.Order, {
                customerName,
                phone,
                address,
                dailyOrderNumber: newOrderNumber,
                orderType: orderType,
                orderStatus: 'cooking',
                deliveryFee: finalDeliveryFee,
                customerEmail: customerEmail || null,
                orderSource: source,
            });
            const allCodes = [];
            for (const item of items) {
                const product = await this.productRepo.findOne({
                    where: { id: item.productId },
                    select: ['code'],
                });
                if (product) {
                    allCodes.push(product.code);
                }
            }
            let adjustedCodes = [...allCodes];
            if (redemptionCode && redemptionCode.trim()) {
                const hasCode2 = adjustedCodes.includes(2);
                const hasCode5 = adjustedCodes.includes(5);
                if (hasCode2 && hasCode5) {
                    const indexToRemove = adjustedCodes.indexOf(2);
                    if (indexToRemove !== -1) {
                        adjustedCodes.splice(indexToRemove, 1);
                    }
                    else {
                        const index5 = adjustedCodes.indexOf(5);
                        if (index5 !== -1) {
                            adjustedCodes.splice(index5, 1);
                        }
                    }
                }
                else if (hasCode2) {
                    const indexToRemove = adjustedCodes.indexOf(2);
                    if (indexToRemove !== -1) {
                        adjustedCodes.splice(indexToRemove, 1);
                    }
                }
                else if (hasCode5) {
                    const indexToRemove = adjustedCodes.indexOf(5);
                    if (indexToRemove !== -1) {
                        adjustedCodes.splice(indexToRemove, 1);
                    }
                }
            }
            const calculatedPoints = this.pointsService.calculatePointsFromCodes(adjustedCodes);
            order.points = calculatedPoints;
            const savedOrder = await queryRunner.manager.save(order);
            for (const item of items) {
                const orderItem = queryRunner.manager.create(order_item_entity_1.OrderItem, {
                    order: savedOrder,
                    product: { id: item.productId },
                    note: item.note,
                });
                const savedItem = await queryRunner.manager.save(orderItem);
                if (item.attributes?.length) {
                    const attrs = item.attributes.map(attr => queryRunner.manager.create(order_item_attribute_entity_1.OrderItemAttribute, {
                        orderItem: savedItem,
                        attributeName: attr.attributeName,
                        attributeValue: attr.attributeValue,
                    }));
                    await queryRunner.manager.save(attrs);
                }
            }
            await queryRunner.commitTransaction();
            if (calculatedPoints > 0) {
                try {
                    if (source === 'online' && customerEmail) {
                        const user = await this.userRepo.findOne({ where: { email: customerEmail } });
                        if (user) {
                            await this.pointsService.createPointsForOrder(user.id, savedOrder.id, newOrderNumber, calculatedPoints);
                        }
                    }
                    else {
                        const pointsRepo = this.dataSource.getRepository(user_points_entity_1.UserPoints);
                        for (let i = 0; i < calculatedPoints; i++) {
                            const code = await this.pointsService.generateUniquePointCode();
                            const pointRecord = pointsRepo.create({
                                code,
                                userId: null,
                                orderId: savedOrder.id,
                                orderDailyNumber: newOrderNumber,
                                isUsed: false,
                                type: 'automatic',
                                description: `Punto de orden #${newOrderNumber}`,
                            });
                            await pointsRepo.save(pointRecord);
                        }
                    }
                }
                catch (error) {
                    console.error('Error creating point codes:', error);
                }
            }
            const fullOrder = await this.orderRepo.findOne({
                where: { id: savedOrder.id },
                relations: ['items', 'items.product', 'items.attributes'],
            });
            if (redemptionCode && redemptionCode.trim()) {
                try {
                    await this.applyRedemptionVoucher(savedOrder.id, redemptionCode.trim());
                    console.log(`✅ [Order Create] Redemption prize ${redemptionCode} applied successfully to order #${newOrderNumber}`);
                }
                catch (prizeError) {
                    console.error(`❌ [Order Create] Failed to apply redemption prize:`, prizeError?.message || prizeError);
                }
            }
            const finalOrder = await this.orderRepo.findOne({
                where: { id: savedOrder.id },
                relations: ['items', 'items.product', 'items.attributes'],
            });
            if (finalOrder) {
                const formatted = await this.mapOrderToGroupedFormat(finalOrder);
                this.gateway.emitOrdersUpdates("created_order", formatted);
            }
            return {
                success: true,
                orderId: savedOrder.id,
                dailyOrderNumber: newOrderNumber,
            };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (error?.code === 'ER_DUP_ENTRY' || error?.message?.includes('duplicate')) {
                throw new common_1.BadRequestException('An order with this number already exists. Please try again.');
            }
            if (error instanceof common_1.InternalServerErrorException) {
                throw error;
            }
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async findOrdersToday() {
        const { start: todayStartUtc, end: todayEndUtc } = (0, date_util_1.getBogotaDayRange)();
        const orders = await this.orderRepo.find({
            where: {
                createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
                orderStatus: (0, typeorm_2.Not)('canceled'),
            },
            relations: ['items', 'items.product', 'items.attributes'],
            order: { createdAt: 'DESC' },
        });
        if (orders && orders.length > 0) {
            console.log(`[findOrdersToday] Loaded ${orders.length} orders from DB`);
            orders.forEach(order => {
                if (order.points !== null && order.points !== undefined) {
                    console.log(`[findOrdersToday] Order #${order.dailyOrderNumber} has points from DB: ${order.points}`);
                }
                if (order.redemptionCode) {
                    console.log(`[findOrdersToday] Order #${order.dailyOrderNumber} has redemptionCode from DB: ${order.redemptionCode}`);
                }
            });
        }
        const ordersWithPointCodes = await Promise.all(orders.map(async (order) => {
            const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
            const dbPoints = order.points;
            const pointsValue = (dbPoints !== null && dbPoints !== undefined) ? dbPoints : (pointCodes.length || 0);
            if (dbPoints === null || dbPoints === undefined) {
                console.log(`[findOrdersToday] Order #${order.dailyOrderNumber} has null/undefined points, using pointCodes.length: ${pointCodes.length}`);
            }
            return { order, pointCodes, pointsValue };
        }));
        const mappedOrders = await Promise.all(ordersWithPointCodes.map(async ({ order, pointCodes, pointsValue }) => {
            const formatted = await this.mapOrderToGroupedFormat(order);
            return {
                ...formatted,
                points: pointsValue,
                pointCodes,
            };
        }));
        return mappedOrders;
    }
    async findMine(email) {
        const orders = await this.orderRepo.find({
            where: {
                customerEmail: email,
                orderStatus: (0, typeorm_2.Not)('canceled'),
            },
            relations: ['items', 'items.product', 'items.attributes'],
            order: { createdAt: 'DESC' },
        });
        const ordersWithPointCodes = await Promise.all(orders.map(async (order) => {
            const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
            const pointsValue = order.points ?? pointCodes.length ?? 0;
            return { order, pointCodes, pointsValue };
        }));
        return ordersWithPointCodes.map(({ order, pointCodes, pointsValue }) => {
            const createdAtBogota = (0, date_util_1.formatToBogotaISO)(order.createdAt);
            const groupedItems = {};
            for (const item of order.items) {
                const productId = item.product.id;
                const productName = item.product.name;
                const code = item.product.code;
                const imageUrl = item.product.imageUrl;
                const price = item.product.price;
                const attributeMap = item.attributes?.reduce((acc, attr) => {
                    acc[attr.attributeName] = attr.attributeValue;
                    return acc;
                }, {});
                if (!groupedItems[productId]) {
                    groupedItems[productId] = {
                        productId,
                        productName,
                        quantity: 0,
                        imageUrl,
                        code,
                        price,
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
                createdAt: createdAtBogota,
                orderType: order.orderType,
                orderStatus: order.orderStatus,
                printed: order.printed,
                deliveryFee: order.deliveryFee ?? 0,
                orderSource: order.orderSource ?? 'internal',
                points: pointsValue,
                pointCodes: pointCodes,
                items: Object.values(groupedItems),
                redemptionCode: order.redemptionCode ?? null,
            };
        });
    }
    async removeOrder(orderId) {
        const order = await this.orderRepo.findOne({ where: { id: orderId } });
        if (!order)
            throw new Error(`Order with ID ${orderId} not found`);
        order.orderStatus = 'canceled';
        await this.orderRepo.save(order);
        try {
            await this.pointsService.invalidatePointsForCanceledOrder(orderId);
        }
        catch (error) {
            console.error('Error invalidating points for canceled order:', error);
        }
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
        if (!dto.items?.length) {
            order.orderStatus = 'canceled';
            await this.orderRepo.save(order);
            try {
                await this.pointsService.invalidatePointsForCanceledOrder(orderId);
            }
            catch (error) {
                console.error('Error invalidating points for canceled order:', error);
            }
            this.gateway.emitOrdersUpdates("deleted_order", order);
            return {
                success: true,
                message: `Order #${orderId} was canceled because no items remained`,
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
            const allCodes = [];
            for (const item of fullOrder.items) {
                allCodes.push(item.product.code);
            }
            const recalculatedPoints = this.pointsService.calculatePointsFromCodes(allCodes);
            fullOrder.points = recalculatedPoints;
            await this.orderRepo.save(fullOrder);
            try {
                await this.pointsService.updatePointCodesForOrder(fullOrder.id, fullOrder.dailyOrderNumber, recalculatedPoints);
            }
            catch (error) {
                console.error('Error updating point codes:', error);
            }
            const refreshedOrder = await this.orderRepo.findOne({
                where: { id: fullOrder.id },
                relations: ['items', 'items.product', 'items.attributes'],
            });
            if (refreshedOrder) {
                const formatted = await this.mapOrderToGroupedFormat(refreshedOrder);
                this.gateway.emitOrdersUpdates("updated_order_items", formatted);
            }
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
        const wasCanceled = dto.orderStatus === 'canceled' && order.orderStatus !== 'canceled';
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
        if (dto.orderType === 'delivery') {
            if (dto.deliveryFee !== undefined) {
                order.deliveryFee = dto.deliveryFee;
            }
        }
        else if (dto.orderType !== undefined) {
            order.deliveryFee = 0;
        }
        await this.orderRepo.save(order);
        if (wasCanceled) {
            try {
                await this.pointsService.invalidatePointsForCanceledOrder(orderId);
            }
            catch (error) {
                console.error('Error invalidating points for canceled order:', error);
            }
        }
        const fullOrder = await this.orderRepo.findOne({
            where: { id: order.id },
            relations: ['items', 'items.product', 'items.attributes'],
        });
        if (fullOrder) {
            const formatted = await this.mapOrderToGroupedFormat(fullOrder);
            if (dto.printed) {
                this.gateway.emitOrdersUpdates("updated_order_printed", formatted);
            }
            else if (dto.orderStatus === 'completed' &&
                fullOrder.orderType === 'table') {
                this.gateway.emitOrdersUpdates("orderCompleted", formatted);
            }
            else {
                this.gateway.emitOrdersUpdates("updated_order_items", formatted);
            }
        }
        return {
            success: true,
            message: `Order #${orderId} updated successfully`,
            updatedFields: dto,
        };
    }
    async mapOrderToGroupedFormat(order) {
        const groupedItems = {};
        for (const item of order.items) {
            const productId = item.product.id;
            const productName = item.product.name;
            const code = item.product.code;
            const imageUrl = item.product.imageUrl;
            const price = item.product.price;
            const attributeMap = item.attributes?.reduce((acc, attr) => {
                acc[attr.attributeName] = attr.attributeValue;
                return acc;
            }, {});
            if (!groupedItems[productId]) {
                groupedItems[productId] = {
                    productId,
                    code,
                    productName,
                    imageUrl,
                    quantity: 0,
                    price,
                    variants: [],
                };
            }
            groupedItems[productId].quantity += 1;
            groupedItems[productId].variants.push({
                note: item.note || null,
                attributes: attributeMap,
            });
        }
        const createdAtBogota = (0, date_util_1.formatToBogotaISO)(order.createdAt);
        const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
        return {
            orderId: order.id,
            dailyOrderNumber: order.dailyOrderNumber,
            customerName: order.customerName,
            phone: order.phone,
            address: order.address,
            createdAt: createdAtBogota,
            orderType: order.orderType,
            orderStatus: order.orderStatus,
            printed: order.printed,
            deliveryFee: order.deliveryFee ?? 0,
            orderSource: order.orderSource ?? 'internal',
            points: order.points ?? 0,
            pointCodes: pointCodes,
            items: Object.values(groupedItems),
            redemptionCode: order.redemptionCode ?? null,
        };
    }
    async validateRedemptionCodePublic(code) {
        return await this.pointsService.validateRedemptionCode(code);
    }
    async applyRedemptionVoucher(orderId, redemptionCode) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product'],
        });
        if (!order) {
            throw new common_1.BadRequestException('Order not found');
        }
        if (order.redemptionCode) {
            throw new common_1.BadRequestException('This order already has a redemption prize applied');
        }
        const redemption = await this.pointsService.validateRedemptionCode(redemptionCode.toUpperCase().trim());
        const hasHalfChicken = order.items.some(item => {
            const productCode = item.product?.code;
            return productCode === 2 || productCode === 5;
        });
        if (!hasHalfChicken) {
            throw new common_1.BadRequestException('To use a redemption prize, your order must include at least one half chicken (product code 2 or 5)');
        }
        order.redemptionCode = redemption.code;
        const allCodes = [];
        for (const item of order.items) {
            if (item.product?.code) {
                allCodes.push(item.product.code);
            }
        }
        let adjustedCodes = [...allCodes];
        const hasCode2 = adjustedCodes.includes(2);
        const hasCode5 = adjustedCodes.includes(5);
        if (hasCode2 && hasCode5) {
            const indexToRemove = adjustedCodes.indexOf(2);
            if (indexToRemove !== -1) {
                adjustedCodes.splice(indexToRemove, 1);
            }
            else {
                const index5 = adjustedCodes.indexOf(5);
                if (index5 !== -1) {
                    adjustedCodes.splice(index5, 1);
                }
            }
        }
        else if (hasCode2) {
            const indexToRemove = adjustedCodes.indexOf(2);
            if (indexToRemove !== -1) {
                adjustedCodes.splice(indexToRemove, 1);
            }
        }
        else if (hasCode5) {
            const indexToRemove = adjustedCodes.indexOf(5);
            if (indexToRemove !== -1) {
                adjustedCodes.splice(indexToRemove, 1);
            }
        }
        const newPoints = this.pointsService.calculatePointsFromCodes(adjustedCodes);
        const oldPoints = order.points || 0;
        order.points = newPoints;
        if (newPoints < oldPoints) {
            const pointsToRemove = oldPoints - newPoints;
            const pointCodes = await this.pointsService.getPointCodesByOrderId(orderId);
            if (pointCodes.length > newPoints) {
                const codesToDelete = pointCodes.slice(0, pointsToRemove);
                const pointsRepo = this.dataSource.getRepository(user_points_entity_1.UserPoints);
                for (const codeToDelete of codesToDelete) {
                    await pointsRepo.delete({ code: codeToDelete });
                }
            }
        }
        await this.pointsService.applyRedemptionToOrder(redemption.code, orderId);
        await this.orderRepo.save(order);
        const fullOrder = await this.orderRepo.findOne({
            where: { id: order.id },
            relations: ['items', 'items.product', 'items.attributes'],
        });
        if (fullOrder) {
            const formatted = await this.mapOrderToGroupedFormat(fullOrder);
            this.gateway.emitOrdersUpdates("updated_order_items", formatted);
            console.log(`✅ [Apply Premio] Prize ${redemption.code} applied to order #${order.dailyOrderNumber}`);
        }
        return order;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(order_item_entity_1.OrderItem)),
    __param(2, (0, typeorm_1.InjectRepository)(order_item_attribute_entity_1.OrderItemAttribute)),
    __param(3, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(4, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(7, (0, common_1.Inject)((0, common_1.forwardRef)(() => points_service_1.PointsService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        order_gateway_1.OrdersGateway,
        typeorm_2.DataSource,
        points_service_1.PointsService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map