import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, In, Not, IsNull } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { ProductVariantStock } from './entities/product-variant-stock.entity';
import { InventoryGroup } from './entities/inventory-group.entity';
import { InventoryGroupItem } from './entities/inventory-group-item.entity';
import { InventorySelection } from './entities/inventory-selection.entity';
import { InventorySelectionProduct } from './entities/inventory-selection-product.entity';
import { CacheService } from '../common/cache/cache.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';

export type InventoryInfo = {
  trackInventory: boolean;
  stock: number;
  variantStocks: Array<{ attributeName: string; attributeValue: string; stock: number }>;
  /** Si el producto pertenece a un grupo de inventario (pool en unidades base) a nivel producto. */
  groupId?: number;
  groupBaseUnits?: number;
  groupStock?: number;
  /** Variantes de este producto que pertenecen a un grupo (descuento por variante específica). */
  variantGroups?: Array<{
    attributeName: string;
    attributeValue: string;
    groupId: number;
    groupBaseUnits: number;
    groupStock: number;
  }>;
  /** Si este producto está en un grupo y al venderlo también descontar de otro producto; la variante se toma del ítem de la orden (ej. producto 28, variante elegida en la orden). */
  alsoDeductFrom?: Array<{
    productId: number;
    baseUnits: number;
    /** Si viene en la config (legacy): variante fija; si no, la variante se toma del ítem de la orden con este productId. */
    attributeName?: string;
    attributeValue?: string;
  }>;
};

@Injectable()
export class ProductsService {
  private readonly CACHE_KEY_ALL = 'products:all';
  private readonly CACHE_KEY_CATEGORIES = 'products:categories';
  private readonly CACHE_KEY_GROUPED = 'products:grouped';
  private readonly CACHE_TTL = 45000; // 45s

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(ProductAttribute)
    private readonly attributeRepo: Repository<ProductAttribute>,

    @InjectRepository(ProductVariantStock)
    private readonly variantStockRepo: Repository<ProductVariantStock>,

    @InjectRepository(InventoryGroup)
    private readonly inventoryGroupRepo: Repository<InventoryGroup>,

    @InjectRepository(InventoryGroupItem)
    private readonly inventoryGroupItemRepo: Repository<InventoryGroupItem>,

    @InjectRepository(InventorySelection)
    private readonly selectionRepo: Repository<InventorySelection>,

    @InjectRepository(InventorySelectionProduct)
    private readonly selectionProductRepo: Repository<InventorySelectionProduct>,

    private readonly cache: CacheService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /**
   * Create a new product.
   * Currently returns a placeholder message.
   *
   * @param createProductDto - DTO containing product creation data.
   * @returns {string} Confirmation message.
   */
  create(createProductDto: CreateProductDto) {
    this.cache.invalidate('products:');
    return 'This action adds a new product';
  }

  /** Tipo de una selección para la API pública: nombre + lista de productos (ej. "Bebida" → 28, 37). */
  private static buildProductTarget(p: { id: number; name: string; hasAttributes: boolean; attributes?: { attributeName: string; options: string }[] }) {
    const attrs =
      p.hasAttributes === true && p.attributes?.length
        ? p.attributes.map((a) => ({ attributeName: a.attributeName, options: JSON.parse(a.options || '[]') as string[] }))
        : undefined;
    return {
      productId: p.id,
      productName: p.name,
      hasVariants: p.hasAttributes === true,
      ...(attrs?.length ? { attributes: attrs } : {}),
    };
  }

  /**
   * Load "also deduct from" as named selections for public API. Each selection has a name (e.g. "Bebida")
   * and multiple products (28, 37); front shows one dropdown per selection with options from all products.
   */
  private async loadAlsoDeductFromForProductIds(
    productIds: number[],
  ): Promise<
    Map<
      number,
      Array<{
        selectionName: string;
        products: Array<{
          productId: number;
          productName: string;
          hasVariants: boolean;
          attributes?: Array<{ attributeName: string; options: string[] }>;
        }>;
      }>
    >
  > {
    if (!productIds.length) return new Map();
    const groupItems = await this.inventoryGroupItemRepo.find({
      where: {
        productId: In(productIds),
      },
      relations: ['selections', 'selections.products', 'selections.products.product', 'selections.products.product.attributes'],
    });
    const productLevel = groupItems.filter(
      (gi) =>
        (gi.attributeName == null || gi.attributeName === '') &&
        (gi.attributeValue == null || gi.attributeValue === ''),
    );
    const result = new Map<
      number,
      Array<{
        selectionName: string;
        products: Array<{
          productId: number;
          productName: string;
          hasVariants: boolean;
          attributes?: Array<{ attributeName: string; options: string[] }>;
        }>;
      }>
    >();
    const targetProductIds = new Set<number>();
    for (const gi of productLevel) {
      if (gi.selections?.length) {
        for (const sel of gi.selections.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
          const products = (sel.products ?? [])
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((sp) => sp.product)
            .filter((p): p is NonNullable<typeof p> => p != null);
          if (products.length === 0) continue;
          products.forEach((p) => targetProductIds.add(p.id));
          const arr = result.get(gi.productId) ?? [];
          arr.push({
            selectionName: sel.name,
            products: products.map((p) => ProductsService.buildProductTarget(p)),
          });
          result.set(gi.productId, arr);
        }
      } else if (gi.alsoDeductProductId != null) {
        targetProductIds.add(gi.alsoDeductProductId);
      }
    }
    const legacyTargetIds = [...productLevel]
      .filter((gi) => !gi.selections?.length && gi.alsoDeductProductId != null)
      .map((gi) => gi.alsoDeductProductId!);
    const legacyTargets =
      legacyTargetIds.length > 0
        ? await this.productRepo.find({
            where: { id: In([...new Set(legacyTargetIds)]) },
            relations: ['attributes'],
          })
        : [];
    const legacyById = new Map(legacyTargets.map((t) => [t.id, t]));
    for (const gi of productLevel) {
      if (gi.selections?.length) continue;
      if (gi.alsoDeductProductId == null) continue;
      const target = legacyById.get(gi.alsoDeductProductId);
      if (!target) continue;
      const arr = result.get(gi.productId) ?? [];
      arr.push({
        selectionName: target.name,
        products: [ProductsService.buildProductTarget(target)],
      });
      result.set(gi.productId, arr);
    }

    // Productos individuales (no en grupo): también descontar de otro producto
    const productsWithAlsoDeduct = await this.productRepo.find({
      where: { id: In(productIds), alsoDeductProductId: Not(IsNull()) },
      relations: ['attributes'],
      select: ['id', 'alsoDeductProductId'],
    });
    const productLevelIds = new Set(productLevel.map((gi) => gi.productId));
    const targetIdsForProductLevel = [...new Set(productsWithAlsoDeduct.map((p) => p.alsoDeductProductId).filter((id): id is number => id != null && id > 0))];
    const targetProducts =
      targetIdsForProductLevel.length > 0
        ? await this.productRepo.find({
            where: { id: In(targetIdsForProductLevel) },
            relations: ['attributes'],
          })
        : [];
    const targetById = new Map(targetProducts.map((t) => [t.id, t]));
    for (const p of productsWithAlsoDeduct) {
      const tid = p.alsoDeductProductId;
      if (tid == null) continue;
      if (productLevelIds.has(p.id)) continue;
      const target = targetById.get(tid);
      if (!target) continue;
      const arr = result.get(p.id) ?? [];
      arr.push({
        selectionName: target.name,
        products: [ProductsService.buildProductTarget(target)],
      });
      result.set(p.id, arr);
    }
    return result;
  }

  async findAll() {
    const cached = this.cache.get<any[]>(this.CACHE_KEY_ALL);
    if (cached) return cached;

    const result = await this.circuitBreaker.execute(
      async () => {
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
      },
      async () => {
        const stale = this.cache.get<any[]>(this.CACHE_KEY_ALL);
        return stale || [];
      },
    );

    return result || [];
  }

  async findAllCategories() {
    const cached = this.cache.get<Category[]>(this.CACHE_KEY_CATEGORIES);
    if (cached) return cached;

    const result = await this.circuitBreaker.execute(
      async () => {
        const categories = await this.categoryRepo.find({ order: { id: 'ASC' } });
        this.cache.set(this.CACHE_KEY_CATEGORIES, categories, this.CACHE_TTL);
        return categories;
      },
      async () => {
        const stale = this.cache.get<Category[]>(this.CACHE_KEY_CATEGORIES);
        return stale || [];
      },
    );

    return result || [];
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
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
    const cached = this.cache.get<any[]>(this.CACHE_KEY_GROUPED);
    if (cached) return cached;

    const result = await this.circuitBreaker.execute(
      async () => {
        const categories = await this.categoryRepo.find({
          relations: ['products', 'products.attributes'],
          order: { id: 'ASC' },
        });
        const allProductIds = Array.from(
          new Set(
            (categories || [])
              .flatMap((c) => c.products ?? [])
              .filter((p) => p != null && p.isActive !== false)
              .map((p) => p.id),
          ),
        );
        const alsoDeductMap = await this.loadAlsoDeductFromForProductIds(allProductIds);
        const transformed = categories
          .filter((category) => category != null) // Filter out null categories
          .map((category) => ({
            categoryId: category.id,
            categoryName: category.name,
            imageUrl: category.imageUrl,
            products: (category.products || [])
              .filter((product) => product != null && product.isActive !== false) // Only active products
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
                    .filter((attr) => attr != null) // Filter out null attributes
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
      },
      async () => {
        const stale = this.cache.get<any[]>(this.CACHE_KEY_GROUPED);
        return stale || [];
      },
    );

    return result || [];
  }

  /**
   * Find a single product by ID with its categories and attributes.
   * - Loads relations: categories, attributes
   * - Transforms attribute.options from string → JSON array
   *
   * @param id - Product ID.
   * @returns {Promise<any>} Product with transformed attributes.
   */
  /**
   * Returns all products including inactive (for admin). Includes variantStocks and, if in an inventory group, group info with derivedStock (groupStock / baseUnits).
   */
  async findAllForAdmin() {
    const products = await this.productRepo.find({
      relations: ['categories', 'attributes', 'variantStocks'],
      order: { id: 'ASC' },
    });
    const productIds = products.map((p) => p.id);
    const groupItems = productIds.length
      ? await this.inventoryGroupItemRepo.find({
          where: { productId: In(productIds) },
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
    type GroupInfo = typeof groupInfoType;
    const groupByProductId = new Map<number, GroupInfo>();
    const groupByVariantKey = new Map<string, GroupInfo>();
    for (const gi of groupItems) {
      const stock = Number(gi.group?.stock) ?? 0;
      const base = Number(gi.baseUnits) ?? 0;
      const derived = base > 0 ? stock / base : 0;
      const info: GroupInfo = {
        groupId: gi.groupId,
        groupName: gi.group?.name ?? '',
        groupStock: stock,
        baseUnits: base,
        derivedStock: Math.round(derived * 100) / 100,
      };
      const isProductLevel =
        (gi.attributeName == null || gi.attributeName === '') &&
        (gi.attributeValue == null || gi.attributeValue === '');
      if (isProductLevel) {
        groupByProductId.set(gi.productId, info);
      } else {
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
          const variantGroup = groupByVariantKey.get(
            `${product.id}:${vs.attributeName}:${vs.attributeValue}`,
          );
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

  /**
   * Set product active/inactive (admin). Invalidates product caches.
   */
  async updateActive(id: number, isActive: boolean) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`No se encontró el producto con ID ${id}`);
    }
    product.isActive = isActive;
    await this.productRepo.save(product);
    this.cache.invalidate('products:');
    return { success: true, product: { id: product.id, isActive: product.isActive } };
  }

  /**
   * Check if a product exists by code and whether it is active.
   * Used by order/mesas apps when adding by code to show "producto desactivado" when applicable.
   */
  async checkByCode(code: number): Promise<{ exists: boolean; isActive?: boolean; name?: string }> {
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

  async findOne(id: number) {
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
    let inventoryGroup: { groupId: number; groupName: string; groupStock: number; baseUnits: number; derivedStock: number } | undefined;
    const variantGroupByKey = new Map<string, typeof inventoryGroup>();
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
      const isProductLevel =
        (gi.attributeName == null || gi.attributeName === '') &&
        (gi.attributeValue == null || gi.attributeValue === '');
      if (isProductLevel) {
        inventoryGroup = info;
      } else {
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

  /**
   * Update product by ID.
   * Updates product fields (name, description, price, hasAttributes) and attributes.
   * 
   * @param id - Product ID.
   * @param updateProductDto - DTO with update data.
   * @returns {Promise<Product>} Updated product with transformed attributes.
   */
  async update(id: number, updateProductDto: UpdateProductDto) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['attributes', 'categories'],
    });

    if (!product) {
      throw new NotFoundException(`No se encontró el producto con ID ${id}`);
    }

    // Update basic fields
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

    // Update attributes if provided
    if (updateProductDto.attributes !== undefined) {
      // Remove all existing attributes (so we don't duplicate when saving product)
      await this.attributeRepo
        .createQueryBuilder()
        .delete()
        .where('product_id = :id', { id })
        .execute();

      // Create and save new attributes
      const newAttributes = updateProductDto.attributes.map(attrDto => {
        const attr = new ProductAttribute();
        attr.attributeName = attrDto.attributeName;
        attr.options = JSON.stringify(attrDto.options);
        attr.product = product;
        return attr;
      });

      const savedAttributes = await this.attributeRepo.save(newAttributes);
      // Replace in-memory relation so cascade on product.save doesn't re-persist old (deleted) attributes
      product.attributes = savedAttributes;
    }

    // Update categories if provided
    if (updateProductDto.categoryIds !== undefined) {
      if (updateProductDto.categoryIds.length > 0) {
        const categories = await this.categoryRepo.find({
          where: { id: In(updateProductDto.categoryIds) },
        });
        product.categories = categories;
      } else {
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
        } else if (vs.stocks && vs.stocks.length > 0) {
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
      throw new NotFoundException(`No se encontró el producto con ID ${id}`);
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

  /**
   * When a product belongs to an inventory group, activating/deactivating trackInventory applies to all products in the group.
   */
  private async syncGroupTrackInventory(productId: number, trackInventory: boolean): Promise<void> {
    const groupItem = await this.inventoryGroupItemRepo.findOne({
      where: { productId },
      select: ['groupId'],
    });
    if (!groupItem) return;
    const allInGroup = await this.inventoryGroupItemRepo.find({
      where: { groupId: groupItem.groupId },
      select: ['productId'],
    });
    const ids = allInGroup.map((i) => i.productId);
    if (ids.length === 0) return;
    await this.productRepo.update({ id: In(ids) }, { trackInventory });
    this.cache.invalidate('products:');
  }

  /**
   * Adjust stock by delta (admin). delta can be positive (add) or negative (subtract).
   * Does not allow stock to go below zero when subtracting.
   */
  async adjustStock(id: number, delta: number): Promise<{ success: boolean; stock: number }> {
    const product = await this.productRepo.findOne({ where: { id }, select: ['id', 'stock', 'trackInventory'] });
    if (!product) {
      throw new NotFoundException(`No se encontró el producto con ID ${id}`);
    }
    const newStock = Math.max(0, product.stock + Math.floor(delta));
    product.stock = newStock;
    await this.productRepo.save(product);
    this.cache.invalidate('products:');
    return { success: true, stock: newStock };
  }

  /**
   * Get inventory info for given product IDs. Includes product stock, variant stocks, or group (pool) when product belongs to an inventory group.
   * If includeAlsoDeductTargets, also loads inventory for products that are targets of "also deduct" (so validation has variant stock).
   */
  async getInventoryByProductIds(
    productIds: number[],
    opts?: { includeAlsoDeductTargets?: boolean },
  ): Promise<Map<number, InventoryInfo>> {
    if (!productIds.length) return new Map();
    let setIds = [...new Set(productIds)];
    // Tanda 1 en paralelo (independientes entre sí): items de grupo + targets alsoDeduct
    const [groupItems, productLevelTargets] = await Promise.all([
      this.inventoryGroupItemRepo.find({
        where: { productId: In(setIds) },
        relations: ['group', 'selections', 'selections.products'],
      }),
      opts?.includeAlsoDeductTargets
        ? this.productRepo.find({
            where: { id: In(setIds), alsoDeductProductId: Not(IsNull()) },
            select: ['id', 'alsoDeductProductId'],
          })
        : Promise.resolve([]),
    ]);
    if (opts?.includeAlsoDeductTargets) {
      const extraIds = [
        ...groupItems.map((i) => i.alsoDeductProductId).filter((id): id is number => id != null && id > 0),
        ...(groupItems.flatMap((i) => i.selections ?? []).flatMap((s) => (s.products ?? []).map((p) => p.productId))),
      ];
      const productLevelAlsoDeductIds = productLevelTargets
        .map((p) => p.alsoDeductProductId)
        .filter((id): id is number => id != null && id > 0);
      setIds = [...new Set([...setIds, ...extraIds, ...productLevelAlsoDeductIds])];
    }
    // Tanda 2 en paralelo: productos, stock por variante y stock de grupos
    const groupIds = [...new Set(groupItems.map((i) => i.groupId))];
    const [list, variantList, groups] = await Promise.all([
      this.productRepo.find({
        where: { id: In(setIds) },
        relations: ['variantStocks'],
        select: ['id', 'trackInventory', 'stock', 'alsoDeductProductId', 'alsoDeductAttributeName', 'alsoDeductAttributeValue', 'alsoDeductBaseUnits'],
      }),
      this.variantStockRepo.find({
        where: { productId: In(setIds) },
        select: ['productId', 'attributeName', 'attributeValue', 'stock'],
      }),
      groupIds.length
        ? this.inventoryGroupRepo.find({ where: { id: In(groupIds) }, select: ['id', 'stock'] })
        : Promise.resolve([]),
    ]);
    const variantByProduct = new Map<number, Array<{ attributeName: string; attributeValue: string; stock: number }>>();
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
    const productToGroup = new Map<
      number,
      { groupId: number; baseUnits: number; groupStock: number }
    >();
    const productVariantToGroup = new Map<
      string,
      { groupId: number; baseUnits: number; groupStock: number }
    >();
    const productAlsoDeduct = new Map<
      number,
      Array<{ productId: number; baseUnits: number; attributeName?: string; attributeValue?: string }>
    >();
    for (const gi of groupItems) {
      const key = `${gi.productId}:${gi.attributeName ?? ''}:${gi.attributeValue ?? ''}`;
      const entry = {
        groupId: gi.groupId,
        baseUnits: Number(gi.baseUnits) ?? 0,
        groupStock: groupStockById.get(gi.groupId) ?? 0,
      };
      const isProductLevel =
        (gi.attributeName == null || gi.attributeName === '') &&
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
        } else if (gi.alsoDeductProductId != null && Number(gi.alsoDeductBaseUnits) > 0) {
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
      } else {
        productVariantToGroup.set(key, entry);
      }
    }

    for (const p of list) {
      const prod = p as Product & { alsoDeductProductId?: number | null; alsoDeductBaseUnits?: number | null; alsoDeductAttributeName?: string | null; alsoDeductAttributeValue?: string | null };
      if (productToGroup.has(prod.id)) continue;
      if (prod.alsoDeductProductId == null || !(Number(prod.alsoDeductBaseUnits) > 0)) continue;
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

    const map = new Map<number, InventoryInfo>();
    for (const p of list) {
      const variantGroups =
        (groupItems
          .filter(
            (gi) =>
              gi.productId === p.id &&
              gi.attributeName != null &&
              gi.attributeName !== '' &&
              gi.attributeValue != null &&
              gi.attributeValue !== '',
          )
          .map((gi) => ({
            attributeName: gi.attributeName!,
            attributeValue: gi.attributeValue!,
            groupId: gi.groupId,
            groupBaseUnits: Number(gi.baseUnits) ?? 0,
            groupStock: groupStockById.get(gi.groupId) ?? 0,
          })) as InventoryInfo['variantGroups']) ?? undefined;
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
      } else {
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

  /**
   * Decrement stock within a transaction (used by orders). Throws if insufficient stock.
   */
  async decrementStock(manager: EntityManager, productId: number, quantity: number): Promise<void> {
    const product = await manager.findOne(Product, { where: { id: productId }, select: ['id', 'trackInventory', 'stock'] });
    if (!product) return;
    if (!product.trackInventory) return;
    const current = Number(product.stock) ?? 0;
    if (current < quantity) {
      throw new BadRequestException(
        `Stock insuficiente para el producto ID ${productId}. Disponible: ${current}, solicitado: ${quantity}`,
      );
    }
    await manager.decrement(Product, { id: productId }, 'stock', quantity);
  }

  /**
   * Increment stock within a transaction (restore when order items are removed).
   */
  async incrementStock(manager: EntityManager, productId: number, quantity: number): Promise<void> {
    const product = await manager.findOne(Product, { where: { id: productId }, select: ['id', 'trackInventory'] });
    if (!product || !product.trackInventory) return;
    await manager.increment(Product, { id: productId }, 'stock', quantity);
  }

  /**
   * Decrement group stock (pool) in base units. Throws if insufficient.
   */
  async decrementGroupStock(manager: EntityManager, groupId: number, baseUnits: number): Promise<void> {
    if (baseUnits <= 0) return;
    const group = await manager.findOne(InventoryGroup, { where: { id: groupId }, select: ['id', 'stock'] });
    if (!group) return;
    const current = Number(group.stock) ?? 0;
    if (current < baseUnits) {
      throw new BadRequestException(
        `Stock insuficiente en el grupo de inventario (ID ${groupId}). Disponible: ${current.toFixed(2)} unidades base, solicitado: ${baseUnits.toFixed(2)}`,
      );
    }
    await manager.decrement(InventoryGroup, { id: groupId }, 'stock', baseUnits);
  }

  /**
   * Increment group stock (restore when order items are removed).
   */
  async incrementGroupStock(manager: EntityManager, groupId: number, baseUnits: number): Promise<void> {
    if (baseUnits <= 0) return;
    const group = await manager.findOne(InventoryGroup, { where: { id: groupId }, select: ['id'] });
    if (!group) return;
    await manager.increment(InventoryGroup, { id: groupId }, 'stock', baseUnits);
  }

  /**
   * Decrement variant stock within a transaction. Throws if insufficient.
   */
  async decrementVariantStock(
    manager: EntityManager,
    productId: number,
    attributeName: string,
    attributeValue: string,
    quantity: number,
  ): Promise<void> {
    const row = await manager.findOne(ProductVariantStock, {
      where: { productId, attributeName, attributeValue },
      select: ['id', 'stock'],
    });
    if (!row) return;
    const current = Number(row.stock) ?? 0;
    if (current < quantity) {
      throw new BadRequestException(
        `Stock insuficiente para variante "${attributeName}: ${attributeValue}". Disponible: ${current}, solicitado: ${quantity}`,
      );
    }
    await manager.decrement(
      ProductVariantStock,
      { productId, attributeName, attributeValue },
      'stock',
      quantity,
    );
  }

  /**
   * Increment variant stock within a transaction (restore when order items are removed).
   */
  async incrementVariantStock(
    manager: EntityManager,
    productId: number,
    attributeName: string,
    attributeValue: string,
    quantity: number,
  ): Promise<void> {
    const row = await manager.findOne(ProductVariantStock, {
      where: { productId, attributeName, attributeValue },
      select: ['id'],
    });
    if (!row) return;
    await manager.increment(
      ProductVariantStock,
      { productId, attributeName, attributeValue },
      'stock',
      quantity,
    );
  }

  /**
   * Adjust variant stock by delta (admin). Creates row if missing (with stock 0) then adds delta.
   */
  async adjustVariantStock(
    productId: number,
    attributeName: string,
    attributeValue: string,
    delta: number,
  ): Promise<{ success: boolean; stock: number }> {
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

  /**
   * Set variant stocks for one attribute of a product (admin). Replaces all rows for (productId, attributeName).
   */
  async setVariantStocks(
    productId: number,
    attributeName: string,
    stocks: Array<{ attributeValue: string; stock: number }>,
  ): Promise<void> {
    await this.variantStockRepo.delete({ productId, attributeName });
    if (!stocks.length) {
      this.cache.invalidate('products:');
      return;
    }
    const entities = stocks.map((s) =>
      this.variantStockRepo.create({
        productId,
        attributeName,
        attributeValue: s.attributeValue.trim(),
        stock: Math.max(0, Math.floor(s.stock)),
      }),
    );
    await this.variantStockRepo.save(entities);
    this.cache.invalidate('products:');
  }

  /**
   * Remove a product by ID.
   * Currently returns placeholder text.
   *
   * @param id - Product ID.
   * @returns {string} Placeholder result.
   */
  remove(id: number) {
    this.cache.invalidate('products:');
    return `This action removes a #${id} product`;
  }

  // -------------------------------------------------------------------------
  // Inventory groups (admin)
  // -------------------------------------------------------------------------

  async findAllInventoryGroups(): Promise<
    Array<{
      id: number;
      name: string;
      stock: number;
      items: Array<{
        groupItemId: number;
        productId: number;
        productCode: number;
        productName: string;
        baseUnits: number;
        attributeName: string;
        attributeValue: string;
        alsoDeductProductId: number | null;
        alsoDeductAttributeName: string | null;
        alsoDeductAttributeValue: string | null;
        alsoDeductBaseUnits: number | null;
        selections: Array<{
          id: number;
          name: string;
          sortOrder: number;
          products: Array<{ productId: number; productName: string; baseUnits: number; sortOrder: number }>;
        }>;
      }>;
    }>
  > {
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

  async setGroupItemAlsoDeduct(
    groupId: number,
    productId: number,
    attributeName: string | undefined,
    attributeValue: string | undefined,
    alsoDeduct: {
      productId: number;
      baseUnits: number;
      attributeName?: string | null;
      attributeValue?: string | null;
    } | null,
  ): Promise<void> {
    const an = attributeName?.trim() ?? '';
    const av = attributeValue?.trim() ?? '';
    const item = await this.inventoryGroupItemRepo.findOne({
      where: { groupId, productId, attributeName: an, attributeValue: av },
    });
    if (!item) throw new NotFoundException('No se encontró el ítem en el grupo');
    item.alsoDeductProductId = alsoDeduct?.productId ?? null;
    item.alsoDeductAttributeName = alsoDeduct?.attributeName?.trim() ?? null;
    item.alsoDeductAttributeValue = alsoDeduct?.attributeValue?.trim() ?? null;
    item.alsoDeductBaseUnits = alsoDeduct?.baseUnits ?? null;
    await this.inventoryGroupItemRepo.save(item);
    this.cache.invalidate('products:');
  }

  async createInventoryGroup(name: string): Promise<InventoryGroup> {
    const group = this.inventoryGroupRepo.create({ name: name.trim(), stock: 0 });
    return this.inventoryGroupRepo.save(group);
  }

  async updateInventoryGroup(id: number, name: string): Promise<void> {
    await this.inventoryGroupRepo.update({ id }, { name: name.trim() });
    this.cache.invalidate('products:');
  }

  async deleteInventoryGroup(id: number): Promise<void> {
    await this.inventoryGroupRepo.delete({ id });
    this.cache.invalidate('products:');
  }

  async addInventoryGroupItem(
    groupId: number,
    productId: number,
    baseUnits: number,
    attributeName?: string,
    attributeValue?: string,
  ): Promise<InventoryGroupItem> {
    const group = await this.inventoryGroupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const an = attributeName?.trim() ?? '';
    const av = attributeValue?.trim() ?? '';
    const existing = await this.inventoryGroupItemRepo.findOne({
      where: { groupId, productId, attributeName: an, attributeValue: av },
    });
    if (existing) {
      if (an || av) throw new BadRequestException('Esa variante ya está en este grupo');
      throw new BadRequestException('El producto ya está en este grupo');
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

  async removeInventoryGroupItem(
    groupId: number,
    productId: number,
    attributeName?: string,
    attributeValue?: string,
  ): Promise<void> {
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

  async adjustGroupStock(groupId: number, delta: number): Promise<{ success: boolean; stock: number }> {
    const group = await this.inventoryGroupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    const current = Number(group.stock) ?? 0;
    const newStock = Math.max(0, current + Number(delta));
    group.stock = newStock;
    await this.inventoryGroupRepo.save(group);
    this.cache.invalidate('products:');
    return { success: true, stock: newStock };
  }

  // -------------------------------------------------------------------------
  // Inventory selections (admin): nombre + varios productos en una opción
  // -------------------------------------------------------------------------

  async createSelection(
    groupId: number,
    productId: number,
    name: string,
    attributeName?: string,
    attributeValue?: string,
  ): Promise<InventorySelection> {
    const an = attributeName?.trim() ?? '';
    const av = attributeValue?.trim() ?? '';
    const item = await this.inventoryGroupItemRepo.findOne({
      where: { groupId, productId, attributeName: an, attributeValue: av },
    });
    if (!item) throw new NotFoundException('No se encontró el ítem en el grupo');
    const selection = this.selectionRepo.create({
      groupItemId: item.id,
      name: name.trim(),
      sortOrder: 0,
    });
    const saved = await this.selectionRepo.save(selection);
    this.cache.invalidate('products:');
    return saved;
  }

  async updateSelection(selectionId: number, name: string): Promise<void> {
    const sel = await this.selectionRepo.findOne({ where: { id: selectionId } });
    if (!sel) throw new NotFoundException('Selección no encontrada');
    sel.name = name.trim();
    await this.selectionRepo.save(sel);
    this.cache.invalidate('products:');
  }

  async deleteSelection(selectionId: number): Promise<void> {
    await this.selectionRepo.delete({ id: selectionId });
    this.cache.invalidate('products:');
  }

  async addProductToSelection(
    selectionId: number,
    productId: number,
    baseUnits: number = 0,
    sortOrder: number = 0,
  ): Promise<InventorySelectionProduct> {
    const sel = await this.selectionRepo.findOne({ where: { id: selectionId } });
    if (!sel) throw new NotFoundException('Selección no encontrada');
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const existing = await this.selectionProductRepo.findOne({
      where: { selectionId, productId },
    });
    if (existing) throw new BadRequestException('El producto ya está en esta selección');
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

  async removeProductFromSelection(selectionId: number, productId: number): Promise<void> {
    await this.selectionProductRepo.delete({ selectionId, productId });
    this.cache.invalidate('products:');
  }
}
