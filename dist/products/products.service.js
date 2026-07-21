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
var ProductsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const category_entity_1 = require("./entities/category.entity");
const product_entity_1 = require("./entities/product.entity");
const product_attribute_entity_1 = require("./entities/product-attribute.entity");
const product_variant_stock_entity_1 = require("./entities/product-variant-stock.entity");
const inventory_group_entity_1 = require("./entities/inventory-group.entity");
const inventory_group_item_entity_1 = require("./entities/inventory-group-item.entity");
const inventory_selection_entity_1 = require("./entities/inventory-selection.entity");
const inventory_selection_product_entity_1 = require("./entities/inventory-selection-product.entity");
const cache_service_1 = require("../common/cache/cache.service");
const circuit_breaker_service_1 = require("../common/circuit-breaker/circuit-breaker.service");
let ProductsService = ProductsService_1 = class ProductsService {
    productRepo;
    categoryRepo;
    attributeRepo;
    variantStockRepo;
    inventoryGroupRepo;
    inventoryGroupItemRepo;
    selectionRepo;
    selectionProductRepo;
    cache;
    circuitBreaker;
    CACHE_KEY_ALL = 'products:all';
    CACHE_KEY_CATEGORIES = 'products:categories';
    CACHE_KEY_GROUPED = 'products:grouped';
    CACHE_TTL = 45000;
    constructor(productRepo, categoryRepo, attributeRepo, variantStockRepo, inventoryGroupRepo, inventoryGroupItemRepo, selectionRepo, selectionProductRepo, cache, circuitBreaker) {
        this.productRepo = productRepo;
        this.categoryRepo = categoryRepo;
        this.attributeRepo = attributeRepo;
        this.variantStockRepo = variantStockRepo;
        this.inventoryGroupRepo = inventoryGroupRepo;
        this.inventoryGroupItemRepo = inventoryGroupItemRepo;
        this.selectionRepo = selectionRepo;
        this.selectionProductRepo = selectionProductRepo;
        this.cache = cache;
        this.circuitBreaker = circuitBreaker;
    }
    create(createProductDto) {
        this.cache.invalidate('products:');
        return 'This action adds a new product';
    }
    static buildProductTarget(p) {
        const attrs = p.hasAttributes === true && p.attributes?.length
            ? p.attributes.map((a) => ({ attributeName: a.attributeName, options: JSON.parse(a.options || '[]') }))
            : undefined;
        return {
            productId: p.id,
            productName: p.name,
            hasVariants: p.hasAttributes === true,
            ...(attrs?.length ? { attributes: attrs } : {}),
        };
    }
    async loadAlsoDeductFromForProductIds(productIds) {
        if (!productIds.length)
            return new Map();
        const groupItems = await this.inventoryGroupItemRepo.find({
            where: {
                productId: (0, typeorm_2.In)(productIds),
            },
            relations: ['selections', 'selections.products', 'selections.products.product', 'selections.products.product.attributes'],
        });
        const productLevel = groupItems.filter((gi) => (gi.attributeName == null || gi.attributeName === '') &&
            (gi.attributeValue == null || gi.attributeValue === ''));
        const result = new Map();
        const targetProductIds = new Set();
        for (const gi of productLevel) {
            if (gi.selections?.length) {
                for (const sel of gi.selections.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
                    const products = (sel.products ?? [])
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                        .map((sp) => sp.product)
                        .filter((p) => p != null);
                    if (products.length === 0)
                        continue;
                    products.forEach((p) => targetProductIds.add(p.id));
                    const arr = result.get(gi.productId) ?? [];
                    arr.push({
                        selectionName: sel.name,
                        products: products.map((p) => ProductsService_1.buildProductTarget(p)),
                    });
                    result.set(gi.productId, arr);
                }
            }
            else if (gi.alsoDeductProductId != null) {
                targetProductIds.add(gi.alsoDeductProductId);
            }
        }
        const legacyTargetIds = [...productLevel]
            .filter((gi) => !gi.selections?.length && gi.alsoDeductProductId != null)
            .map((gi) => gi.alsoDeductProductId);
        const legacyTargets = legacyTargetIds.length > 0
            ? await this.productRepo.find({
                where: { id: (0, typeorm_2.In)([...new Set(legacyTargetIds)]) },
                relations: ['attributes'],
            })
            : [];
        const legacyById = new Map(legacyTargets.map((t) => [t.id, t]));
        for (const gi of productLevel) {
            if (gi.selections?.length)
                continue;
            if (gi.alsoDeductProductId == null)
                continue;
            const target = legacyById.get(gi.alsoDeductProductId);
            if (!target)
                continue;
            const arr = result.get(gi.productId) ?? [];
            arr.push({
                selectionName: target.name,
                products: [ProductsService_1.buildProductTarget(target)],
            });
            result.set(gi.productId, arr);
        }
        const productsWithAlsoDeduct = await this.productRepo.find({
            where: { id: (0, typeorm_2.In)(productIds), alsoDeductProductId: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()) },
            relations: ['attributes'],
            select: ['id', 'alsoDeductProductId'],
        });
        const productLevelIds = new Set(productLevel.map((gi) => gi.productId));
        const targetIdsForProductLevel = [...new Set(productsWithAlsoDeduct.map((p) => p.alsoDeductProductId).filter((id) => id != null && id > 0))];
        const targetProducts = targetIdsForProductLevel.length > 0
            ? await this.productRepo.find({
                where: { id: (0, typeorm_2.In)(targetIdsForProductLevel) },
                relations: ['attributes'],
            })
            : [];
        const targetById = new Map(targetProducts.map((t) => [t.id, t]));
        for (const p of productsWithAlsoDeduct) {
            const tid = p.alsoDeductProductId;
            if (tid == null)
                continue;
            if (productLevelIds.has(p.id))
                continue;
            const target = targetById.get(tid);
            if (!target)
                continue;
            const arr = result.get(p.id) ?? [];
            arr.push({
                selectionName: target.name,
                products: [ProductsService_1.buildProductTarget(target)],
            });
            result.set(p.id, arr);
        }
        return result;
    }
    async findAll() {
        const cached = this.cache.get(this.CACHE_KEY_ALL);
        if (cached)
            return cached;
        const result = await this.circuitBreaker.execute(async () => {
            const products = await this.productRepo.find({
                where: { isActive: true },
                relations: ['categories', 'attributes'],
                order: { id: 'ASC' },
            });
            const productIds = products.map((p) => p.id);
            const alsoDeductMap = await this.loadAlsoDeductFromForProductIds(productIds);
            const transformed = products.map((product) => {
                const alsoDeductFrom = alsoDeductMap.get(product.id);
                return {
                    ...product,
                    attributes: product.attributes.map((attr) => ({
                        ...attr,
                        options: JSON.parse(attr.options),
                    })),
                    ...(alsoDeductFrom?.length ? { alsoDeductFrom } : {}),
                };
            });
            this.cache.set(this.CACHE_KEY_ALL, transformed, this.CACHE_TTL);
            return transformed;
        }, async () => {
            const stale = this.cache.get(this.CACHE_KEY_ALL);
            return stale || [];
        });
        return result || [];
    }
    async findAllCategories() {
        const cached = this.cache.get(this.CACHE_KEY_CATEGORIES);
        if (cached)
            return cached;
        const result = await this.circuitBreaker.execute(async () => {
            const categories = await this.categoryRepo.find({ order: { id: 'ASC' } });
            this.cache.set(this.CACHE_KEY_CATEGORIES, categories, this.CACHE_TTL);
            return categories;
        }, async () => {
            const stale = this.cache.get(this.CACHE_KEY_CATEGORIES);
            return stale || [];
        });
        return result || [];
    }
    async updateCategory(id, dto) {
        const category = await this.categoryRepo.findOne({ where: { id } });
        if (!category) {
            throw new common_1.NotFoundException(`Categoría con id ${id} no encontrada`);
        }
        if (dto.imageUrl !== undefined) {
            const trimmed = dto.imageUrl?.trim();
            category.imageUrl = trimmed || null;
        }
        const saved = await this.categoryRepo.save(category);
        this.cache.invalidate('products:');
        return saved;
    }
    async findProductsGroupedByCategory() {
        const cached = this.cache.get(this.CACHE_KEY_GROUPED);
        if (cached)
            return cached;
        const result = await this.circuitBreaker.execute(async () => {
            const categories = await this.categoryRepo.find({
                relations: ['products', 'products.attributes'],
                order: { id: 'ASC' },
            });
            const allProductIds = Array.from(new Set((categories || [])
                .flatMap((c) => c.products ?? [])
                .filter((p) => p != null && p.isActive !== false)
                .map((p) => p.id)));
            const alsoDeductMap = await this.loadAlsoDeductFromForProductIds(allProductIds);
            const transformed = categories
                .filter((category) => category != null)
                .map((category) => ({
                categoryId: category.id,
                categoryName: category.name,
                imageUrl: category.imageUrl,
                products: (category.products || [])
                    .filter((product) => product != null && product.isActive !== false)
                    .map((product) => {
                    const alsoDeductFrom = alsoDeductMap.get(product.id);
                    return {
                        id: product.id,
                        name: product.name,
                        description: product.description,
                        code: product.code,
                        price: product.price,
                        imageUrl: product.imageUrl,
                        hasAttributes: product.hasAttributes,
                        attributes: (product.attributes || [])
                            .filter((attr) => attr != null)
                            .map((attr) => ({
                            attributeName: attr.attributeName,
                            options: JSON.parse(attr.options || '[]'),
                        })),
                        ...(alsoDeductFrom?.length ? { alsoDeductFrom } : {}),
                    };
                }),
            }));
            this.cache.set(this.CACHE_KEY_GROUPED, transformed, this.CACHE_TTL);
            return transformed;
        }, async () => {
            const stale = this.cache.get(this.CACHE_KEY_GROUPED);
            return stale || [];
        });
        return result || [];
    }
    async findAllForAdmin() {
        const products = await this.productRepo.find({
            relations: ['categories', 'attributes', 'variantStocks'],
            order: { id: 'ASC' },
        });
        const productIds = products.map((p) => p.id);
        const groupItems = productIds.length
            ? await this.inventoryGroupItemRepo.find({
                where: { productId: (0, typeorm_2.In)(productIds) },
                relations: ['group'],
            })
            : [];
        const groupInfoType = {
            groupId: 0,
            groupName: '',
            groupStock: 0,
            baseUnits: 0,
            derivedStock: 0,
        };
        const groupByProductId = new Map();
        const groupByVariantKey = new Map();
        for (const gi of groupItems) {
            const stock = Number(gi.group?.stock) ?? 0;
            const base = Number(gi.baseUnits) ?? 0;
            const derived = base > 0 ? stock / base : 0;
            const info = {
                groupId: gi.groupId,
                groupName: gi.group?.name ?? '',
                groupStock: stock,
                baseUnits: base,
                derivedStock: Math.round(derived * 100) / 100,
            };
            const isProductLevel = (gi.attributeName == null || gi.attributeName === '') &&
                (gi.attributeValue == null || gi.attributeValue === '');
            if (isProductLevel) {
                groupByProductId.set(gi.productId, info);
            }
            else {
                groupByVariantKey.set(`${gi.productId}:${gi.attributeName}:${gi.attributeValue}`, info);
            }
        }
        return products.map((product) => {
            const groupInfo = groupByProductId.get(product.id);
            return {
                ...product,
                attributes: product.attributes.map((attr) => ({
                    ...attr,
                    options: JSON.parse(attr.options || '[]'),
                })),
                variantStocks: (product.variantStocks || []).map((vs) => {
                    const variantGroup = groupByVariantKey.get(`${product.id}:${vs.attributeName}:${vs.attributeValue}`);
                    return {
                        id: vs.id,
                        attributeName: vs.attributeName,
                        attributeValue: vs.attributeValue,
                        stock: vs.stock,
                        ...(variantGroup && { inventoryGroup: variantGroup }),
                    };
                }),
                ...(groupInfo && { inventoryGroup: groupInfo }),
            };
        });
    }
    async updateActive(id, isActive) {
        const product = await this.productRepo.findOne({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException(`No se encontró el producto con ID ${id}`);
        }
        product.isActive = isActive;
        await this.productRepo.save(product);
        this.cache.invalidate('products:');
        return { success: true, product: { id: product.id, isActive: product.isActive } };
    }
    async checkByCode(code) {
        const product = await this.productRepo.findOne({
            where: { code },
            select: ['id', 'name', 'isActive'],
        });
        if (!product) {
            return { exists: false };
        }
        return {
            exists: true,
            isActive: product.isActive !== false,
            name: product.name,
        };
    }
    async findOne(id) {
        const product = await this.productRepo.findOne({
            where: { id },
            relations: ['categories', 'attributes', 'variantStocks'],
        });
        if (!product) {
            return null;
        }
        const groupItems = await this.inventoryGroupItemRepo.find({
            where: { productId: id },
            relations: ['group'],
        });
        let inventoryGroup;
        const variantGroupByKey = new Map();
        for (const gi of groupItems) {
            const stock = Number(gi.group?.stock) ?? 0;
            const base = Number(gi.baseUnits) ?? 0;
            const derived = base > 0 ? stock / base : 0;
            const info = {
                groupId: gi.groupId,
                groupName: gi.group?.name ?? '',
                groupStock: stock,
                baseUnits: base,
                derivedStock: Math.round(derived * 100) / 100,
            };
            const isProductLevel = (gi.attributeName == null || gi.attributeName === '') &&
                (gi.attributeValue == null || gi.attributeValue === '');
            if (isProductLevel) {
                inventoryGroup = info;
            }
            else {
                variantGroupByKey.set(`${gi.attributeName}:${gi.attributeValue}`, info);
            }
        }
        return {
            ...product,
            attributes: product.attributes.map(attr => ({
                ...attr,
                options: JSON.parse(attr.options),
            })),
            variantStocks: (product.variantStocks || []).map((vs) => {
                const variantGroup = variantGroupByKey.get(`${vs.attributeName}:${vs.attributeValue}`);
                return {
                    id: vs.id,
                    attributeName: vs.attributeName,
                    attributeValue: vs.attributeValue,
                    stock: vs.stock,
                    ...(variantGroup && { inventoryGroup: variantGroup }),
                };
            }),
            ...(inventoryGroup && { inventoryGroup }),
        };
    }
    async update(id, updateProductDto) {
        const product = await this.productRepo.findOne({
            where: { id },
            relations: ['attributes', 'categories'],
        });
        if (!product) {
            throw new common_1.NotFoundException(`No se encontró el producto con ID ${id}`);
        }
        if (updateProductDto.name !== undefined) {
            product.name = updateProductDto.name;
        }
        if (updateProductDto.description !== undefined) {
            product.description = updateProductDto.description;
        }
        if (updateProductDto.price !== undefined) {
            product.price = updateProductDto.price;
        }
        if (updateProductDto.hasAttributes !== undefined) {
            product.hasAttributes = updateProductDto.hasAttributes;
        }
        if (updateProductDto.trackInventory !== undefined) {
            product.trackInventory = updateProductDto.trackInventory;
        }
        if (updateProductDto.stock !== undefined) {
            product.stock = Math.max(0, Math.floor(updateProductDto.stock));
        }
        if (updateProductDto.alsoDeductProductId !== undefined) {
            product.alsoDeductProductId = updateProductDto.alsoDeductProductId ?? null;
        }
        if (updateProductDto.alsoDeductAttributeName !== undefined) {
            product.alsoDeductAttributeName = updateProductDto.alsoDeductAttributeName?.trim() ?? null;
        }
        if (updateProductDto.alsoDeductAttributeValue !== undefined) {
            product.alsoDeductAttributeValue = updateProductDto.alsoDeductAttributeValue?.trim() ?? null;
        }
        if (updateProductDto.alsoDeductBaseUnits !== undefined) {
            product.alsoDeductBaseUnits = updateProductDto.alsoDeductBaseUnits != null && Number(updateProductDto.alsoDeductBaseUnits) >= 0 ? updateProductDto.alsoDeductBaseUnits : null;
        }
        if (updateProductDto.attributes !== undefined) {
            await this.attributeRepo
                .createQueryBuilder()
                .delete()
                .where('product_id = :id', { id })
                .execute();
            const newAttributes = updateProductDto.attributes.map(attrDto => {
                const attr = new product_attribute_entity_1.ProductAttribute();
                attr.attributeName = attrDto.attributeName;
                attr.options = JSON.stringify(attrDto.options);
                attr.product = product;
                return attr;
            });
            const savedAttributes = await this.attributeRepo.save(newAttributes);
            product.attributes = savedAttributes;
        }
        if (updateProductDto.categoryIds !== undefined) {
            if (updateProductDto.categoryIds.length > 0) {
                const categories = await this.categoryRepo.find({
                    where: { id: (0, typeorm_2.In)(updateProductDto.categoryIds) },
                });
                product.categories = categories;
            }
            else {
                product.categories = [];
            }
        }
        await this.productRepo.save(product);
        this.cache.invalidate('products:');
        if (updateProductDto.trackInventory !== undefined) {
            await this.syncGroupTrackInventory(id, updateProductDto.trackInventory);
        }
        if (updateProductDto.variantStocks !== undefined) {
            for (const vs of updateProductDto.variantStocks) {
                if (vs.trackStock === false) {
                    await this.variantStockRepo.delete({ productId: id, attributeName: vs.attributeName });
                }
                else if (vs.stocks && vs.stocks.length > 0) {
                    await this.setVariantStocks(id, vs.attributeName, vs.stocks);
                }
            }
            this.cache.invalidate('products:');
        }
        const updated = await this.productRepo.findOne({
            where: { id },
            relations: ['categories', 'attributes', 'variantStocks'],
        });
        if (!updated) {
            throw new common_1.NotFoundException(`No se encontró el producto con ID ${id}`);
        }
        return {
            ...updated,
            attributes: updated.attributes.map((attr) => ({
                ...attr,
                options: JSON.parse(attr.options),
            })),
            variantStocks: (updated.variantStocks || []).map((v) => ({
                id: v.id,
                attributeName: v.attributeName,
                attributeValue: v.attributeValue,
                stock: v.stock,
            })),
        };
    }
    async syncGroupTrackInventory(productId, trackInventory) {
        const groupItem = await this.inventoryGroupItemRepo.findOne({
            where: { productId },
            select: ['groupId'],
        });
        if (!groupItem)
            return;
        const allInGroup = await this.inventoryGroupItemRepo.find({
            where: { groupId: groupItem.groupId },
            select: ['productId'],
        });
        const ids = allInGroup.map((i) => i.productId);
        if (ids.length === 0)
            return;
        await this.productRepo.update({ id: (0, typeorm_2.In)(ids) }, { trackInventory });
        this.cache.invalidate('products:');
    }
    async adjustStock(id, delta) {
        const product = await this.productRepo.findOne({ where: { id }, select: ['id', 'stock', 'trackInventory'] });
        if (!product) {
            throw new common_1.NotFoundException(`No se encontró el producto con ID ${id}`);
        }
        const newStock = Math.max(0, product.stock + Math.floor(delta));
        product.stock = newStock;
        await this.productRepo.save(product);
        this.cache.invalidate('products:');
        return { success: true, stock: newStock };
    }
    async getInventoryByProductIds(productIds, opts) {
        if (!productIds.length)
            return new Map();
        let setIds = [...new Set(productIds)];
        const [groupItems, productLevelTargets] = await Promise.all([
            this.inventoryGroupItemRepo.find({
                where: { productId: (0, typeorm_2.In)(setIds) },
                relations: ['group', 'selections', 'selections.products'],
            }),
            opts?.includeAlsoDeductTargets
                ? this.productRepo.find({
                    where: { id: (0, typeorm_2.In)(setIds), alsoDeductProductId: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()) },
                    select: ['id', 'alsoDeductProductId'],
                })
                : Promise.resolve([]),
        ]);
        if (opts?.includeAlsoDeductTargets) {
            const extraIds = [
                ...groupItems.map((i) => i.alsoDeductProductId).filter((id) => id != null && id > 0),
                ...(groupItems.flatMap((i) => i.selections ?? []).flatMap((s) => (s.products ?? []).map((p) => p.productId))),
            ];
            const productLevelAlsoDeductIds = productLevelTargets
                .map((p) => p.alsoDeductProductId)
                .filter((id) => id != null && id > 0);
            setIds = [...new Set([...setIds, ...extraIds, ...productLevelAlsoDeductIds])];
        }
        const groupIds = [...new Set(groupItems.map((i) => i.groupId))];
        const [list, variantList, groups] = await Promise.all([
            this.productRepo.find({
                where: { id: (0, typeorm_2.In)(setIds) },
                relations: ['variantStocks'],
                select: ['id', 'trackInventory', 'stock', 'alsoDeductProductId', 'alsoDeductAttributeName', 'alsoDeductAttributeValue', 'alsoDeductBaseUnits'],
            }),
            this.variantStockRepo.find({
                where: { productId: (0, typeorm_2.In)(setIds) },
                select: ['productId', 'attributeName', 'attributeValue', 'stock'],
            }),
            groupIds.length
                ? this.inventoryGroupRepo.find({ where: { id: (0, typeorm_2.In)(groupIds) }, select: ['id', 'stock'] })
                : Promise.resolve([]),
        ]);
        const variantByProduct = new Map();
        for (const v of variantList) {
            const arr = variantByProduct.get(v.productId) ?? [];
            arr.push({
                attributeName: v.attributeName,
                attributeValue: v.attributeValue,
                stock: Number(v.stock) ?? 0,
            });
            variantByProduct.set(v.productId, arr);
        }
        const groupStockById = new Map(groups.map((g) => [g.id, Number(g.stock) ?? 0]));
        const productToGroup = new Map();
        const productVariantToGroup = new Map();
        const productAlsoDeduct = new Map();
        for (const gi of groupItems) {
            const key = `${gi.productId}:${gi.attributeName ?? ''}:${gi.attributeValue ?? ''}`;
            const entry = {
                groupId: gi.groupId,
                baseUnits: Number(gi.baseUnits) ?? 0,
                groupStock: groupStockById.get(gi.groupId) ?? 0,
            };
            const isProductLevel = (gi.attributeName == null || gi.attributeName === '') &&
                (gi.attributeValue == null || gi.attributeValue === '');
            if (isProductLevel) {
                productToGroup.set(gi.productId, entry);
                if (gi.selections?.length) {
                    for (const sel of gi.selections) {
                        for (const sp of sel.products ?? []) {
                            const arr = productAlsoDeduct.get(gi.productId) ?? [];
                            arr.push({
                                productId: sp.productId,
                                baseUnits: Number(sp.baseUnits) ?? 0,
                            });
                            productAlsoDeduct.set(gi.productId, arr);
                        }
                    }
                }
                else if (gi.alsoDeductProductId != null && Number(gi.alsoDeductBaseUnits) > 0) {
                    const arr = productAlsoDeduct.get(gi.productId) ?? [];
                    arr.push({
                        productId: gi.alsoDeductProductId,
                        baseUnits: Number(gi.alsoDeductBaseUnits) ?? 0,
                        ...(gi.alsoDeductAttributeName != null && gi.alsoDeductAttributeValue != null
                            ? { attributeName: gi.alsoDeductAttributeName, attributeValue: gi.alsoDeductAttributeValue }
                            : {}),
                    });
                    productAlsoDeduct.set(gi.productId, arr);
                }
            }
            else {
                productVariantToGroup.set(key, entry);
            }
        }
        for (const p of list) {
            const prod = p;
            if (productToGroup.has(prod.id))
                continue;
            if (prod.alsoDeductProductId == null || !(Number(prod.alsoDeductBaseUnits) > 0))
                continue;
            const arr = productAlsoDeduct.get(prod.id) ?? [];
            arr.push({
                productId: prod.alsoDeductProductId,
                baseUnits: Number(prod.alsoDeductBaseUnits) ?? 0,
                ...(prod.alsoDeductAttributeName != null && prod.alsoDeductAttributeValue != null
                    ? { attributeName: prod.alsoDeductAttributeName, attributeValue: prod.alsoDeductAttributeValue }
                    : {}),
            });
            productAlsoDeduct.set(prod.id, arr);
        }
        const map = new Map();
        for (const p of list) {
            const variantGroups = groupItems
                .filter((gi) => gi.productId === p.id &&
                gi.attributeName != null &&
                gi.attributeName !== '' &&
                gi.attributeValue != null &&
                gi.attributeValue !== '')
                .map((gi) => ({
                attributeName: gi.attributeName,
                attributeValue: gi.attributeValue,
                groupId: gi.groupId,
                groupBaseUnits: Number(gi.baseUnits) ?? 0,
                groupStock: groupStockById.get(gi.groupId) ?? 0,
            })) ?? undefined;
            const group = productToGroup.get(p.id);
            const alsoDeductFrom = productAlsoDeduct.get(p.id);
            if (group) {
                map.set(p.id, {
                    trackInventory: true,
                    stock: 0,
                    variantStocks: [],
                    groupId: group.groupId,
                    groupBaseUnits: group.baseUnits,
                    groupStock: group.groupStock,
                    ...(variantGroups?.length ? { variantGroups } : {}),
                    ...(alsoDeductFrom?.length ? { alsoDeductFrom } : {}),
                });
            }
            else {
                map.set(p.id, {
                    trackInventory: p.trackInventory === true,
                    stock: Number(p.stock) ?? 0,
                    variantStocks: variantByProduct.get(p.id) ?? [],
                    ...(variantGroups?.length ? { variantGroups } : {}),
                    ...(alsoDeductFrom?.length ? { alsoDeductFrom } : {}),
                });
            }
        }
        return map;
    }
    async decrementStock(manager, productId, quantity) {
        const product = await manager.findOne(product_entity_1.Product, { where: { id: productId }, select: ['id', 'trackInventory', 'stock'] });
        if (!product)
            return;
        if (!product.trackInventory)
            return;
        const current = Number(product.stock) ?? 0;
        if (current < quantity) {
            throw new common_1.BadRequestException(`Stock insuficiente para el producto ID ${productId}. Disponible: ${current}, solicitado: ${quantity}`);
        }
        await manager.decrement(product_entity_1.Product, { id: productId }, 'stock', quantity);
    }
    async incrementStock(manager, productId, quantity) {
        const product = await manager.findOne(product_entity_1.Product, { where: { id: productId }, select: ['id', 'trackInventory'] });
        if (!product || !product.trackInventory)
            return;
        await manager.increment(product_entity_1.Product, { id: productId }, 'stock', quantity);
    }
    async decrementGroupStock(manager, groupId, baseUnits) {
        if (baseUnits <= 0)
            return;
        const group = await manager.findOne(inventory_group_entity_1.InventoryGroup, { where: { id: groupId }, select: ['id', 'stock'] });
        if (!group)
            return;
        const current = Number(group.stock) ?? 0;
        if (current < baseUnits) {
            throw new common_1.BadRequestException(`Stock insuficiente en el grupo de inventario (ID ${groupId}). Disponible: ${current.toFixed(2)} unidades base, solicitado: ${baseUnits.toFixed(2)}`);
        }
        await manager.decrement(inventory_group_entity_1.InventoryGroup, { id: groupId }, 'stock', baseUnits);
    }
    async incrementGroupStock(manager, groupId, baseUnits) {
        if (baseUnits <= 0)
            return;
        const group = await manager.findOne(inventory_group_entity_1.InventoryGroup, { where: { id: groupId }, select: ['id'] });
        if (!group)
            return;
        await manager.increment(inventory_group_entity_1.InventoryGroup, { id: groupId }, 'stock', baseUnits);
    }
    async decrementVariantStock(manager, productId, attributeName, attributeValue, quantity) {
        const row = await manager.findOne(product_variant_stock_entity_1.ProductVariantStock, {
            where: { productId, attributeName, attributeValue },
            select: ['id', 'stock'],
        });
        if (!row)
            return;
        const current = Number(row.stock) ?? 0;
        if (current < quantity) {
            throw new common_1.BadRequestException(`Stock insuficiente para variante "${attributeName}: ${attributeValue}". Disponible: ${current}, solicitado: ${quantity}`);
        }
        await manager.decrement(product_variant_stock_entity_1.ProductVariantStock, { productId, attributeName, attributeValue }, 'stock', quantity);
    }
    async incrementVariantStock(manager, productId, attributeName, attributeValue, quantity) {
        const row = await manager.findOne(product_variant_stock_entity_1.ProductVariantStock, {
            where: { productId, attributeName, attributeValue },
            select: ['id'],
        });
        if (!row)
            return;
        await manager.increment(product_variant_stock_entity_1.ProductVariantStock, { productId, attributeName, attributeValue }, 'stock', quantity);
    }
    async adjustVariantStock(productId, attributeName, attributeValue, delta) {
        let row = await this.variantStockRepo.findOne({
            where: { productId, attributeName, attributeValue },
        });
        if (!row) {
            row = this.variantStockRepo.create({
                productId,
                attributeName,
                attributeValue,
                stock: 0,
            });
            await this.variantStockRepo.save(row);
        }
        const newStock = Math.max(0, (Number(row.stock) ?? 0) + Math.floor(delta));
        row.stock = newStock;
        await this.variantStockRepo.save(row);
        this.cache.invalidate('products:');
        return { success: true, stock: newStock };
    }
    async setVariantStocks(productId, attributeName, stocks) {
        await this.variantStockRepo.delete({ productId, attributeName });
        if (!stocks.length) {
            this.cache.invalidate('products:');
            return;
        }
        const entities = stocks.map((s) => this.variantStockRepo.create({
            productId,
            attributeName,
            attributeValue: s.attributeValue.trim(),
            stock: Math.max(0, Math.floor(s.stock)),
        }));
        await this.variantStockRepo.save(entities);
        this.cache.invalidate('products:');
    }
    remove(id) {
        this.cache.invalidate('products:');
        return `This action removes a #${id} product`;
    }
    async findAllInventoryGroups() {
        const groups = await this.inventoryGroupRepo.find({
            relations: ['items', 'items.product', 'items.selections', 'items.selections.products', 'items.selections.products.product'],
            order: { id: 'ASC' },
        });
        return groups.map((g) => ({
            id: g.id,
            name: g.name,
            stock: Number(g.stock) ?? 0,
            items: (g.items || []).map((i) => ({
                groupItemId: i.id,
                productId: i.productId,
                productCode: i.product?.code ?? 0,
                productName: i.product?.name ?? '',
                baseUnits: Number(i.baseUnits) ?? 0,
                attributeName: i.attributeName ?? '',
                attributeValue: i.attributeValue ?? '',
                alsoDeductProductId: i.alsoDeductProductId ?? null,
                alsoDeductAttributeName: i.alsoDeductAttributeName ?? null,
                alsoDeductAttributeValue: i.alsoDeductAttributeValue ?? null,
                alsoDeductBaseUnits: i.alsoDeductBaseUnits != null ? Number(i.alsoDeductBaseUnits) : null,
                selections: (i.selections ?? [])
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    .map((s) => ({
                    id: s.id,
                    name: s.name,
                    sortOrder: s.sortOrder ?? 0,
                    products: (s.products ?? [])
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                        .map((sp) => ({
                        productId: sp.productId,
                        productName: sp.product?.name ?? '',
                        baseUnits: Number(sp.baseUnits) ?? 0,
                        sortOrder: sp.sortOrder ?? 0,
                    })),
                })),
            })),
        }));
    }
    async setGroupItemAlsoDeduct(groupId, productId, attributeName, attributeValue, alsoDeduct) {
        const an = attributeName?.trim() ?? '';
        const av = attributeValue?.trim() ?? '';
        const item = await this.inventoryGroupItemRepo.findOne({
            where: { groupId, productId, attributeName: an, attributeValue: av },
        });
        if (!item)
            throw new common_1.NotFoundException('No se encontró el ítem en el grupo');
        item.alsoDeductProductId = alsoDeduct?.productId ?? null;
        item.alsoDeductAttributeName = alsoDeduct?.attributeName?.trim() ?? null;
        item.alsoDeductAttributeValue = alsoDeduct?.attributeValue?.trim() ?? null;
        item.alsoDeductBaseUnits = alsoDeduct?.baseUnits ?? null;
        await this.inventoryGroupItemRepo.save(item);
        this.cache.invalidate('products:');
    }
    async createInventoryGroup(name) {
        const group = this.inventoryGroupRepo.create({ name: name.trim(), stock: 0 });
        return this.inventoryGroupRepo.save(group);
    }
    async updateInventoryGroup(id, name) {
        await this.inventoryGroupRepo.update({ id }, { name: name.trim() });
        this.cache.invalidate('products:');
    }
    async deleteInventoryGroup(id) {
        await this.inventoryGroupRepo.delete({ id });
        this.cache.invalidate('products:');
    }
    async addInventoryGroupItem(groupId, productId, baseUnits, attributeName, attributeValue) {
        const group = await this.inventoryGroupRepo.findOne({ where: { id: groupId } });
        if (!group)
            throw new common_1.NotFoundException('Grupo no encontrado');
        const product = await this.productRepo.findOne({ where: { id: productId } });
        if (!product)
            throw new common_1.NotFoundException('Producto no encontrado');
        const an = attributeName?.trim() ?? '';
        const av = attributeValue?.trim() ?? '';
        const existing = await this.inventoryGroupItemRepo.findOne({
            where: { groupId, productId, attributeName: an, attributeValue: av },
        });
        if (existing) {
            if (an || av)
                throw new common_1.BadRequestException('Esa variante ya está en este grupo');
            throw new common_1.BadRequestException('El producto ya está en este grupo');
        }
        const item = this.inventoryGroupItemRepo.create({
            groupId,
            productId,
            attributeName: an,
            attributeValue: av,
            baseUnits: Math.max(0, Number(baseUnits)),
        });
        const saved = await this.inventoryGroupItemRepo.save(item);
        this.cache.invalidate('products:');
        await this.syncGroupTrackInventory(productId, true);
        return saved;
    }
    async removeInventoryGroupItem(groupId, productId, attributeName, attributeValue) {
        const an = attributeName?.trim() ?? '';
        const av = attributeValue?.trim() ?? '';
        await this.inventoryGroupItemRepo.delete({
            groupId,
            productId,
            attributeName: an,
            attributeValue: av,
        });
        this.cache.invalidate('products:');
    }
    async adjustGroupStock(groupId, delta) {
        const group = await this.inventoryGroupRepo.findOne({ where: { id: groupId } });
        if (!group)
            throw new common_1.NotFoundException('Grupo no encontrado');
        const current = Number(group.stock) ?? 0;
        const newStock = Math.max(0, current + Number(delta));
        group.stock = newStock;
        await this.inventoryGroupRepo.save(group);
        this.cache.invalidate('products:');
        return { success: true, stock: newStock };
    }
    async createSelection(groupId, productId, name, attributeName, attributeValue) {
        const an = attributeName?.trim() ?? '';
        const av = attributeValue?.trim() ?? '';
        const item = await this.inventoryGroupItemRepo.findOne({
            where: { groupId, productId, attributeName: an, attributeValue: av },
        });
        if (!item)
            throw new common_1.NotFoundException('No se encontró el ítem en el grupo');
        const selection = this.selectionRepo.create({
            groupItemId: item.id,
            name: name.trim(),
            sortOrder: 0,
        });
        const saved = await this.selectionRepo.save(selection);
        this.cache.invalidate('products:');
        return saved;
    }
    async updateSelection(selectionId, name) {
        const sel = await this.selectionRepo.findOne({ where: { id: selectionId } });
        if (!sel)
            throw new common_1.NotFoundException('Selección no encontrada');
        sel.name = name.trim();
        await this.selectionRepo.save(sel);
        this.cache.invalidate('products:');
    }
    async deleteSelection(selectionId) {
        await this.selectionRepo.delete({ id: selectionId });
        this.cache.invalidate('products:');
    }
    async addProductToSelection(selectionId, productId, baseUnits = 0, sortOrder = 0) {
        const sel = await this.selectionRepo.findOne({ where: { id: selectionId } });
        if (!sel)
            throw new common_1.NotFoundException('Selección no encontrada');
        const product = await this.productRepo.findOne({ where: { id: productId } });
        if (!product)
            throw new common_1.NotFoundException('Producto no encontrado');
        const existing = await this.selectionProductRepo.findOne({
            where: { selectionId, productId },
        });
        if (existing)
            throw new common_1.BadRequestException('El producto ya está en esta selección');
        const sp = this.selectionProductRepo.create({
            selectionId,
            productId,
            baseUnits: Math.max(0, Number(baseUnits)),
            sortOrder: Number(sortOrder),
        });
        const saved = await this.selectionProductRepo.save(sp);
        this.cache.invalidate('products:');
        return saved;
    }
    async removeProductFromSelection(selectionId, productId) {
        await this.selectionProductRepo.delete({ selectionId, productId });
        this.cache.invalidate('products:');
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = ProductsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(1, (0, typeorm_1.InjectRepository)(category_entity_1.Category)),
    __param(2, (0, typeorm_1.InjectRepository)(product_attribute_entity_1.ProductAttribute)),
    __param(3, (0, typeorm_1.InjectRepository)(product_variant_stock_entity_1.ProductVariantStock)),
    __param(4, (0, typeorm_1.InjectRepository)(inventory_group_entity_1.InventoryGroup)),
    __param(5, (0, typeorm_1.InjectRepository)(inventory_group_item_entity_1.InventoryGroupItem)),
    __param(6, (0, typeorm_1.InjectRepository)(inventory_selection_entity_1.InventorySelection)),
    __param(7, (0, typeorm_1.InjectRepository)(inventory_selection_product_entity_1.InventorySelectionProduct)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        cache_service_1.CacheService,
        circuit_breaker_service_1.CircuitBreakerService])
], ProductsService);
//# sourceMappingURL=products.service.js.map