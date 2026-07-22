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
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const product_entity_1 = require("../products/entities/product.entity");
const typeorm_2 = require("typeorm");
const order_item_attribute_entity_1 = require("./entities/order-item-attribute.entity");
const order_item_entity_1 = require("./entities/order-item.entity");
const order_entity_1 = require("./entities/order.entity");
const order_extra_entity_1 = require("./entities/order-extra.entity");
const order_gateway_1 = require("./Websocket/order.gateway");
const date_util_1 = require("../common/utils/date.util");
const date_fns_tz_1 = require("date-fns-tz");
const points_service_1 = require("../auth/services/points.service");
const user_entity_1 = require("../auth/entities/user.entity");
const user_points_entity_1 = require("../auth/entities/user-points.entity");
const mail_service_1 = require("../common/mail/mail.service");
const circuit_breaker_service_1 = require("../common/circuit-breaker/circuit-breaker.service");
const products_service_1 = require("../products/products.service");
let OrdersService = class OrdersService {
    static { OrdersService_1 = this; }
    orderRepo;
    itemRepo;
    attrRepo;
    extraRepo;
    productRepo;
    userRepo;
    gateway;
    dataSource;
    pointsService;
    productsService;
    mailService;
    circuitBreaker;
    inflightCreates = new Map();
    static SOFT_DEDUPE_WINDOW_MS = 25_000;
    constructor(orderRepo, itemRepo, attrRepo, extraRepo, productRepo, userRepo, gateway, dataSource, pointsService, productsService, mailService, circuitBreaker) {
        this.orderRepo = orderRepo;
        this.itemRepo = itemRepo;
        this.attrRepo = attrRepo;
        this.extraRepo = extraRepo;
        this.productRepo = productRepo;
        this.userRepo = userRepo;
        this.gateway = gateway;
        this.dataSource = dataSource;
        this.pointsService = pointsService;
        this.productsService = productsService;
        this.mailService = mailService;
        this.circuitBreaker = circuitBreaker;
    }
    buildOrderContentFingerprint(dto) {
        const items = (dto.items ?? [])
            .map((i) => {
            const attrs = (i.attributes ?? [])
                .map((a) => `${a.attributeName}=${a.attributeValue}`)
                .sort()
                .join(',');
            const unit = i.unitPrice != null && Number(i.unitPrice) >= 0 ? Number(i.unitPrice) : '';
            return `${i.productId}:${attrs}:${unit}:${i.note ?? ''}`;
        })
            .sort()
            .join('|');
        const extras = (dto.extras ?? [])
            .map((e) => `${e.title}:${e.amount}:${e.quantity ?? 1}`)
            .sort()
            .join('|');
        return [
            dto.orderType ?? 'pickup',
            String(dto.phone ?? '').trim(),
            String(dto.address ?? '').trim(),
            dto.deliveryFee ?? '',
            items,
            extras,
        ].join('::');
    }
    async findExistingByClientRequestId(clientRequestId) {
        const existing = await this.orderRepo.findOne({
            where: { clientRequestId },
            select: ['id', 'dailyOrderNumber'],
        });
        if (!existing)
            return null;
        return {
            success: true,
            orderId: existing.id,
            dailyOrderNumber: existing.dailyOrderNumber,
            duplicate: true,
        };
    }
    async findSoftDuplicate(dto) {
        const phone = String(dto.phone ?? '').trim();
        const address = String(dto.address ?? '').trim();
        const orderType = dto.orderType ?? 'pickup';
        const phoneLooksReal = phone.length >= 7 && phone !== '00';
        const isTable = orderType === 'table' && address.length > 0;
        if (!phoneLooksReal && !isTable)
            return null;
        const since = new Date(Date.now() - OrdersService_1.SOFT_DEDUPE_WINDOW_MS);
        const recent = await this.orderRepo.find({
            where: {
                orderType,
                phone,
                address,
                createdAt: (0, typeorm_2.Between)(since, new Date()),
                orderStatus: (0, typeorm_2.Not)('canceled'),
            },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
            order: { createdAt: 'DESC' },
            take: 8,
        });
        if (!recent.length)
            return null;
        const targetFp = this.buildOrderContentFingerprint(dto);
        for (const order of recent) {
            const asDto = {
                customerName: order.customerName,
                phone: order.phone,
                address: order.address,
                orderType: order.orderType,
                deliveryFee: order.deliveryFee,
                items: (order.items ?? []).map((it) => ({
                    productId: it.product.id,
                    note: it.note ?? '',
                    unitPrice: it.unitPrice != null ? Number(it.unitPrice) : undefined,
                    attributes: (it.attributes ?? []).map((a) => ({
                        attributeName: a.attributeName,
                        attributeValue: a.attributeValue,
                    })),
                })),
                extras: (order.extras ?? []).map((e) => ({
                    title: e.title,
                    amount: Number(e.amount),
                    quantity: e.quantity ?? 1,
                })),
            };
            if (this.buildOrderContentFingerprint(asDto) === targetFp) {
                return {
                    success: true,
                    orderId: order.id,
                    dailyOrderNumber: order.dailyOrderNumber,
                    duplicate: true,
                };
            }
        }
        return null;
    }
    resolveBulkInsertIds(insertResult, expectedCount) {
        if (expectedCount <= 0)
            return [];
        const raw = insertResult.raw;
        const firstId = Number(raw?.insertId);
        const affected = Number(raw?.affectedRows ?? 0);
        if (Number.isFinite(firstId) && firstId > 0 && affected >= expectedCount) {
            return Array.from({ length: expectedCount }, (_, i) => firstId + i);
        }
        const fromOrm = (insertResult.identifiers ?? [])
            .map((x) => Number(x?.id))
            .filter((id) => Number.isFinite(id) && id > 0);
        if (fromOrm.length === expectedCount)
            return fromOrm;
        throw new common_1.InternalServerErrorException(`No se pudieron resolver los IDs de ítems (esperados ${expectedCount}, insertId=${raw?.insertId}, affected=${affected}, orm=${fromOrm.length})`);
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
            .getRawOne();
        return (Number(result?.maxNumber) || 0) + 1;
    }
    buildInventoryCountByKey(items, invMap) {
        const countByKey = {};
        for (const item of items) {
            const inv = invMap.get(item.productId);
            if (!inv?.trackInventory)
                continue;
            if (inv.variantGroups?.length && item.attributes?.length) {
                const variantGroup = item.attributes.find((a) => inv.variantGroups.some((vg) => vg.attributeName === a.attributeName && vg.attributeValue === a.attributeValue));
                if (variantGroup) {
                    const vg = inv.variantGroups.find((x) => x.attributeName === variantGroup.attributeName &&
                        x.attributeValue === variantGroup.attributeValue);
                    if (vg) {
                        const key = `g:${vg.groupId}`;
                        countByKey[key] = (countByKey[key] ?? 0) + vg.groupBaseUnits;
                        continue;
                    }
                }
            }
            const processAlsoDeductFrom = () => {
                if (!inv.alsoDeductFrom?.length)
                    return;
                for (const ad of inv.alsoDeductFrom) {
                    let attrName = ad.attributeName;
                    let attrVal = ad.attributeValue;
                    const invTarget = invMap.get(ad.productId);
                    const targetHasVariantStock = (invTarget?.variantStocks?.length ?? 0) > 0;
                    if ((attrName == null || attrVal == null) && targetHasVariantStock) {
                        const adv = item.alsoDeductVariant;
                        if (adv?.productId === ad.productId && adv.attributes?.length) {
                            const match = adv.attributes.find((a) => invTarget.variantStocks.some((v) => v.attributeName === a.attributeName && v.attributeValue === a.attributeValue));
                            if (match) {
                                attrName = match.attributeName;
                                attrVal = match.attributeValue;
                            }
                        }
                        if (attrName == null || attrVal == null) {
                            const otherItem = items.find((i) => i.productId === ad.productId);
                            if (otherItem?.attributes?.length) {
                                const match = otherItem.attributes.find((a) => invTarget.variantStocks.some((v) => v.attributeName === a.attributeName && v.attributeValue === a.attributeValue));
                                if (match) {
                                    attrName = match.attributeName;
                                    attrVal = match.attributeValue;
                                }
                            }
                        }
                    }
                    if (attrName != null && attrVal != null && targetHasVariantStock) {
                        const vKey = `v:${ad.productId}:${attrName}:${attrVal}`;
                        countByKey[vKey] = (countByKey[vKey] ?? 0) + ad.baseUnits;
                    }
                    else {
                        const pKey = `p:${ad.productId}`;
                        countByKey[pKey] = (countByKey[pKey] ?? 0) + ad.baseUnits;
                    }
                }
            };
            if (inv.groupId != null && inv.groupBaseUnits != null) {
                const key = `g:${inv.groupId}`;
                countByKey[key] = (countByKey[key] ?? 0) + inv.groupBaseUnits;
                processAlsoDeductFrom();
                continue;
            }
            processAlsoDeductFrom();
            let key;
            if (inv.variantStocks?.length && item.attributes?.length) {
                const match = item.attributes.find((a) => inv.variantStocks.some((v) => v.attributeName === a.attributeName && v.attributeValue === a.attributeValue));
                if (match) {
                    key = `v:${item.productId}:${match.attributeName}:${match.attributeValue}`;
                }
                else {
                    key = `p:${item.productId}`;
                }
            }
            else {
                key = `p:${item.productId}`;
            }
            countByKey[key] = (countByKey[key] ?? 0) + 1;
        }
        return countByKey;
    }
    parseVariantKey(key) {
        if (!key.startsWith('v:'))
            return null;
        const parts = key.split(':');
        if (parts.length < 4)
            return null;
        return {
            productId: Number(parts[1]),
            attributeName: parts[2],
            attributeValue: parts.slice(3).join(':'),
        };
    }
    validateInventoryCounts(countByStockKey, invMap, products) {
        for (const [key, count] of Object.entries(countByStockKey)) {
            if (count <= 0)
                continue;
            if (key.startsWith('g:')) {
                const groupId = Number(key.replace('g:', ''));
                const invWithGroup = [...invMap.values()].find((inv) => inv.groupId === groupId);
                const available = invWithGroup?.groupStock ?? 0;
                if (available < count) {
                    throw new common_1.BadRequestException(`Stock insuficiente en el grupo de inventario. Disponible: ${available.toFixed(2)} unidades base, solicitado: ${count.toFixed(2)}`);
                }
                continue;
            }
            const variant = this.parseVariantKey(key);
            if (variant) {
                const { productId, attributeName, attributeValue } = variant;
                const inv = invMap.get(productId);
                const variantStock = inv?.variantStocks?.find((v) => v.attributeName === attributeName && v.attributeValue === attributeValue);
                const available = variantStock?.stock ?? 0;
                if (available < count) {
                    const p = products.find((x) => x.id === productId);
                    throw new common_1.BadRequestException(`Stock insuficiente para "${p?.name ?? 'producto'} - ${attributeValue}". Disponible: ${available}, solicitado: ${count}`);
                }
            }
            else {
                const productId = Number(key.replace('p:', ''));
                const inv = invMap.get(productId);
                const available = inv?.stock ?? 0;
                if (inv?.trackInventory && available < count) {
                    const p = products.find((x) => x.id === productId);
                    throw new common_1.BadRequestException(`Stock insuficiente para "${p?.name ?? 'producto'}". Disponible: ${available}, solicitado: ${count}`);
                }
            }
        }
    }
    async deductInventory(manager, countByStockKey) {
        const entries = Object.entries(countByStockKey).filter(([, count]) => count > 0);
        await Promise.all(entries.map(async ([key, count]) => {
            if (key.startsWith('g:')) {
                const groupId = Number(key.replace('g:', ''));
                await this.productsService.decrementGroupStock(manager, groupId, count);
                return;
            }
            const variant = this.parseVariantKey(key);
            if (variant) {
                await this.productsService.decrementVariantStock(manager, variant.productId, variant.attributeName, variant.attributeValue, count);
            }
            else {
                const productId = Number(key.replace('p:', ''));
                await this.productsService.decrementStock(manager, productId, count);
            }
        }));
    }
    async restoreInventory(manager, countByStockKey) {
        const entries = Object.entries(countByStockKey).filter(([, count]) => count > 0);
        await Promise.all(entries.map(async ([key, count]) => {
            if (key.startsWith('g:')) {
                const groupId = Number(key.replace('g:', ''));
                await this.productsService.incrementGroupStock(manager, groupId, count);
                return;
            }
            const variant = this.parseVariantKey(key);
            if (variant) {
                await this.productsService.incrementVariantStock(manager, variant.productId, variant.attributeName, variant.attributeValue, count);
            }
            else {
                const productId = Number(key.replace('p:', ''));
                await this.productsService.incrementStock(manager, productId, count);
            }
        }));
    }
    async create(createOrderDto) {
        const clientRequestId = (createOrderDto.clientRequestId || '').trim().slice(0, 64) || undefined;
        if (clientRequestId) {
            createOrderDto.clientRequestId = clientRequestId;
            const byKey = await this.findExistingByClientRequestId(clientRequestId);
            if (byKey)
                return byKey;
        }
        if (!clientRequestId) {
            const soft = await this.findSoftDuplicate(createOrderDto);
            if (soft)
                return soft;
        }
        const inflightKey = clientRequestId || `fp:${this.buildOrderContentFingerprint(createOrderDto)}`;
        const existingInflight = this.inflightCreates.get(inflightKey);
        if (existingInflight) {
            const result = await existingInflight;
            return { ...result, duplicate: true };
        }
        const run = this.createOrderInternal(createOrderDto).finally(() => {
            this.inflightCreates.delete(inflightKey);
        });
        this.inflightCreates.set(inflightKey, run);
        return run;
    }
    async createOrderInternal(createOrderDto) {
        const { customerName, phone, address, items, customerEmail, orderSource, redemptionCode, extras } = createOrderDto;
        const orderType = createOrderDto.orderType ?? 'pickup';
        const deliveryFee = createOrderDto.deliveryFee;
        const source = orderSource ?? 'internal';
        const clientRequestId = (createOrderDto.clientRequestId || '').trim().slice(0, 64) || null;
        const hasItems = items && items.length > 0;
        const hasExtras = extras && extras.length > 0;
        if (!hasItems && !hasExtras) {
            throw new common_1.BadRequestException('Order must have at least one item or one extra');
        }
        let countByStockKeyForDeduct = {};
        let allCodesFromProducts = [];
        const priceByProductId = new Map();
        const isTableCheck = orderType === 'table' && address != null && String(address).trim() !== '';
        const productIds = hasItems ? [...new Set(items.map((i) => i.productId))] : [];
        const [byKey, activeForTable, products, invMap] = await Promise.all([
            clientRequestId ? this.findExistingByClientRequestId(clientRequestId) : Promise.resolve(null),
            isTableCheck
                ? (() => {
                    const { start: todayStartUtc, end: todayEndUtc } = (0, date_util_1.getBogotaDayRange)();
                    return this.orderRepo.findOne({
                        where: {
                            orderType: 'table',
                            address: String(address).trim(),
                            orderStatus: (0, typeorm_2.Not)((0, typeorm_2.In)(['completed', 'canceled'])),
                            createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
                        },
                    });
                })()
                : Promise.resolve(null),
            productIds.length
                ? this.productRepo.find({
                    where: { id: (0, typeorm_2.In)(productIds) },
                    select: ['id', 'name', 'isActive', 'code', 'price'],
                })
                : Promise.resolve([]),
            productIds.length
                ? this.productsService.getInventoryByProductIds(productIds, { includeAlsoDeductTargets: true })
                : Promise.resolve(new Map()),
        ]);
        if (byKey)
            return byKey;
        if (activeForTable) {
            throw new common_1.BadRequestException('Esta mesa ya tiene una orden activa. Añade los productos a la orden existente.');
        }
        if (hasItems && items.length > 0) {
            const inactive = products.find((p) => p.isActive === false);
            if (inactive) {
                throw new common_1.BadRequestException(`El producto "${inactive.name}" está desactivado y no puede agregarse al pedido.`);
            }
            for (const p of products)
                priceByProductId.set(p.id, Number(p.price));
            const countByStockKey = this.buildInventoryCountByKey(items, invMap);
            this.validateInventoryCounts(countByStockKey, invMap, products);
            countByStockKeyForDeduct = { ...countByStockKey };
            allCodesFromProducts = items.map((i) => products.find((p) => p.id === i.productId)?.code).filter((c) => c != null);
        }
        const { start: todayStartUtc, end: todayEndUtc } = (0, date_util_1.getBogotaDayRange)();
        let finalDeliveryFee = 0;
        if (orderType === 'delivery') {
            if (deliveryFee == null) {
                throw new common_1.BadRequestException('El domicilio es obligatorio para pedidos a domicilio');
            }
            finalDeliveryFee = deliveryFee;
        }
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const dayKey = (0, date_fns_tz_1.formatInTimeZone)(todayStartUtc, 'America/Bogota', 'yyyy-MM-dd');
            const lockName = `ppp_daily_ord_${dayKey}`.slice(0, 64);
            const lockRows = await queryRunner.manager.query(`SELECT GET_LOCK(?, 8) AS got`, [lockName]);
            if (Number(lockRows?.[0]?.got) !== 1) {
                throw new common_1.InternalServerErrorException('No se pudo reservar el número de orden. Intenta de nuevo.');
            }
            let newOrderNumber = 0;
            let savedOrder;
            let calculatedPoints = 0;
            try {
                newOrderNumber = await this.generateNextOrderNumber(todayStartUtc, todayEndUtc, queryRunner.manager);
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
                    clientRequestId,
                });
                const allCodes = allCodesFromProducts;
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
                calculatedPoints = this.pointsService.calculatePointsFromCodes(adjustedCodes);
                order.points = calculatedPoints;
                savedOrder = await queryRunner.manager.save(order);
                if (items?.length) {
                    const itemRows = items.map((item) => {
                        const productPrice = priceByProductId.get(item.productId) ?? null;
                        const rawUnitPrice = item.unitPrice ?? item.unitPrice;
                        const customPrice = rawUnitPrice != null && Number(rawUnitPrice) >= 0 ? Number(rawUnitPrice) : null;
                        const unitPrice = customPrice ?? productPrice;
                        const valueToSave = unitPrice != null ? Number(unitPrice) : null;
                        return {
                            order: { id: savedOrder.id },
                            product: { id: item.productId },
                            note: item.note != null && item.note !== undefined ? String(item.note) : '',
                            unitPrice: valueToSave,
                        };
                    });
                    const insertResult = await queryRunner.manager.insert(order_item_entity_1.OrderItem, itemRows);
                    const itemIds = this.resolveBulkInsertIds(insertResult, itemRows.length);
                    const attrRows = [];
                    items.forEach((item, idx) => {
                        if (!item.attributes?.length)
                            return;
                        for (const attr of item.attributes) {
                            if (attr?.attributeName != null &&
                                attr?.attributeValue != null &&
                                String(attr.attributeValue).trim() !== '') {
                                attrRows.push({
                                    orderItem: { id: itemIds[idx] },
                                    attributeName: String(attr.attributeName).trim(),
                                    attributeValue: String(attr.attributeValue).trim(),
                                });
                            }
                        }
                    });
                    if (attrRows.length > 0) {
                        await queryRunner.manager.insert(order_item_attribute_entity_1.OrderItemAttribute, attrRows);
                    }
                    await this.deductInventory(queryRunner.manager, countByStockKeyForDeduct);
                }
                if (extras?.length) {
                    const extraEntities = extras.map((ex) => queryRunner.manager.create(order_extra_entity_1.OrderExtra, {
                        order: savedOrder,
                        title: ex.title,
                        description: ex.description ?? null,
                        amount: ex.amount,
                        quantity: ex.quantity ?? 1,
                    }));
                    await queryRunner.manager.save(extraEntities);
                }
                await queryRunner.commitTransaction();
            }
            finally {
                await queryRunner.manager.query(`SELECT RELEASE_LOCK(?)`, [lockName]).catch(() => undefined);
            }
            void this.finalizeOrderAfterCreate({
                orderId: savedOrder.id,
                dailyOrderNumber: newOrderNumber,
                calculatedPoints,
                source,
                customerEmail,
                customerName,
                phone,
                address,
                orderType,
                redemptionCode,
                deliveryFee: finalDeliveryFee,
            });
            return {
                success: true,
                orderId: savedOrder.id,
                dailyOrderNumber: newOrderNumber,
            };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (clientRequestId &&
                (error?.code === 'ER_DUP_ENTRY' || String(error?.message || '').includes('client_request_id'))) {
                const byKey = await this.findExistingByClientRequestId(clientRequestId);
                if (byKey)
                    return byKey;
            }
            if (error?.code === 'ER_DUP_ENTRY' || error?.message?.includes('duplicate')) {
                throw new common_1.BadRequestException('Ya existe una orden con ese número. Intenta de nuevo.');
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
    async finalizeOrderAfterCreate(params) {
        const { orderId, dailyOrderNumber: newOrderNumber, calculatedPoints, source, customerEmail, customerName, phone, address, orderType, redemptionCode, } = params;
        try {
            if (calculatedPoints > 0) {
                try {
                    if (source === 'online' && customerEmail) {
                        const user = await this.userRepo.findOne({ where: { email: customerEmail } });
                        if (user) {
                            await this.pointsService.createPointsForOrder(user.id, orderId, newOrderNumber, calculatedPoints);
                        }
                    }
                    else {
                        const pointsRepo = this.dataSource.getRepository(user_points_entity_1.UserPoints);
                        const pointRecords = [];
                        for (let i = 0; i < calculatedPoints; i++) {
                            const code = await this.pointsService.generateUniquePointCode();
                            pointRecords.push(pointsRepo.create({
                                code,
                                userId: null,
                                orderId,
                                orderDailyNumber: newOrderNumber,
                                isUsed: false,
                                type: 'automatic',
                                description: `Punto de orden #${newOrderNumber}`,
                            }));
                        }
                        if (pointRecords.length > 0)
                            await pointsRepo.save(pointRecords);
                    }
                }
                catch {
                }
            }
            if (redemptionCode && redemptionCode.trim()) {
                try {
                    await this.applyRedemptionVoucher(orderId, redemptionCode.trim());
                }
                catch {
                }
            }
            const finalOrder = await this.orderRepo.findOne({
                where: { id: orderId },
                relations: ['items', 'items.product', 'items.attributes', 'extras'],
            });
            if (!finalOrder)
                return;
            const formatted = await this.mapOrderToGroupedFormat(finalOrder);
            this.gateway.emitOrdersUpdates('created_order', formatted);
            if (source === 'online') {
                try {
                    const itemsMap = new Map();
                    finalOrder.items.forEach((item) => {
                        const productName = item.product?.name || `Producto #${item.product?.code || 'N/A'}`;
                        const price = Number(item.unitPrice ?? item.product?.price ?? 0);
                        const key = `${item.product?.id || 'unknown'}-${productName}`;
                        if (itemsMap.has(key)) {
                            itemsMap.get(key).quantity += 1;
                        }
                        else {
                            itemsMap.set(key, { productName, quantity: 1, price });
                        }
                    });
                    const emailItems = Array.from(itemsMap.values());
                    const subtotal = emailItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
                    const total = subtotal + (finalOrder.deliveryFee ? Number(finalOrder.deliveryFee) : 0);
                    await this.mailService.sendNewOrderNotification(newOrderNumber, customerName, phone, address, orderType, emailItems, total, finalOrder.deliveryFee ? Number(finalOrder.deliveryFee) : undefined);
                }
                catch {
                }
            }
        }
        catch {
        }
    }
    async findOrdersToday(orderType) {
        return this.circuitBreaker.execute(async () => {
            const { start: todayStartUtc, end: todayEndUtc } = (0, date_util_1.getBogotaDayRange)();
            const where = {
                createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
                orderStatus: (0, typeorm_2.Not)('canceled'),
            };
            if (orderType && ['table', 'delivery', 'pickup', 'counter', 'rappi'].includes(orderType)) {
                where.orderType = orderType;
            }
            const orders = await this.orderRepo.find({
                where,
                relations: ['items', 'items.product', 'items.attributes', 'extras'],
                order: { createdAt: 'DESC' },
            });
            const ordersWithPointCodes = await Promise.all(orders.map(async (order) => {
                const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
                const dbPoints = order.points;
                const pointsValue = dbPoints !== null && dbPoints !== undefined ? dbPoints : pointCodes.length || 0;
                return { order, pointCodes, pointsValue };
            }));
            const mappedOrders = await Promise.all(ordersWithPointCodes.map(async ({ order, pointCodes, pointsValue }) => {
                const formatted = await this.mapOrderToGroupedFormat(order);
                return { ...formatted, points: pointsValue, pointCodes };
            }));
            return mappedOrders;
        }, async () => []);
    }
    async findMine(email) {
        const orders = await this.orderRepo.find({
            where: {
                customerEmail: email,
                orderStatus: (0, typeorm_2.Not)('canceled'),
            },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
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
                if (!item.product)
                    continue;
                const productId = item.product.id;
                const productName = item.product.name;
                const code = item.product.code;
                const imageUrl = item.product.imageUrl;
                const price = item.unitPrice != null ? Number(item.unitPrice) : item.product.price;
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
                    kitchenPrepared: !!item.kitchenPreparedAt,
                });
            }
            const extrasList = order.extras?.map((e) => ({
                id: e.id,
                title: e.title,
                description: e.description,
                amount: Number(e.amount),
                quantity: e.quantity,
            })) ?? [];
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
                extras: extrasList,
                redemptionCode: order.redemptionCode ?? null,
            };
        });
    }
    async cancelOrderFully(orderId) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        if (!order)
            throw new common_1.NotFoundException(`No se encontró la orden con ID ${orderId}`);
        if (order.orderStatus === 'canceled') {
            return {
                success: true,
                message: `Orden #${order.dailyOrderNumber ?? orderId} ya estaba cancelada`,
                dailyOrderNumber: order.dailyOrderNumber,
            };
        }
        if (order.orderStatus === 'completed') {
            throw new common_1.BadRequestException('No se puede cancelar una orden ya completada. El inventario no se restaura en ventas finalizadas.');
        }
        order.items = this.deduplicateOrderItemsById(order.items);
        const oldProductIds = [
            ...new Set(order.items.map((i) => i.product?.id).filter((id) => id != null)),
        ];
        const invMapOld = oldProductIds.length
            ? await this.productsService.getInventoryByProductIds(oldProductIds, {
                includeAlsoDeductTargets: true,
            })
            : new Map();
        const oldItemsForInv = order.items.map((i) => ({
            productId: i.product.id,
            attributes: (i.attributes || []).map((a) => ({
                attributeName: a.attributeName,
                attributeValue: a.attributeValue,
            })),
        }));
        const oldCountByStockKey = this.buildInventoryCountByKey(oldItemsForInv, invMapOld);
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.restoreInventory(queryRunner.manager, oldCountByStockKey);
            const itemIds = order.items
                .map((i) => i.id)
                .filter((id) => id != null && Number.isInteger(id));
            if (itemIds.length > 0) {
                await queryRunner.manager
                    .createQueryBuilder()
                    .delete()
                    .from(order_item_attribute_entity_1.OrderItemAttribute)
                    .where('order_item_id IN (:...ids)', { ids: itemIds })
                    .execute();
                await queryRunner.manager
                    .createQueryBuilder()
                    .delete()
                    .from(order_item_entity_1.OrderItem)
                    .where('id IN (:...ids)', { ids: itemIds })
                    .execute();
            }
            else {
                await queryRunner.manager
                    .createQueryBuilder()
                    .delete()
                    .from(order_item_attribute_entity_1.OrderItemAttribute)
                    .where('order_item_id IN (SELECT id FROM ppp_order_items WHERE order_id = :orderId)', { orderId })
                    .execute();
                await queryRunner.manager
                    .createQueryBuilder()
                    .delete()
                    .from(order_item_entity_1.OrderItem)
                    .where('order_id = :orderId', { orderId })
                    .execute();
            }
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(order_extra_entity_1.OrderExtra)
                .where('order_id = :orderId', { orderId })
                .execute();
            await this.removeOrderFromTableGroupInTransaction(queryRunner.manager, orderId);
            await queryRunner.manager.update(order_entity_1.Order, { id: orderId }, { orderStatus: 'canceled', tableGroupId: null, points: 0 });
            await queryRunner.commitTransaction();
        }
        catch (e) {
            await queryRunner.rollbackTransaction();
            throw e;
        }
        finally {
            await queryRunner.release();
        }
        try {
            await this.pointsService.invalidatePointsForCanceledOrder(orderId);
        }
        catch {
        }
        order.orderStatus = 'canceled';
        order.tableGroupId = null;
        order.items = [];
        order.extras = [];
        this.gateway.emitOrdersUpdates('deleted_order', order);
        return {
            success: true,
            message: `Orden #${order.dailyOrderNumber ?? orderId} cancelada`,
            dailyOrderNumber: order.dailyOrderNumber,
        };
    }
    async removeOrder(orderId) {
        return this.cancelOrderFully(orderId);
    }
    async updateOrderItems(orderId, dto) {
        const rawItems = dto.items ?? [];
        const itemsToCreate = rawItems.slice();
        const incomingCount = itemsToCreate.length;
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        if (!order)
            throw new common_1.NotFoundException('No se encontró la orden');
        if (['completed', 'canceled'].includes(order.orderStatus)) {
            throw new common_1.BadRequestException('No se pueden modificar los ítems de una orden completada o cancelada');
        }
        order.items = this.deduplicateOrderItemsById(order.items);
        const hasItems = itemsToCreate.length > 0;
        const hasExtrasToAdd = Boolean(dto.extrasToAdd?.length);
        const hasExistingExtras = Boolean(order.extras?.length);
        if (!hasItems && !hasExtrasToAdd && !hasExistingExtras) {
            return this.cancelOrderFully(orderId);
        }
        const oldProductIds = [...new Set(order.items.map((i) => i.product?.id).filter((id) => id != null))];
        const newProductIds = [...new Set(itemsToCreate.map((i) => i.productId))];
        const [invMapOld, invMapNew, productsForPrice] = await Promise.all([
            oldProductIds.length
                ? this.productsService.getInventoryByProductIds(oldProductIds, { includeAlsoDeductTargets: true })
                : Promise.resolve(new Map()),
            newProductIds.length
                ? this.productsService.getInventoryByProductIds(newProductIds, { includeAlsoDeductTargets: true })
                : Promise.resolve(new Map()),
            newProductIds.length
                ? this.productRepo.find({ where: { id: (0, typeorm_2.In)(newProductIds) }, select: ['id', 'name', 'price', 'code'] })
                : Promise.resolve([]),
        ]);
        const oldItemsForInv = order.items.map((i) => ({
            productId: i.product.id,
            attributes: (i.attributes || []).map((a) => ({ attributeName: a.attributeName, attributeValue: a.attributeValue })),
        }));
        const oldCountByStockKey = this.buildInventoryCountByKey(oldItemsForInv, invMapOld);
        let newCountByStockKey = {};
        if (newProductIds.length > 0) {
            newCountByStockKey = this.buildInventoryCountByKey(itemsToCreate, invMapNew);
            this.validateInventoryCounts(newCountByStockKey, invMapNew, productsForPrice);
        }
        const priceByProductId = new Map(productsForPrice.map((p) => [p.id, Number(p.price)]));
        const codeByProductId = new Map(productsForPrice.map((p) => [p.id, p.code]));
        let createdItemsCount = 0;
        let fullOrderInTx = null;
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.restoreInventory(queryRunner.manager, oldCountByStockKey);
            const itemIdsToDelete = order.items.map((i) => i.id).filter((id) => id != null && Number.isInteger(id));
            if (itemIdsToDelete.length > 0) {
                await queryRunner.manager
                    .createQueryBuilder()
                    .delete()
                    .from(order_item_attribute_entity_1.OrderItemAttribute)
                    .where('order_item_id IN (:...ids)', { ids: itemIdsToDelete })
                    .execute();
                await queryRunner.manager
                    .createQueryBuilder()
                    .delete()
                    .from(order_item_entity_1.OrderItem)
                    .where('id IN (:...ids)', { ids: itemIdsToDelete })
                    .execute();
            }
            else if (order.items.length > 0) {
                await queryRunner.manager
                    .createQueryBuilder()
                    .delete()
                    .from(order_item_attribute_entity_1.OrderItemAttribute)
                    .where('order_item_id IN (SELECT id FROM ppp_order_items WHERE order_id = :orderId)', { orderId })
                    .execute();
                await queryRunner.manager
                    .createQueryBuilder()
                    .delete()
                    .from(order_item_entity_1.OrderItem)
                    .where('order_id = :orderId', { orderId })
                    .execute();
            }
            const wasPastCooking = ['cooked', 'packing', 'inDelivery', 'completed'].includes(order.orderStatus);
            if (wasPastCooking) {
                order.orderStatus = 'cooking';
                await queryRunner.manager.save(order);
            }
            const createdItemIds = [];
            if (itemsToCreate.length > 0) {
                const itemRows = itemsToCreate.map((itemDto) => {
                    const productPrice = priceByProductId.get(itemDto.productId) ?? null;
                    const customPrice = itemDto.unitPrice != null && Number(itemDto.unitPrice) >= 0 ? Number(itemDto.unitPrice) : null;
                    const unitPrice = customPrice ?? productPrice;
                    return {
                        order: { id: order.id },
                        product: { id: itemDto.productId },
                        note: itemDto.note != null ? String(itemDto.note) : '',
                        kitchenPreparedAt: itemDto.kitchenPrepared === true ? new Date() : null,
                        unitPrice: unitPrice != null ? unitPrice : null,
                    };
                });
                const insertResult = await queryRunner.manager.insert(order_item_entity_1.OrderItem, itemRows);
                const itemIds = this.resolveBulkInsertIds(insertResult, itemRows.length);
                createdItemsCount = itemIds.length;
                createdItemIds.push(...itemIds);
                const attrRows = [];
                itemsToCreate.forEach((itemDto, idx) => {
                    if (!itemDto.attributes?.length)
                        return;
                    for (const attr of itemDto.attributes) {
                        if (attr?.attributeName != null && attr?.attributeValue != null) {
                            attrRows.push({
                                orderItem: { id: itemIds[idx] },
                                attributeName: String(attr.attributeName).trim(),
                                attributeValue: String(attr.attributeValue).trim(),
                            });
                        }
                    }
                });
                if (attrRows.length > 0) {
                    await queryRunner.manager.insert(order_item_attribute_entity_1.OrderItemAttribute, attrRows);
                }
            }
            await this.deductInventory(queryRunner.manager, newCountByStockKey);
            if (dto.extrasToAdd?.length) {
                const extraEntities = dto.extrasToAdd.map((ex) => queryRunner.manager.create(order_extra_entity_1.OrderExtra, {
                    order,
                    title: ex.title,
                    description: ex.description ?? null,
                    amount: ex.amount,
                    quantity: ex.quantity ?? 1,
                }));
                await queryRunner.manager.save(extraEntities);
            }
            const loadedItems = createdItemIds.length > 0
                ? await queryRunner.manager.find(order_item_entity_1.OrderItem, {
                    where: { id: (0, typeorm_2.In)(createdItemIds) },
                    relations: ['product', 'attributes'],
                })
                : [];
            const orderExtras = await queryRunner.manager.find(order_extra_entity_1.OrderExtra, {
                where: { order: { id: order.id } },
            });
            fullOrderInTx = {
                ...order,
                items: this.deduplicateOrderItemsById(loadedItems),
                extras: orderExtras,
            };
            await queryRunner.commitTransaction();
        }
        catch (e) {
            await queryRunner.rollbackTransaction();
            throw e;
        }
        finally {
            await queryRunner.release();
        }
        let fullOrder = (await this.orderRepo.findOne({
            where: { id: order.id },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        })) ?? fullOrderInTx;
        if (fullOrder) {
            fullOrder.items = this.deduplicateOrderItemsById(fullOrder.items);
            const allCodes = [];
            for (const item of fullOrder.items) {
                if (item.product?.code != null) {
                    allCodes.push(item.product.code);
                }
                else {
                    const code = codeByProductId.get(item.product?.id ?? 0);
                    if (code != null)
                        allCodes.push(code);
                }
            }
            const recalculatedPoints = this.pointsService.calculatePointsFromCodes(allCodes);
            fullOrder.points = recalculatedPoints;
            void this.finalizeOrderAfterUpdate(fullOrder, recalculatedPoints).catch((err) => {
                process.stderr.write(`[updateOrderItems] finalize async failed: ${String(err)}\n`);
            });
        }
        return {
            success: true,
            message: `Order #${fullOrder?.dailyOrderNumber ?? order.dailyOrderNumber} updated successfully`,
            itemsCount: fullOrder?.items?.length ?? createdItemsCount,
            dtoCount: incomingCount,
        };
    }
    async finalizeOrderAfterUpdate(fullOrder, recalculatedPoints) {
        await this.orderRepo.update({ id: fullOrder.id }, { points: recalculatedPoints });
        try {
            await this.pointsService.updatePointCodesForOrder(fullOrder.id, fullOrder.dailyOrderNumber, recalculatedPoints);
        }
        catch {
        }
        const formatted = await this.mapOrderToGroupedFormat(fullOrder);
        this.gateway.emitOrdersUpdates('updated_order_items', formatted);
    }
    async updateOrderItemUnitPrice(orderId, dto) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        if (!order)
            throw new common_1.NotFoundException('No se encontró la orden');
        if (['completed', 'canceled'].includes(order.orderStatus)) {
            throw new common_1.BadRequestException('No se puede modificar el precio de una orden completada o cancelada');
        }
        const itemsToUpdate = order.items.filter((i) => i.product?.id === dto.productId);
        if (itemsToUpdate.length === 0) {
            throw new common_1.NotFoundException('No hay ítems de ese producto en la orden');
        }
        const value = Number(dto.unitPrice);
        if (!Number.isFinite(value) || value < 0) {
            throw new common_1.BadRequestException('Precio unitario inválido');
        }
        await this.itemRepo.update({ order: { id: orderId }, product: { id: dto.productId } }, { unitPrice: value });
        const refreshedOrder = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        if (refreshedOrder) {
            const formatted = await this.mapOrderToGroupedFormat(refreshedOrder);
            this.gateway.emitOrdersUpdates('updated_order_items', formatted);
            return formatted;
        }
        return null;
    }
    async addExtra(orderId, dto) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId, orderStatus: (0, typeorm_2.Not)('canceled') },
        });
        if (!order)
            throw new common_1.NotFoundException('Orden no encontrada o cancelada');
        if (order.orderStatus === 'completed') {
            throw new common_1.BadRequestException('No se pueden añadir adicionales a una orden completada');
        }
        const extra = this.extraRepo.create({
            order: { id: orderId },
            title: dto.title,
            description: dto.description ?? null,
            amount: dto.amount,
            quantity: dto.quantity ?? 1,
        });
        await this.extraRepo.save(extra);
        const full = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        if (full) {
            const formatted = await this.mapOrderToGroupedFormat(full);
            this.gateway.emitOrdersUpdates('updated_order_items', formatted);
        }
        return { success: true, message: 'Adicional añadido', extra: { id: extra.id, title: extra.title, description: extra.description, amount: Number(extra.amount), quantity: extra.quantity } };
    }
    async deleteExtra(orderId, extraId) {
        const extra = await this.extraRepo.findOne({
            where: { id: extraId },
            relations: ['order'],
        });
        if (!extra || extra.order?.id !== orderId)
            throw new common_1.NotFoundException('Adicional no encontrado o no pertenece a esta orden');
        if (extra.order.orderStatus === 'completed' || extra.order.orderStatus === 'canceled') {
            throw new common_1.BadRequestException('No se pueden eliminar adicionales de una orden completada o cancelada');
        }
        await this.extraRepo.remove(extra);
        const full = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        if (full) {
            const formatted = await this.mapOrderToGroupedFormat(full);
            this.gateway.emitOrdersUpdates('updated_order_items', formatted);
        }
        return { success: true, message: 'Adicional eliminado' };
    }
    async updateExtra(orderId, extraId, dto) {
        const extra = await this.extraRepo.findOne({
            where: { id: extraId },
            relations: ['order'],
        });
        if (!extra || extra.order?.id !== orderId)
            throw new common_1.NotFoundException('Adicional no encontrado o no pertenece a esta orden');
        if (extra.order.orderStatus === 'completed' || extra.order.orderStatus === 'canceled') {
            throw new common_1.BadRequestException('No se pueden modificar adicionales de una orden completada o cancelada');
        }
        if (dto.title !== undefined)
            extra.title = dto.title;
        if (dto.description !== undefined)
            extra.description = dto.description;
        if (dto.amount !== undefined)
            extra.amount = dto.amount;
        if (dto.quantity !== undefined)
            extra.quantity = dto.quantity;
        await this.extraRepo.save(extra);
        const full = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        if (full) {
            const formatted = await this.mapOrderToGroupedFormat(full);
            this.gateway.emitOrdersUpdates('updated_order_items', formatted);
        }
        return { success: true, message: 'Adicional actualizado', extra: { id: extra.id, title: extra.title, description: extra.description, amount: Number(extra.amount), quantity: extra.quantity } };
    }
    async updateOrderGeneral(orderId, dto) {
        const order = await this.orderRepo.findOneBy({ id: orderId });
        if (!order)
            throw new Error('No se encontró la orden');
        const isCompletingLinkedTable = dto.orderStatus === 'completed' &&
            order.orderType === 'table' &&
            order.orderStatus !== 'completed' &&
            order.orderStatus !== 'canceled' &&
            order.tableGroupId != null;
        if (isCompletingLinkedTable) {
            const groupId = order.tableGroupId;
            const { start: todayStartUtc, end: todayEndUtc } = (0, date_util_1.getBogotaDayRange)();
            const groupOrders = await this.orderRepo.find({
                where: {
                    tableGroupId: groupId,
                    orderType: 'table',
                    orderStatus: (0, typeorm_2.Not)((0, typeorm_2.In)(['completed', 'canceled'])),
                    createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
                },
            });
            const ids = groupOrders.map((o) => o.id);
            await this.orderRepo.update({ id: (0, typeorm_2.In)(ids) }, { orderStatus: 'completed', tableGroupId: null });
            const fullOrders = await this.orderRepo.find({
                where: { id: (0, typeorm_2.In)(ids) },
                relations: ['items', 'items.product', 'items.attributes'],
            });
            await Promise.all(fullOrders.map(async (fullOrder) => {
                const formatted = await this.mapOrderToGroupedFormat(fullOrder);
                this.gateway.emitOrdersUpdates('orderCompleted', formatted);
            }));
            const tables = groupOrders
                .map((o) => String(o.address ?? '').trim())
                .filter(Boolean)
                .sort((a, b) => Number(a) - Number(b));
            return {
                success: true,
                message: ids.length > 1
                    ? `Mesas vinculadas completadas: ${tables.join(', ')}`
                    : `Order #${orderId} updated successfully`,
                updatedFields: dto,
                completedOrderIds: ids,
            };
        }
        if (dto.orderStatus === 'canceled' && order.orderStatus !== 'canceled') {
            return this.cancelOrderFully(orderId);
        }
        if (order.orderStatus === 'completed') {
            if ((dto.orderStatus !== undefined && dto.orderStatus !== 'completed') ||
                dto.orderType !== undefined ||
                dto.deliveryFee !== undefined) {
                throw new common_1.BadRequestException('No se puede modificar estado/tipo/domicilio de una orden ya completada');
            }
        }
        if (order.orderStatus === 'canceled') {
            throw new common_1.BadRequestException('No se puede modificar una orden cancelada');
        }
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
        if (dto.orderStatus === 'cooked' || dto.orderStatus === 'packing') {
            await this.itemRepo.update({ order: { id: orderId }, kitchenPreparedAt: (0, typeorm_2.IsNull)() }, { kitchenPreparedAt: new Date() });
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
    async changeTable(orderId, dto) {
        const newTable = String(dto.newTable ?? '').trim();
        if (!newTable)
            throw new common_1.BadRequestException('newTable es requerido');
        const { start: todayStartUtc, end: todayEndUtc } = (0, date_util_1.getBogotaDayRange)();
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes'],
        });
        if (!order)
            throw new common_1.NotFoundException(`No se encontró la orden #${orderId}`);
        if (order.orderType !== 'table')
            throw new common_1.BadRequestException('Solo se puede cambiar mesa en órdenes tipo mesa');
        if (order.orderStatus === 'completed' || order.orderStatus === 'canceled') {
            throw new common_1.BadRequestException('No se puede cambiar mesa en una orden completada o cancelada');
        }
        const currentTable = String(order.address ?? '').trim();
        if (currentTable === newTable) {
            throw new common_1.BadRequestException('La orden ya está en esa mesa');
        }
        const otherOrder = await this.orderRepo.findOne({
            where: {
                address: newTable,
                orderType: 'table',
                orderStatus: (0, typeorm_2.Not)((0, typeorm_2.In)(['completed', 'canceled'])),
                createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
            },
            relations: ['items', 'items.product', 'items.attributes'],
        });
        const movedOrderIds = [];
        if (!otherOrder) {
            await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(order_entity_1.Order);
                const o = await repo.findOne({ where: { id: order.id } });
                if (!o)
                    throw new common_1.InternalServerErrorException('Orden no encontrada en transacción');
                o.address = newTable;
                await repo.save(o);
                movedOrderIds.push(o.id);
            });
            const affectedOrderIds = await this.collectLinkedTableOrderIds(movedOrderIds);
            await this.emitFormattedOrdersUpdate(affectedOrderIds);
            return {
                success: true,
                message: `Orden movida a la mesa ${newTable}`,
                swapped: false,
            };
        }
        await this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(order_entity_1.Order);
            const o1 = await repo.findOne({ where: { id: order.id } });
            const o2 = await repo.findOne({ where: { id: otherOrder.id } });
            if (!o1 || !o2)
                throw new common_1.InternalServerErrorException('Orden no encontrada en transacción');
            o1.address = newTable;
            o2.address = currentTable;
            await repo.save(o1);
            await repo.save(o2);
            movedOrderIds.push(o1.id, o2.id);
        });
        const affectedOrderIds = await this.collectLinkedTableOrderIds(movedOrderIds);
        await this.emitFormattedOrdersUpdate(affectedOrderIds);
        return {
            success: true,
            message: `Mesas intercambiadas: orden de mesa ${currentTable} → ${newTable}, orden de mesa ${newTable} → ${currentTable}`,
            swapped: true,
        };
    }
    async linkTables(orderId, tableNumbers) {
        const source = await this.orderRepo.findOne({ where: { id: orderId } });
        if (!source)
            throw new common_1.NotFoundException(`No se encontró la orden #${orderId}`);
        if (source.orderType !== 'table') {
            throw new common_1.BadRequestException('Solo se pueden vincular órdenes de mesa');
        }
        if (source.orderStatus === 'completed' || source.orderStatus === 'canceled') {
            throw new common_1.BadRequestException('No se puede vincular una orden completada o cancelada');
        }
        const sourceTable = String(source.address ?? '').trim();
        const uniqueTargets = [
            ...new Set((tableNumbers ?? [])
                .map((t) => String(t).trim())
                .filter((t) => t && t !== sourceTable)),
        ];
        if (uniqueTargets.length === 0) {
            throw new common_1.BadRequestException('Indica al menos una mesa distinta para vincular');
        }
        const { start: todayStartUtc, end: todayEndUtc } = (0, date_util_1.getBogotaDayRange)();
        const targets = await this.orderRepo.find({
            where: {
                orderType: 'table',
                address: (0, typeorm_2.In)(uniqueTargets),
                orderStatus: (0, typeorm_2.Not)((0, typeorm_2.In)(['completed', 'canceled'])),
                createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
            },
        });
        const byTable = new Map();
        for (const t of targets) {
            const key = String(t.address ?? '').trim();
            const prev = byTable.get(key);
            if (!prev || (t.id ?? 0) > (prev.id ?? 0))
                byTable.set(key, t);
        }
        for (const tableNum of uniqueTargets) {
            if (!byTable.has(tableNum)) {
                throw new common_1.BadRequestException(`Mesa ${tableNum} no tiene una orden activa hoy`);
            }
        }
        const ordersToLink = [source, ...uniqueTargets.map((t) => byTable.get(t))];
        const unifiedGroupId = await this.resolveUnifiedTableGroupId(ordersToLink);
        const orderIds = ordersToLink.map((o) => o.id);
        await this.orderRepo.update({ id: (0, typeorm_2.In)(orderIds) }, { tableGroupId: unifiedGroupId });
        const allInGroup = await this.orderRepo.find({
            where: {
                tableGroupId: unifiedGroupId,
                orderStatus: (0, typeorm_2.Not)((0, typeorm_2.In)(['completed', 'canceled'])),
                createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
            },
        });
        await this.emitFormattedOrdersUpdate(allInGroup.map((o) => o.id));
        const linkedTables = allInGroup
            .map((o) => String(o.address ?? '').trim())
            .filter(Boolean)
            .sort((a, b) => Number(a) - Number(b));
        return {
            success: true,
            message: `Mesas vinculadas: ${linkedTables.join(', ')}`,
            tableGroupId: unifiedGroupId,
            linkedTables,
        };
    }
    async unlinkTable(orderId) {
        const order = await this.orderRepo.findOne({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException(`No se encontró la orden #${orderId}`);
        if (!order.tableGroupId) {
            throw new common_1.BadRequestException('Esta mesa no está vinculada a otras');
        }
        const groupId = order.tableGroupId;
        const { start: todayStartUtc, end: todayEndUtc } = (0, date_util_1.getBogotaDayRange)();
        await this.orderRepo.update({ id: orderId }, { tableGroupId: null });
        const remaining = await this.orderRepo.find({
            where: {
                tableGroupId: groupId,
                orderStatus: (0, typeorm_2.Not)((0, typeorm_2.In)(['completed', 'canceled'])),
                createdAt: (0, typeorm_2.Between)(todayStartUtc, todayEndUtc),
            },
        });
        if (remaining.length <= 1) {
            await this.orderRepo.update({ tableGroupId: groupId }, { tableGroupId: null });
        }
        const affectedIds = [orderId, ...remaining.map((o) => o.id)];
        await this.emitFormattedOrdersUpdate(affectedIds);
        return {
            success: true,
            message: `Mesa ${order.address} desvinculada`,
        };
    }
    async collectLinkedTableOrderIds(orderIds) {
        const unique = [...new Set(orderIds)];
        if (unique.length === 0)
            return unique;
        const orders = await this.orderRepo.find({ where: { id: (0, typeorm_2.In)(unique) } });
        const groupIds = [
            ...new Set(orders.map((o) => o.tableGroupId).filter((id) => id != null)),
        ];
        if (groupIds.length === 0)
            return unique;
        const peers = await this.orderRepo.find({
            where: {
                tableGroupId: (0, typeorm_2.In)(groupIds),
                orderStatus: (0, typeorm_2.Not)((0, typeorm_2.In)(['completed', 'canceled'])),
            },
        });
        return [...new Set([...unique, ...peers.map((p) => p.id)])];
    }
    async removeOrderFromTableGroupInTransaction(manager, orderId) {
        const repo = manager.getRepository(order_entity_1.Order);
        const order = await repo.findOne({ where: { id: orderId } });
        if (!order?.tableGroupId)
            return [];
        const groupId = order.tableGroupId;
        const affected = [orderId];
        await repo.update({ id: orderId }, { tableGroupId: null });
        const remaining = await repo.find({
            where: {
                tableGroupId: groupId,
                orderStatus: (0, typeorm_2.Not)((0, typeorm_2.In)(['completed', 'canceled'])),
            },
        });
        if (remaining.length <= 1) {
            const toClear = await repo.find({ where: { tableGroupId: groupId } });
            for (const o of toClear) {
                affected.push(o.id);
            }
            if (toClear.length > 0) {
                await repo.update({ tableGroupId: groupId }, { tableGroupId: null });
            }
        }
        return [...new Set(affected)];
    }
    async resolveUnifiedTableGroupId(orders) {
        const existingGroupIds = [
            ...new Set(orders
                .map((o) => o.tableGroupId)
                .filter((id) => id != null)),
        ];
        if (existingGroupIds.length === 0) {
            return Date.now();
        }
        const unifiedId = Math.min(...existingGroupIds);
        if (existingGroupIds.some((id) => id !== unifiedId)) {
            await this.orderRepo.update({ tableGroupId: (0, typeorm_2.In)(existingGroupIds) }, { tableGroupId: unifiedId });
        }
        return unifiedId;
    }
    async emitFormattedOrdersUpdate(orderIds) {
        const uniqueIds = [...new Set(orderIds)];
        if (!uniqueIds.length)
            return;
        const orders = await this.orderRepo.find({
            where: { id: (0, typeorm_2.In)(uniqueIds) },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        await Promise.all(orders.map(async (full) => {
            const formatted = await this.mapOrderToGroupedFormat(full);
            this.gateway.emitOrdersUpdates('updated_order_items', formatted);
        }));
    }
    incomingItemSignature(item) {
        const attrs = (item.attributes ?? []).slice().sort((a, b) => (a.attributeName || '').localeCompare(b.attributeName || ''));
        return `${item.productId}|${attrs.map((a) => `${a.attributeName}=${a.attributeValue}`).join(',')}|${item.note ?? ''}`;
    }
    deduplicateIncomingUpdateItems(items) {
        if (!items?.length)
            return [];
        const seen = new Set();
        return items.filter((it) => {
            const sig = this.incomingItemSignature(it);
            if (seen.has(sig))
                return false;
            seen.add(sig);
            return true;
        });
    }
    deduplicateOrderItemsById(items) {
        if (!items?.length)
            return [];
        const seen = new Set();
        const out = items.filter((i) => {
            const id = i.id;
            if (id == null || seen.has(id))
                return false;
            seen.add(id);
            return true;
        });
        if (out.length !== items.length) {
        }
        return out;
    }
    async mapOrderToGroupedFormat(order) {
        const groupedItems = {};
        const items = this.deduplicateOrderItemsById(order.items);
        for (const item of items) {
            if (!item.product)
                continue;
            const productId = item.product.id;
            const productName = item.product.name;
            const code = item.product.code;
            const imageUrl = item.product.imageUrl;
            const rawUnit = item.unitPrice ?? item.unit_price;
            const price = rawUnit != null && rawUnit !== '' ? Number(rawUnit) : Number(item.product?.price ?? 0);
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
                kitchenPrepared: !!item.kitchenPreparedAt,
            });
        }
        const createdAtBogota = (0, date_util_1.formatToBogotaISO)(order.createdAt);
        const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
        const extrasList = order.extras?.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            amount: Number(e.amount),
            quantity: e.quantity,
        })) ?? [];
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
            pointCodes,
            items: Object.values(groupedItems),
            extras: extrasList,
            redemptionCode: order.redemptionCode ?? null,
            tableGroupId: order.tableGroupId ?? null,
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
            throw new common_1.BadRequestException('Orden no encontrada');
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
                if (codesToDelete.length > 0) {
                    await pointsRepo.delete({ code: (0, typeorm_2.In)(codesToDelete) });
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
        }
        return order;
    }
    async getOrdersBrief(orderIds) {
        if (!orderIds?.length)
            return [];
        const uniq = [...new Set(orderIds)];
        const orders = await this.orderRepo.find({
            where: { id: (0, typeorm_2.In)(uniq) },
            select: ['id', 'dailyOrderNumber', 'createdAt'],
        });
        return orders;
    }
    async findOrdersByDate(date) {
        const [year, month, day] = date.split('-').map(Number);
        const startBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`;
        const endBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999-05:00`;
        const startUtc = new Date(startBogotaString);
        const endUtc = new Date(endBogotaString);
        const orders = await this.orderRepo.find({
            where: {
                createdAt: (0, typeorm_2.Between)(startUtc, endUtc),
                orderStatus: (0, typeorm_2.Not)('canceled'),
            },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
            order: { createdAt: 'DESC' },
        });
        const ordersWithPointCodes = await Promise.all(orders.map(async (order) => {
            const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
            const pointsValue = order.points ?? pointCodes.length ?? 0;
            return { order, pointCodes, pointsValue };
        }));
        const mappedOrders = await Promise.all(ordersWithPointCodes.map(async ({ order, pointCodes, pointsValue }) => {
            const formatted = await this.mapOrderToGroupedFormat(order);
            return { ...formatted, points: pointsValue, pointCodes };
        }));
        return mappedOrders;
    }
    async getDailySummary(date) {
        let startUtc;
        let endUtc;
        if (date) {
            const [year, month, day] = date.split('-').map(Number);
            const startBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`;
            const endBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999-05:00`;
            startUtc = new Date(startBogotaString);
            endUtc = new Date(endBogotaString);
        }
        else {
            const { start, end } = (0, date_util_1.getBogotaDayRange)();
            startUtc = start;
            endUtc = end;
        }
        const orders = await this.orderRepo.find({
            where: {
                createdAt: (0, typeorm_2.Between)(startUtc, endUtc),
                orderStatus: (0, typeorm_2.Not)('canceled'),
            },
            relations: ['items', 'items.product', 'extras'],
        });
        const allProducts = await this.productRepo.find({
            select: ['id', 'name', 'price', 'code'],
        });
        let totalSubtotal = 0;
        let totalDeliveryFees = 0;
        let totalPremioDiscounts = 0;
        let totalOrders = orders.length;
        const ordersByType = {
            delivery: 0,
            pickup: 0,
            table: 0,
            counter: 0,
            rappi: 0,
        };
        const productsSold = {};
        for (const order of orders) {
            let orderSubtotal = 0;
            for (const item of order.items) {
                if (!item.product)
                    continue;
                const product = allProducts.find(p => p.id === item.product.id);
                if (product) {
                    const itemPrice = Number(item.unitPrice ?? product.price);
                    orderSubtotal += itemPrice;
                    if (!productsSold[product.code]) {
                        productsSold[product.code] = {
                            code: product.code,
                            name: product.name,
                            quantity: 0,
                            totalRevenue: 0,
                        };
                    }
                    productsSold[product.code].quantity += 1;
                    productsSold[product.code].totalRevenue += itemPrice;
                }
            }
            for (const ex of order.extras ?? []) {
                orderSubtotal += Number(ex.amount) * (ex.quantity ?? 1);
            }
            if (order.orderType === 'delivery' && order.deliveryFee) {
                totalDeliveryFees += Number(order.deliveryFee);
            }
            if (order.redemptionCode) {
                const halfChickenItem = order.items.find(item => item.product && (item.product.code === 2 || item.product.code === 5));
                if (halfChickenItem && halfChickenItem.product) {
                    const product = allProducts.find(p => p.id === halfChickenItem.product.id);
                    if (product) {
                        const premioPrice = Number(halfChickenItem.unitPrice ?? product.price);
                        totalPremioDiscounts += premioPrice;
                        if (productsSold[product.code]) {
                            productsSold[product.code].totalRevenue -= premioPrice;
                        }
                    }
                }
            }
            totalSubtotal += orderSubtotal;
            ordersByType[order.orderType] = (ordersByType[order.orderType] || 0) + 1;
        }
        const totalRevenue = totalSubtotal + totalDeliveryFees - totalPremioDiscounts;
        const productsSoldArray = Object.values(productsSold).sort((a, b) => a.code - b.code);
        return {
            date: date || (0, date_fns_tz_1.formatInTimeZone)(new Date(), 'America/Bogota', 'yyyy-MM-dd'),
            totalOrders,
            ordersByType,
            totals: {
                subtotal: totalSubtotal,
                deliveryFees: totalDeliveryFees,
                premioDiscounts: totalPremioDiscounts,
                total: totalRevenue,
            },
            productsSold: productsSoldArray,
            orders: orders.map(o => ({
                id: o.id,
                dailyOrderNumber: o.dailyOrderNumber,
                orderType: o.orderType,
                createdAt: (0, date_util_1.formatToBogotaISO)(o.createdAt),
            })),
        };
    }
    static ADMIN_STATS_MIN_DATE = '2026-01-21';
    async getSalesReport(from, to) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(from) || !dateRegex.test(to)) {
            throw new common_1.BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
        }
        const MIN = OrdersService_1.ADMIN_STATS_MIN_DATE;
        if (from < MIN)
            from = MIN;
        if (from > to) {
            throw new common_1.BadRequestException('La fecha de inicio no puede ser posterior a la fecha fin');
        }
        const { start: startUtc } = (0, date_util_1.getBogotaDateRange)(from);
        const { end: endUtc } = (0, date_util_1.getBogotaDateRange)(to);
        if (startUtc > endUtc) {
            throw new common_1.BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha fin');
        }
        const orders = await this.orderRepo.find({
            where: {
                createdAt: (0, typeorm_2.Between)(startUtc, endUtc),
                orderStatus: (0, typeorm_2.Not)('canceled'),
            },
            relations: ['items', 'items.product', 'extras'],
        });
        const allProducts = await this.productRepo.find({
            select: ['id', 'name', 'price', 'code'],
            relations: ['categories'],
        });
        let totalSubtotal = 0;
        let totalDeliveryFees = 0;
        let totalPremioDiscounts = 0;
        let totalItemsSold = 0;
        let ordersWithPremio = 0;
        const ordersByType = {
            delivery: 0,
            pickup: 0,
            table: 0,
            counter: 0,
            rappi: 0,
        };
        const revenueByOrderType = {
            delivery: 0,
            pickup: 0,
            table: 0,
            counter: 0,
            rappi: 0,
        };
        const productsSold = {};
        const dailyBreakdown = {};
        const hourlyBreakdown = {};
        for (let h = 0; h < 24; h++)
            hourlyBreakdown[h] = { orders: 0, total: 0 };
        const TICKET_BUCKETS = [0, 20000, 50000, 100000, 200000, Infinity];
        const ticketDistribution = [
            { min: 0, max: 20000, label: 'Hasta $20k', count: 0 },
            { min: 20000, max: 50000, label: '$20k - $50k', count: 0 },
            { min: 50000, max: 100000, label: '$50k - $100k', count: 0 },
            { min: 100000, max: 200000, label: '$100k - $200k', count: 0 },
            { min: 200000, max: Infinity, label: 'Más de $200k', count: 0 },
        ];
        const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        for (const order of orders) {
            const orderDate = (0, date_fns_tz_1.formatInTimeZone)(order.createdAt, 'America/Bogota', 'yyyy-MM-dd');
            const dayOfWeek = DAY_NAMES[new Date(orderDate + 'T12:00:00').getDay()];
            if (!dailyBreakdown[orderDate]) {
                dailyBreakdown[orderDate] = { total: 0, orders: 0, dayOfWeek };
            }
            dailyBreakdown[orderDate].orders += 1;
            let orderSubtotal = 0;
            let orderDelivery = 0;
            let orderPremio = 0;
            for (const item of order.items) {
                if (!item.product)
                    continue;
                const product = allProducts.find(p => p.id === item.product.id);
                if (product) {
                    const itemPrice = Number(item.unitPrice ?? product.price);
                    orderSubtotal += itemPrice;
                    totalItemsSold += 1;
                    const cat = product.categories?.[0];
                    if (!productsSold[product.code]) {
                        productsSold[product.code] = {
                            code: product.code,
                            name: product.name,
                            quantity: 0,
                            totalRevenue: 0,
                            categoryId: cat?.id,
                            categoryName: cat?.name,
                        };
                    }
                    productsSold[product.code].quantity += 1;
                    productsSold[product.code].totalRevenue += itemPrice;
                }
            }
            for (const ex of order.extras ?? []) {
                orderSubtotal += Number(ex.amount) * (ex.quantity ?? 1);
            }
            if (order.orderType === 'delivery' && order.deliveryFee) {
                orderDelivery = Number(order.deliveryFee);
                totalDeliveryFees += orderDelivery;
            }
            if (order.redemptionCode) {
                ordersWithPremio += 1;
                const halfChickenItem = order.items.find(item => item.product && (item.product.code === 2 || item.product.code === 5));
                if (halfChickenItem?.product) {
                    const product = allProducts.find(p => p.id === halfChickenItem.product.id);
                    if (product) {
                        orderPremio = Number(halfChickenItem.unitPrice ?? product.price);
                        totalPremioDiscounts += orderPremio;
                        if (productsSold[product.code]) {
                            productsSold[product.code].totalRevenue -= orderPremio;
                        }
                    }
                }
            }
            totalSubtotal += orderSubtotal;
            const orderTotal = orderSubtotal + orderDelivery - orderPremio;
            dailyBreakdown[orderDate].total += orderTotal;
            ordersByType[order.orderType] = (ordersByType[order.orderType] || 0) + 1;
            const ot = order.orderType;
            revenueByOrderType[ot] = (revenueByOrderType[ot] || 0) + orderTotal;
            const hour = parseInt((0, date_fns_tz_1.formatInTimeZone)(order.createdAt, 'America/Bogota', 'H'), 10);
            hourlyBreakdown[hour].orders += 1;
            hourlyBreakdown[hour].total += orderTotal;
            const bucketIndex = TICKET_BUCKETS.findIndex((max, i) => {
                const min = i === 0 ? 0 : TICKET_BUCKETS[i - 1];
                return orderTotal >= min && orderTotal < max;
            });
            if (bucketIndex >= 0 && bucketIndex < ticketDistribution.length) {
                ticketDistribution[bucketIndex].count += 1;
            }
        }
        const totalRevenue = totalSubtotal + totalDeliveryFees - totalPremioDiscounts;
        const totalOrders = orders.length;
        const dailyArray = Object.entries(dailyBreakdown)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({ date, ...data }));
        const productsArray = Object.values(productsSold).sort((a, b) => b.quantity - a.quantity);
        const byCategory = new Map();
        for (const p of productsArray) {
            const cid = p.categoryId ?? 0;
            const cat = byCategory.get(cid) ?? [];
            cat.push(p);
            byCategory.set(cid, cat);
        }
        const mostOrderedByCategory = Array.from(byCategory.entries())
            .filter(([cid]) => cid > 0)
            .map(([categoryId, prods]) => {
            const sorted = [...prods].sort((a, b) => b.quantity - a.quantity);
            const top = sorted[0];
            const catName = top.categoryName ?? 'Sin categoría';
            return { categoryId, categoryName: catName, topProduct: top };
        })
            .sort((a, b) => b.topProduct.quantity - a.topProduct.quantity);
        const hourlyArray = Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            hourLabel: `${h.toString().padStart(2, '0')}:00`,
            orders: hourlyBreakdown[h].orders,
            total: hourlyBreakdown[h].total,
        }));
        const bestDayByOrders = dailyArray.length
            ? dailyArray.reduce((best, d) => (d.orders >= best.orders ? d : best), dailyArray[0])
            : null;
        const bestDayByRevenue = dailyArray.length
            ? dailyArray.reduce((best, d) => (d.total >= best.total ? d : best), dailyArray[0])
            : null;
        const worstDayByOrders = dailyArray.length
            ? dailyArray.reduce((worst, d) => (d.orders <= worst.orders ? d : worst), dailyArray[0])
            : null;
        const worstDayByRevenue = dailyArray.length
            ? dailyArray.reduce((worst, d) => (d.total <= worst.total ? d : worst), dailyArray[0])
            : null;
        const averageTicketByOrderType = {};
        for (const [type, count] of Object.entries(ordersByType)) {
            const rev = revenueByOrderType[type] ?? 0;
            averageTicketByOrderType[type] = count > 0 ? rev / count : 0;
        }
        let previousPeriod = null;
        const fromDate = new Date(from + 'T12:00:00');
        const toDate = new Date(to + 'T12:00:00');
        const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        const prevEndDate = new Date(fromDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        const prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - diffDays + 1);
        const prevFrom = prevStartDate.toISOString().slice(0, 10);
        const prevTo = prevEndDate.toISOString().slice(0, 10);
        if (prevStartDate < prevEndDate && prevFrom >= MIN) {
            const { start: prevStartUtc } = (0, date_util_1.getBogotaDateRange)(prevFrom);
            const { end: prevEndUtc } = (0, date_util_1.getBogotaDateRange)(prevTo);
            const prevOrders = await this.orderRepo.find({
                where: {
                    createdAt: (0, typeorm_2.Between)(prevStartUtc, prevEndUtc),
                    orderStatus: (0, typeorm_2.Not)('canceled'),
                },
                relations: ['items', 'items.product', 'extras'],
            });
            let prevTotalRevenue = 0;
            for (const order of prevOrders) {
                let orderSubtotal = 0;
                let orderDelivery = 0;
                let orderPremio = 0;
                for (const item of order.items) {
                    if (item.product) {
                        const product = allProducts.find(p => p.id === item.product.id);
                        if (product)
                            orderSubtotal += Number(item.unitPrice ?? product.price);
                    }
                }
                for (const ex of order.extras ?? []) {
                    orderSubtotal += Number(ex.amount) * (ex.quantity ?? 1);
                }
                if (order.orderType === 'delivery' && order.deliveryFee)
                    orderDelivery = Number(order.deliveryFee);
                if (order.redemptionCode) {
                    const halfChickenItem = order.items.find(item => item.product && (item.product.code === 2 || item.product.code === 5));
                    if (halfChickenItem?.product) {
                        const product = allProducts.find(p => p.id === halfChickenItem.product.id);
                        if (product)
                            orderPremio = Number(halfChickenItem.unitPrice ?? product.price);
                    }
                }
                prevTotalRevenue += orderSubtotal + orderDelivery - orderPremio;
            }
            previousPeriod = {
                from: prevFrom,
                to: prevTo,
                totalOrders: prevOrders.length,
                total: prevTotalRevenue,
            };
        }
        return {
            period: { from, to },
            totalOrders,
            totalItemsSold,
            averageItemsPerOrder: totalOrders > 0 ? totalItemsSold / totalOrders : 0,
            ordersWithPremio,
            totals: {
                subtotal: totalSubtotal,
                deliveryFees: totalDeliveryFees,
                premioDiscounts: totalPremioDiscounts,
                total: totalRevenue,
            },
            averagePerOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            ordersByType,
            revenueByOrderType,
            averageTicketByOrderType,
            productsSold: productsArray,
            mostOrderedByCategory,
            dailyBreakdown: dailyArray,
            hourlyBreakdown: hourlyArray,
            ticketDistribution,
            bestDayByOrders: bestDayByOrders ? { date: bestDayByOrders.date, dayOfWeek: bestDayByOrders.dayOfWeek, orders: bestDayByOrders.orders, total: bestDayByOrders.total } : null,
            bestDayByRevenue: bestDayByRevenue ? { date: bestDayByRevenue.date, dayOfWeek: bestDayByRevenue.dayOfWeek, orders: bestDayByRevenue.orders, total: bestDayByRevenue.total } : null,
            worstDayByOrders: worstDayByOrders ? { date: worstDayByOrders.date, dayOfWeek: worstDayByOrders.dayOfWeek, orders: worstDayByOrders.orders, total: worstDayByOrders.total } : null,
            worstDayByRevenue: worstDayByRevenue ? { date: worstDayByRevenue.date, dayOfWeek: worstDayByRevenue.dayOfWeek, orders: worstDayByRevenue.orders, total: worstDayByRevenue.total } : null,
            previousPeriod,
        };
    }
    async getMonthlySalesSummary(year) {
        const MIN = OrdersService_1.ADMIN_STATS_MIN_DATE;
        if (year < 2026) {
            throw new common_1.BadRequestException('Las estadísticas están disponibles desde 2026');
        }
        const todayBogota = (0, date_fns_tz_1.formatInTimeZone)(new Date(), 'America/Bogota', 'yyyy-MM-dd');
        const yearEnd = `${year}-12-31`;
        const periodTo = todayBogota < yearEnd ? todayBogota : yearEnd;
        const periodFrom = year === 2026 ? MIN : `${year}-01-01`;
        if (periodFrom > periodTo) {
            return {
                year,
                statsMinDate: MIN,
                periodFrom,
                periodTo,
                months: [],
                monthsByRevenueDesc: [],
                yearTotalOrders: 0,
                yearTotalRevenue: 0,
            };
        }
        const { start: startUtc } = (0, date_util_1.getBogotaDateRange)(periodFrom);
        const { end: endUtc } = (0, date_util_1.getBogotaDateRange)(periodTo);
        const orders = await this.orderRepo.find({
            where: {
                createdAt: (0, typeorm_2.Between)(startUtc, endUtc),
                orderStatus: (0, typeorm_2.Not)('canceled'),
            },
            relations: ['items', 'items.product', 'extras'],
        });
        const allProducts = await this.productRepo.find({
            select: ['id', 'name', 'price', 'code'],
        });
        const MONTH_NAMES = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
        ];
        const byMonth = {};
        for (const order of orders) {
            const ym = (0, date_fns_tz_1.formatInTimeZone)(order.createdAt, 'America/Bogota', 'yyyy-MM');
            const m = parseInt(ym.slice(5, 7), 10);
            if (!byMonth[ym])
                byMonth[ym] = { orders: 0, totalRevenue: 0, monthNum: m };
            byMonth[ym].orders += 1;
            let orderSubtotal = 0;
            let orderDelivery = 0;
            let orderPremio = 0;
            for (const item of order.items) {
                if (!item.product)
                    continue;
                const product = allProducts.find((p) => p.id === item.product.id);
                if (product)
                    orderSubtotal += Number(item.unitPrice ?? product.price);
            }
            for (const ex of order.extras ?? []) {
                orderSubtotal += Number(ex.amount) * (ex.quantity ?? 1);
            }
            if (order.orderType === 'delivery' && order.deliveryFee) {
                orderDelivery = Number(order.deliveryFee);
            }
            if (order.redemptionCode) {
                const halfChickenItem = order.items.find((item) => item.product && (item.product.code === 2 || item.product.code === 5));
                if (halfChickenItem?.product) {
                    const product = allProducts.find((p) => p.id === halfChickenItem.product.id);
                    if (product)
                        orderPremio = Number(halfChickenItem.unitPrice ?? product.price);
                }
            }
            byMonth[ym].totalRevenue += orderSubtotal + orderDelivery - orderPremio;
        }
        const months = Object.entries(byMonth)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([monthKey, d]) => ({
            monthKey,
            label: `${MONTH_NAMES[d.monthNum - 1]} ${monthKey.slice(0, 4)}`,
            orders: d.orders,
            totalRevenue: d.totalRevenue,
        }));
        const monthsByRevenueDesc = [...months].sort((a, b) => b.totalRevenue - a.totalRevenue);
        const yearTotalOrders = months.reduce((s, m) => s + m.orders, 0);
        const yearTotalRevenue = months.reduce((s, m) => s + m.totalRevenue, 0);
        return {
            year,
            statsMinDate: MIN,
            periodFrom,
            periodTo,
            months,
            monthsByRevenueDesc,
            yearTotalOrders,
            yearTotalRevenue,
        };
    }
    async backfillUnitPrices() {
        const result = await this.dataSource.query(`UPDATE ppp_order_items oi
       INNER JOIN ppp_products p ON oi.product_id = p.id
       SET oi.unit_price = p.price
       WHERE oi.unit_price IS NULL`);
        const raw = result;
        const updated = typeof raw?.affectedRows === 'number' ? raw.affectedRows
            : typeof raw?.affected === 'number' ? raw.affected
                : typeof raw?.rowCount === 'number' ? raw.rowCount
                    : 0;
        return { updated };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(order_item_entity_1.OrderItem)),
    __param(2, (0, typeorm_1.InjectRepository)(order_item_attribute_entity_1.OrderItemAttribute)),
    __param(3, (0, typeorm_1.InjectRepository)(order_extra_entity_1.OrderExtra)),
    __param(4, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(5, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(8, (0, common_1.Inject)((0, common_1.forwardRef)(() => points_service_1.PointsService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        order_gateway_1.OrdersGateway,
        typeorm_2.DataSource,
        points_service_1.PointsService,
        products_service_1.ProductsService,
        mail_service_1.MailService,
        circuit_breaker_service_1.CircuitBreakerService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map