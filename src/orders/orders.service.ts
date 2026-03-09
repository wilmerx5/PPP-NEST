import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Between, IsNull, Not, Repository, DataSource, EntityManager, In } from 'typeorm';
import { AddOrderExtraDto, ChangeTableDto, CreateOrderDto, UpdateOrderExtraDto, UpdateOrderGeneralDto, UpdateOrderItemUnitPriceDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderExtra } from './entities/order-extra.entity';
import { OrdersGateway } from './Websocket/order.gateway';
import { getBogotaDayRange, getBogotaDateRange, formatToBogotaISO, transformDatesToBogota } from '../common/utils/date.util';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { PointsService } from '../auth/services/points.service';
import { User } from '../auth/entities/user.entity';
import { UserPoints } from '../auth/entities/user-points.entity';
import { MailService } from '../common/mail/mail.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import { ProductsService, type InventoryInfo } from '../products/products.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,

    @InjectRepository(OrderItemAttribute)
    private readonly attrRepo: Repository<OrderItemAttribute>,

    @InjectRepository(OrderExtra)
    private readonly extraRepo: Repository<OrderExtra>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly gateway: OrdersGateway,
    
    private readonly dataSource: DataSource,

    @Inject(forwardRef(() => PointsService))
    private readonly pointsService: PointsService,

    private readonly productsService: ProductsService,

    private readonly mailService: MailService,

    private readonly circuitBreaker: CircuitBreakerService,
  ) {}


  /**
   * Generates the next daily order number atomically to prevent duplicates.
   * Uses a database transaction with pessimistic lock to ensure thread-safety.
   * 
   * @param todayStartUtc - Start of today in UTC
   * @param todayEndUtc - End of today in UTC
   * @param manager - Entity manager (optional, uses transaction manager if provided)
   * @returns Next available order number
   */
  private async generateNextOrderNumber(
    todayStartUtc: Date,
    todayEndUtc: Date,
    manager?: EntityManager
  ): Promise<number> {
    const repo = manager ? manager.getRepository(Order) : this.orderRepo;

    // Use raw query with FOR UPDATE lock to prevent concurrent access
    // This ensures only one transaction can read the max number at a time
    const result = await repo
      .createQueryBuilder('order')
      .select('MAX(order.dailyOrderNumber)', 'maxNumber')
      .where('order.createdAt BETWEEN :start AND :end', {
        start: todayStartUtc,
        end: todayEndUtc,
      })
      .setLock('pessimistic_write') // Lock rows for write
      .getRawOne();

    const maxNumber = result?.maxNumber || 0;
    return maxNumber + 1;
  }

  /**
   * Build count-by-key for inventory: "p:productId" (product), "v:productId:attrName:attrValue" (variant), "g:groupId" (group pool, value in base units).
   */
  private buildInventoryCountByKey(
    items: Array<{
      productId: number;
      attributes?: Array<{ attributeName: string; attributeValue: string }>;
      alsoDeductVariant?: { productId: number; attributes: Array<{ attributeName: string; attributeValue: string }> };
    }>,
    invMap: Map<number, InventoryInfo>,
  ): Record<string, number> {
    const countByKey: Record<string, number> = {};
    for (const item of items) {
      const inv = invMap.get(item.productId);
      if (!inv?.trackInventory) continue;
      // Variante en grupo: si el ítem tiene atributos y alguna variante está en un grupo, descontar del grupo
      if (inv.variantGroups?.length && item.attributes?.length) {
        const variantGroup = item.attributes.find((a) =>
          inv.variantGroups!.some(
            (vg) => vg.attributeName === a.attributeName && vg.attributeValue === a.attributeValue,
          ),
        );
        if (variantGroup) {
          const vg = inv.variantGroups!.find(
            (x) =>
              x.attributeName === variantGroup.attributeName &&
              x.attributeValue === variantGroup.attributeValue,
          );
          if (vg) {
            const key = `g:${vg.groupId}`;
            countByKey[key] = (countByKey[key] ?? 0) + vg.groupBaseUnits;
            continue;
          }
        }
      }
      const processAlsoDeductFrom = () => {
        if (!inv.alsoDeductFrom?.length) return;
        for (const ad of inv.alsoDeductFrom) {
          let attrName = ad.attributeName;
          let attrVal = ad.attributeValue;
          const invTarget = invMap.get(ad.productId);
          const targetHasVariantStock = (invTarget?.variantStocks?.length ?? 0) > 0;
          if ((attrName == null || attrVal == null) && targetHasVariantStock) {
            const adv = item.alsoDeductVariant;
            if (adv?.productId === ad.productId && adv.attributes?.length) {
              const match = adv.attributes.find((a) =>
                invTarget!.variantStocks!.some(
                  (v) => v.attributeName === a.attributeName && v.attributeValue === a.attributeValue,
                ),
              );
              if (match) {
                attrName = match.attributeName;
                attrVal = match.attributeValue;
              }
            }
            if (attrName == null || attrVal == null) {
              const otherItem = items.find((i) => i.productId === ad.productId);
              if (otherItem?.attributes?.length) {
                const match = otherItem.attributes.find((a) =>
                  invTarget!.variantStocks!.some(
                    (v) => v.attributeName === a.attributeName && v.attributeValue === a.attributeValue,
                  ),
                );
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
          } else {
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
      let key: string;
      if (inv.variantStocks?.length && item.attributes?.length) {
        const match = item.attributes.find(
          (a) => inv.variantStocks.some((v) => v.attributeName === a.attributeName && v.attributeValue === a.attributeValue),
        );
        if (match) {
          key = `v:${item.productId}:${match.attributeName}:${match.attributeValue}`;
        } else {
          key = `p:${item.productId}`;
        }
      } else {
        key = `p:${item.productId}`;
      }
      countByKey[key] = (countByKey[key] ?? 0) + 1;
    }
    return countByKey;
  }

  private parseVariantKey(key: string): { productId: number; attributeName: string; attributeValue: string } | null {
    if (!key.startsWith('v:')) return null;
    const parts = key.split(':');
    if (parts.length < 4) return null;
    return {
      productId: Number(parts[1]),
      attributeName: parts[2],
      attributeValue: parts.slice(3).join(':'),
    };
  }

  private validateInventoryCounts(
    countByStockKey: Record<string, number>,
    invMap: Map<number, InventoryInfo>,
    products: Array<{ id: number; name: string }>,
  ): void {
    for (const [key, count] of Object.entries(countByStockKey)) {
      if (count <= 0) continue;
      if (key.startsWith('g:')) {
        const groupId = Number(key.replace('g:', ''));
        const invWithGroup = [...invMap.values()].find((inv) => inv.groupId === groupId);
        const available = invWithGroup?.groupStock ?? 0;
        if (available < count) {
          throw new BadRequestException(
            `Stock insuficiente en el grupo de inventario. Disponible: ${available.toFixed(2)} unidades base, solicitado: ${count.toFixed(2)}`,
          );
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
          throw new BadRequestException(
            `Stock insuficiente para "${p?.name ?? 'producto'} - ${attributeValue}". Disponible: ${available}, solicitado: ${count}`,
          );
        }
      } else {
        const productId = Number(key.replace('p:', ''));
        const inv = invMap.get(productId);
        const available = inv?.stock ?? 0;
        if (inv?.trackInventory && available < count) {
          const p = products.find((x) => x.id === productId);
          throw new BadRequestException(
            `Stock insuficiente para "${p?.name ?? 'producto'}". Disponible: ${available}, solicitado: ${count}`,
          );
        }
      }
    }
  }

  private async deductInventory(
    manager: EntityManager,
    countByStockKey: Record<string, number>,
  ): Promise<void> {
    for (const [key, count] of Object.entries(countByStockKey)) {
      if (count <= 0) continue;
      if (key.startsWith('g:')) {
        const groupId = Number(key.replace('g:', ''));
        await this.productsService.decrementGroupStock(manager, groupId, count);
        continue;
      }
      const variant = this.parseVariantKey(key);
      if (variant) {
        await this.productsService.decrementVariantStock(
          manager,
          variant.productId,
          variant.attributeName,
          variant.attributeValue,
          count,
        );
      } else {
        const productId = Number(key.replace('p:', ''));
        await this.productsService.decrementStock(manager, productId, count);
      }
    }
  }

  private async restoreInventory(
    manager: EntityManager,
    countByStockKey: Record<string, number>,
  ): Promise<void> {
    for (const [key, count] of Object.entries(countByStockKey)) {
      if (count <= 0) continue;
      if (key.startsWith('g:')) {
        const groupId = Number(key.replace('g:', ''));
        await this.productsService.incrementGroupStock(manager, groupId, count);
        continue;
      }
      const variant = this.parseVariantKey(key);
      if (variant) {
        await this.productsService.incrementVariantStock(
          manager,
          variant.productId,
          variant.attributeName,
          variant.attributeValue,
          count,
        );
      } else {
        const productId = Number(key.replace('p:', ''));
        await this.productsService.incrementStock(manager, productId, count);
      }
    }
  }

  /**
   * Crea una nueva orden con sus items y atributos.
   *
   * Flujo:
   * 1. Se calcula el número de pedido del día (atomicamente).
   * 2. Se crea la orden en una transacción.
   * 3. Se crean los items.
   * 4. Se crean los atributos de cada item.
   * 5. Se notifica por WebSocket a cocina.
   *
   * @param createOrderDto - Datos de la orden y sus productos.
   * @returns Detalle de creación con ID y número diario.
   */
  async create(createOrderDto: CreateOrderDto) {
    const { customerName, phone, address, items, customerEmail, orderSource, redemptionCode, extras } = createOrderDto;
    const orderType = createOrderDto.orderType ?? 'pickup';
    const deliveryFee = createOrderDto.deliveryFee;
    const source = orderSource ?? 'internal';

    const hasItems = items && items.length > 0;
    const hasExtras = extras && extras.length > 0;
    if (!hasItems && !hasExtras) {
      throw new BadRequestException('Order must have at least one item or one extra');
    }

    // Pre-compute for transaction: inventory keys to deduct and product codes for points (avoids N+1 and duplicate getInventory)
    let countByStockKeyForDeduct: Record<string, number> = {};
    let allCodesFromProducts: number[] = [];

    // Una sola orden activa por mesa: solo considerar órdenes de HOY (no bloquear por órdenes viejas)
    if (orderType === 'table' && address != null && String(address).trim() !== '') {
      const { start: todayStartUtc, end: todayEndUtc } = getBogotaDayRange();
      const tableAddr = String(address).trim();

      const activeForTable = await this.orderRepo.findOne({
        where: {
          orderType: 'table',
          address: tableAddr,
          orderStatus: Not(In(['completed', 'canceled'])),
          createdAt: Between(todayStartUtc, todayEndUtc),
        },
      });

      if (activeForTable) {
        throw new BadRequestException(
          'Esta mesa ya tiene una orden activa. Añade los productos a la orden existente.',
        );
      }
    }

    if (hasItems && items.length > 0) {
      const productIds = [...new Set(items.map((i) => i.productId))];
      const products = await this.productRepo.find({
        where: { id: In(productIds) },
        select: ['id', 'name', 'isActive', 'code'],
      });
      const inactive = products.find((p) => p.isActive === false);
      if (inactive) {
        throw new BadRequestException(
          `El producto "${inactive.name}" está desactivado y no puede agregarse al pedido.`,
        );
      }
      // Validate inventory: product-level or variant-level (per attribute) stock (single call; reuse result for deduct)
      const invMap = await this.productsService.getInventoryByProductIds(productIds, { includeAlsoDeductTargets: true });
      const countByStockKey = this.buildInventoryCountByKey(items, invMap);
      this.validateInventoryCounts(countByStockKey, invMap, products);
      countByStockKeyForDeduct = { ...countByStockKey };
      allCodesFromProducts = items.map((i) => products.find((p) => p.id === i.productId)?.code).filter((c): c is number => c != null);
    }

    // Get today's range in Bogotá timezone, converted to UTC for database query
    const { start: todayStartUtc, end: todayEndUtc } = getBogotaDayRange();

    // Validate delivery fee
    let finalDeliveryFee = 0;
    if (orderType === 'delivery') {
      if (deliveryFee == null) {
        throw new BadRequestException('El domicilio es obligatorio para pedidos a domicilio');
      }
      finalDeliveryFee = deliveryFee;
    }

    // Create order within a transaction to ensure atomicity
    // This prevents race conditions when generating order numbers
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate order number atomically within transaction with lock
      const newOrderNumber = await this.generateNextOrderNumber(
        todayStartUtc,
        todayEndUtc,
        queryRunner.manager
      );

      // Verify the number doesn't already exist (safety check)
      const existingOrder = await queryRunner.manager.findOne(Order, {
        where: {
          dailyOrderNumber: newOrderNumber,
          createdAt: Between(todayStartUtc, todayEndUtc),
        },
      });

      if (existingOrder) {
        throw new InternalServerErrorException(
          'Hubo un conflicto al generar el número de orden. Intenta de nuevo.'
        );
      }

      // Create order
      const order = queryRunner.manager.create(Order, {
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

      // Calculate points from product codes only (extras do not generate points; codes pre-computed to avoid N+1)
      const allCodes = allCodesFromProducts;

      // If a redemption prize is applied, adjust point calculation
      // A prize discounts one half chicken (code 2 or 5), so we need to remove one from the calculation
      let adjustedCodes = [...allCodes];
      if (redemptionCode && redemptionCode.trim()) {
        // Check if we have both code 2 and 5 (together they generate 1 point)
        const hasCode2 = adjustedCodes.includes(2);
        const hasCode5 = adjustedCodes.includes(5);
        
        if (hasCode2 && hasCode5) {
          // Remove one instance of code 2 or 5 (the one being discounted)
          // Remove code 2 first if available, otherwise code 5
          const indexToRemove = adjustedCodes.indexOf(2);
          if (indexToRemove !== -1) {
            adjustedCodes.splice(indexToRemove, 1);
          } else {
            const index5 = adjustedCodes.indexOf(5);
            if (index5 !== -1) {
              adjustedCodes.splice(index5, 1);
            }
          }
        } else if (hasCode2) {
          // If only code 2, remove one instance
          const indexToRemove = adjustedCodes.indexOf(2);
          if (indexToRemove !== -1) {
            adjustedCodes.splice(indexToRemove, 1);
          }
        } else if (hasCode5) {
          // If only code 5, remove one instance
          const indexToRemove = adjustedCodes.indexOf(5);
          if (indexToRemove !== -1) {
            adjustedCodes.splice(indexToRemove, 1);
          }
        }
      }

      const calculatedPoints = this.pointsService.calculatePointsFromCodes(adjustedCodes);

      // Save order with points count (for display purposes)
      order.points = calculatedPoints;
      const savedOrder = await queryRunner.manager.save(order);

      // Create items and attributes (unitPrice = enviado con descuento o precio del producto)
      if (items?.length) {
        const productIds = [...new Set((items as { productId: number }[]).map((i) => i.productId))];
        const products = await queryRunner.manager.find(Product, { where: { id: In(productIds) }, select: ['id', 'price'] });
        const priceByProductId = new Map(products.map((p) => [p.id, Number(p.price)]));

        for (const item of items) {
          const productPrice = priceByProductId.get(item.productId) ?? null;
          const rawUnitPrice = (item as unknown as { unitPrice?: unknown }).unitPrice ?? item.unitPrice;
          const customPrice =
            rawUnitPrice != null && Number(rawUnitPrice) >= 0 ? Number(rawUnitPrice) : null;
          const unitPrice = customPrice ?? productPrice;
          const valueToSave = unitPrice != null ? Number(unitPrice) : null;
          const orderItem = queryRunner.manager.create(OrderItem, {
            order: savedOrder,
            product: { id: item.productId },
            note: item.note != null && item.note !== undefined ? String(item.note) : '',
            unitPrice: valueToSave,
          });

          const savedItem = await queryRunner.manager.save(orderItem);
          if (valueToSave !== null) {
            await queryRunner.manager.query(
              'UPDATE ppp_order_items SET unit_price = ? WHERE id = ?',
              [valueToSave, savedItem.id],
            );
          }

          if (item.attributes?.length) {
            const attrs = item.attributes
              .filter((attr) => attr?.attributeName != null && attr?.attributeValue != null && String(attr.attributeValue).trim() !== '')
              .map((attr) =>
                queryRunner.manager.create(OrderItemAttribute, {
                  orderItem: savedItem,
                  attributeName: String(attr.attributeName).trim(),
                  attributeValue: String(attr.attributeValue).trim(),
                }),
              );
            if (attrs.length > 0) await queryRunner.manager.save(attrs);
          }
        }

        // Deduct inventory using pre-computed count (avoids second getInventoryByProductIds)
        await this.deductInventory(queryRunner.manager, countByStockKeyForDeduct);
      }

      // Create extras (adicionales, código 90)
      if (extras?.length) {
        for (const ex of extras) {
          const extra = queryRunner.manager.create(OrderExtra, {
            order: savedOrder,
            title: ex.title,
            description: ex.description ?? null,
            amount: ex.amount,
            quantity: ex.quantity ?? 1,
          });
          await queryRunner.manager.save(extra);
        }
      }

      await queryRunner.commitTransaction();

      // Create point codes for the order (whether online or internal)
      // Point codes are created even for internal orders, so they can be printed on receipt
      // Do this after transaction commit to avoid lock issues
      if (calculatedPoints > 0) {
        try {
          // If order is online and has customer email, assign codes to user
          if (source === 'online' && customerEmail) {
            const user = await this.userRepo.findOne({ where: { email: customerEmail } });
            
            if (user) {
              await this.pointsService.createPointsForOrder(
                user.id,
                savedOrder.id,
                newOrderNumber,
                calculatedPoints
              );
            }
          } else {
            // For internal orders, create point codes without assigning to user
            // User will register them manually using the code from receipt
            const pointsRepo = this.dataSource.getRepository(UserPoints);
            const pointRecords: UserPoints[] = [];
            for (let i = 0; i < calculatedPoints; i++) {
              const code = await this.pointsService.generateUniquePointCode();
              pointRecords.push(
                pointsRepo.create({
                  code,
                  userId: null,
                  orderId: savedOrder.id,
                  orderDailyNumber: newOrderNumber,
                  isUsed: false,
                  type: 'automatic',
                  description: `Punto de orden #${newOrderNumber}`,
                }) as UserPoints,
              );
            }
            if (pointRecords.length > 0) await pointsRepo.save(pointRecords);
          }
        } catch {
          // Don't fail order creation if point code generation fails
        }
      }

      // Apply redemption prize if provided (before loading order for response)
      if (redemptionCode && redemptionCode.trim()) {
        try {
          await this.applyRedemptionVoucher(savedOrder.id, redemptionCode.trim());
        } catch {
          // Order is created but without prize applied; don't fail order creation
        }
      }

      const finalOrder = await this.orderRepo.findOne({
        where: { id: savedOrder.id },
        relations: ['items', 'items.product', 'items.attributes', 'extras'],
      });

      if (finalOrder) {
        const formatted = await this.mapOrderToGroupedFormat(finalOrder);
        this.gateway.emitOrdersUpdates("created_order", formatted);

        // Enviar notificación por correo si la orden es online
        if (source === 'online') {
          try {
            // Agrupar items por producto para el correo
            const itemsMap = new Map<string, { productName: string; quantity: number; price: number }>();
            
            finalOrder.items.forEach(item => {
              const productName = item.product?.name || `Producto #${item.product?.code || 'N/A'}`;
              const price = Number(item.unitPrice ?? item.product?.price ?? 0);
              const key = `${item.product?.id || 'unknown'}-${productName}`;
              
              if (itemsMap.has(key)) {
                const existing = itemsMap.get(key)!;
                existing.quantity += 1;
              } else {
                itemsMap.set(key, {
                  productName,
                  quantity: 1,
                  price,
                });
              }
            });

            const emailItems = Array.from(itemsMap.values());

            // Calcular total
            const subtotal = emailItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + (finalOrder.deliveryFee ? Number(finalOrder.deliveryFee) : 0);

            await this.mailService.sendNewOrderNotification(
              newOrderNumber,
              customerName,
              phone,
              address,
              orderType,
              emailItems,
              total,
              finalOrder.deliveryFee ? Number(finalOrder.deliveryFee) : undefined,
            );
          } catch {
            // No fallar la creación de la orden si el correo falla
          }
        }
      }

      return {
        success: true,
        orderId: savedOrder.id,
        dailyOrderNumber: newOrderNumber,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      // Check if it's a duplicate key error
      if (error?.code === 'ER_DUP_ENTRY' || error?.message?.includes('duplicate')) {
        throw new BadRequestException(
          'Ya existe una orden con ese número. Intenta de nuevo.'
        );
      }
      
      // Re-throw if it's our custom error
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtiene todas las órdenes del día en Bogotá,
   * excluyendo las canceladas.
   * Agrupa items repetidos por producto.
   *
   * @returns Lista de órdenes formateadas.
   */
  /**
   * @param orderType - Optional. If provided (e.g. 'table'), only orders of that type are returned. Reduces payload for mesas app.
   */
  async findOrdersToday(orderType?: string) {
    return this.circuitBreaker.execute(
      async () => {
        const { start: todayStartUtc, end: todayEndUtc } = getBogotaDayRange();
        const where: any = {
          createdAt: Between(todayStartUtc, todayEndUtc),
          orderStatus: Not('canceled'),
        };
        if (orderType && ['table', 'delivery', 'pickup', 'counter', 'rappi'].includes(orderType)) {
          where.orderType = orderType;
        }
        const orders = await this.orderRepo.find({
          where,
          relations: ['items', 'items.product', 'items.attributes', 'extras'],
          order: { createdAt: 'DESC' },
        });
        const ordersWithPointCodes = await Promise.all(
          orders.map(async (order) => {
            const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
            const dbPoints = order.points;
            const pointsValue = dbPoints !== null && dbPoints !== undefined ? dbPoints : pointCodes.length || 0;
            return { order, pointCodes, pointsValue };
          }),
        );
        const mappedOrders = await Promise.all(
          ordersWithPointCodes.map(async ({ order, pointCodes, pointsValue }) => {
            const formatted = await this.mapOrderToGroupedFormat(order);
            return { ...formatted, points: pointsValue, pointCodes };
          }),
        );
        return mappedOrders;
      },
      async () => [],
    );
  }

  /**
   * Obtiene las órdenes del usuario autenticado (por email).
   * Excluye canceladas. Mismo formato que findOrdersToday.
   *
   * @param email - Email del usuario (req.user.email).
   * @returns Lista de órdenes formateadas.
   */
  async findMine(email: string) {
    const orders = await this.orderRepo.find({
      where: {
        customerEmail: email,
        orderStatus: Not('canceled'),
      },
      relations: ['items', 'items.product', 'items.attributes', 'extras'],
      order: { createdAt: 'DESC' },
    });

    // Get point codes for all orders in parallel
      const ordersWithPointCodes = await Promise.all(
        orders.map(async (order) => {
          const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
          // Ensure points is set - if null/undefined, use pointCodes length as fallback
          const pointsValue = order.points ?? pointCodes.length ?? 0;
          return { order, pointCodes, pointsValue };
        })
      );

      return ordersWithPointCodes.map(({ order, pointCodes, pointsValue }) => {
        // Convert createdAt from UTC to Bogotá timezone ISO string
        const createdAtBogota = formatToBogotaISO(order.createdAt);
        
        const groupedItems: Record<number, any> = {};

        for (const item of order.items) {
        if (!item.product) continue;
        const productId = item.product.id;
        const productName = item.product.name;
        const code = item.product.code;
        const imageUrl = item.product.imageUrl;
        const price = item.unitPrice != null ? Number(item.unitPrice) : item.product.price;

        const attributeMap = item.attributes?.reduce((acc, attr) => {
          acc[attr.attributeName] = attr.attributeValue;
          return acc;
        }, {} as Record<string, string>);

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

        const extrasList = (order as any).extras?.map((e: OrderExtra) => ({
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

  /**
   * Marca una orden como cancelada y elimina todos sus items.
   * Se usa cuando se elimina una orden desde el frontend.
   * Notifica por WebSocket.
   *
   * @param orderId - ID de la orden a cancelar.
   */
  async removeOrder(orderId: number) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });

    if (!order) throw new Error(`No se encontró la orden con ID ${orderId}`);

    order.orderStatus = 'canceled';
    await this.orderRepo.save(order);

    // Invalidate points for canceled order
    try {
      await this.pointsService.invalidatePointsForCanceledOrder(orderId);
    } catch {
      // Don't fail order cancellation if point invalidation fails
    }

    this.gateway.emitOrdersUpdates("deleted_order", order);

    return {
      success: true,
      message: `Orden #${orderId} cancelada`,
    };
  }

  /**
   * Actualiza solamente los productos (items) de una orden.
   * Elimina los items existentes y los vuelve a crear.
   * Si queda sin items → la orden se cancela.
   * Inventario: restaura stock de items antiguos y descuenta para los nuevos (en transacción).
   *
   * @param orderId - ID de la orden.
   * @param dto - Lista de nuevos items.
   */
  async updateOrderItems(orderId: number, dto: UpdateOrderItemsDto) {
    // --- PASO 0: Payload recibido y deduplicado (igual que en front: productId+atributos+note) ---
    const rawItems = dto.items ?? [];
    const itemsToCreate = this.deduplicateIncomingUpdateItems(rawItems.slice());
    const rawCount = rawItems.length;
    const incomingCount = itemsToCreate.length;
    if (rawCount !== incomingCount) {
      console.log('[PPP-BACKEND] updateOrderItems payload DEDUP (entrante tenía duplicados)', {
        orderId,
        rawCount,
        afterDedup: incomingCount,
        rawProductIds: rawItems.map((i) => i.productId),
        afterProductIds: itemsToCreate.map((i) => i.productId),
      });
    }
    console.log('[PPP-BACKEND] updateOrderItems PASO 0 ENTRADA', {
      orderId,
      incomingCount,
      productIds: itemsToCreate.map((i) => i.productId),
      items: itemsToCreate.map((i, idx) => ({
        idx,
        productId: i.productId,
        note: i.note,
        attributes: i.attributes?.length ?? 0,
        kitchenPrepared: i.kitchenPrepared,
      })),
      extrasToAddCount: dto.extrasToAdd?.length ?? 0,
    });

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'items.attributes'],
    });

    if (!order) throw new NotFoundException('No se encontró la orden');

    const rawItemsCount = order.items?.length ?? 0;
    order.items = this.deduplicateOrderItemsById(order.items);
    const dedupedItemsCount = order.items.length;
    const oldItemIds = order.items.map((i) => i.id);
    console.log('[PPP-BACKEND] updateOrderItems PASO 1 orden cargada', {
      orderId,
      rawItemsCount,
      dedupedItemsCount,
      oldItemIds,
      oldProductIds: order.items.map((i) => i.product?.id),
    });

    const hasItems = itemsToCreate.length > 0;
    const hasExtrasToAdd = dto.extrasToAdd?.length;

    // Old items: build count-by-stock-key for restore (product or variant)
    const oldProductIds = [...new Set(order.items.map((i) => i.product?.id).filter((id): id is number => id != null))];
    const invMapOld = oldProductIds.length ? await this.productsService.getInventoryByProductIds(oldProductIds) : new Map();
    const oldItemsForInv = order.items.map((i) => ({
      productId: i.product!.id,
      attributes: (i.attributes || []).map((a) => ({ attributeName: a.attributeName, attributeValue: a.attributeValue })),
    }));
    const oldCountByStockKey = this.buildInventoryCountByKey(oldItemsForInv, invMapOld);

    // New items: validate inventory (product or variant)
    const newProductIds = [...new Set(itemsToCreate.map((i) => i.productId))];
    if (newProductIds.length > 0) {
      const invMapNew = await this.productsService.getInventoryByProductIds(newProductIds, { includeAlsoDeductTargets: true });
      const newCountByStockKey = this.buildInventoryCountByKey(itemsToCreate, invMapNew);
      const productsForError = await this.productRepo.find({ where: { id: In(newProductIds) }, select: ['id', 'name'] });
      this.validateInventoryCounts(newCountByStockKey, invMapNew, productsForError);
    }

    let createdItemsCount = 0;
    let fullOrderInTx: Order | null = null;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Restore inventory for old items (product or variant)
      await this.restoreInventory(queryRunner.manager, oldCountByStockKey);

      // Delete old items and attributes in batch (same transaction).
      // Solo IDs válidos: TypeORM puede devolver ítems con id undefined en algunas cargas.
      const itemIdsToDelete = order.items.map((i) => i.id).filter((id): id is number => id != null && Number.isInteger(id));
      console.log('[PPP-BACKEND] updateOrderItems PASO 2 BORRANDO ítems antiguos', {
        orderId,
        itemIdsToDelete,
        count: itemIdsToDelete.length,
      });
      if (itemIdsToDelete.length > 0) {
        const attrDeleteResult = await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(OrderItemAttribute)
          .where('order_item_id IN (:...ids)', { ids: itemIdsToDelete })
          .execute();
        const deleteResult = await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(OrderItem)
          .where('id IN (:...ids)', { ids: itemIdsToDelete })
          .execute();
        console.log('[PPP-BACKEND] updateOrderItems PASO 2 BORRADO ejecutado', {
          orderId,
          attributesDeleted: attrDeleteResult.affected ?? 0,
          orderItemsDeleted: deleteResult.affected ?? 0,
        });
      } else if (order.items.length > 0) {
        // Respaldo: había ítems pero sin IDs válidos → borrar por order_id para no dejar huérfanos
        console.log('[PPP-BACKEND] updateOrderItems BORRANDO por order_id (IDs no válidos)', { orderId });
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(OrderItemAttribute)
          .where('order_item_id IN (SELECT id FROM ppp_order_items WHERE order_id = :orderId)', { orderId })
          .execute();
        const deleteResult = await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(OrderItem)
          .where('order_id = :orderId', { orderId })
          .execute();
        console.log('[PPP-BACKEND] updateOrderItems BORRADO por order_id ejecutado', { orderId, orderItemsDeleted: deleteResult.affected ?? 0 });
      }

      if (!hasItems && !hasExtrasToAdd) {
        order.orderStatus = 'canceled';
        await queryRunner.manager.save(order);
        await queryRunner.commitTransaction();
        try {
          await this.pointsService.invalidatePointsForCanceledOrder(orderId);
        } catch {
          // Don't fail if point invalidation fails
        }
        this.gateway.emitOrdersUpdates("deleted_order", order);
        return {
          success: true,
          message: `Orden #${orderId} cancelada porque no quedaron productos`,
        };
      }

      const wasPastCooking = ['cooked', 'packing', 'inDelivery', 'completed'].includes(order.orderStatus);
      if (wasPastCooking) {
        order.orderStatus = 'cooking';
        await queryRunner.manager.save(order);
      }

      const productIds = itemsToCreate.map((i) => i.productId);
      const productsForPrice = productIds.length
        ? await queryRunner.manager.find(Product, { where: { id: In(productIds) }, select: ['id', 'price'] })
        : [];
      const priceByProductId = new Map(productsForPrice.map((p) => [p.id, Number(p.price)]));

      console.log('[PPP-BACKEND] updateOrderItems PASO 3 CREANDO ítems', {
        orderId,
        count: itemsToCreate.length,
        productIds: itemsToCreate.map((i) => i.productId),
      });
      for (const itemDto of itemsToCreate) {
        const productPrice = priceByProductId.get(itemDto.productId) ?? null;
        const customPrice = itemDto.unitPrice != null && Number(itemDto.unitPrice) >= 0 ? Number(itemDto.unitPrice) : null;
        const unitPrice = customPrice ?? productPrice;
        const orderItem = queryRunner.manager.create(OrderItem, {
          order,
          product: { id: itemDto.productId },
          note: itemDto.note,
          kitchenPreparedAt: itemDto.kitchenPrepared === true ? new Date() : null,
          unitPrice: unitPrice != null ? unitPrice : undefined,
        });

        const savedItem = await queryRunner.manager.save(orderItem);
        createdItemsCount += 1;

        if (itemDto.attributes?.length) {
          const attributes = itemDto.attributes.map(attr =>
            queryRunner.manager.create(OrderItemAttribute, {
              orderItem: savedItem,
              attributeName: attr.attributeName,
              attributeValue: attr.attributeValue,
            })
          );
          await queryRunner.manager.save(attributes);
        }
      }
      console.log('[PPP-BACKEND] updateOrderItems PASO 3 LOOP terminado', {
        orderId,
        createdItemsCount,
        esperado: itemsToCreate.length,
        ok: createdItemsCount === itemsToCreate.length,
      });

      // Deduct inventory for new items (product or variant)
      const newProductIdsInTx = [...new Set(itemsToCreate.map((i) => i.productId))];
      const invMapNewInTx = newProductIdsInTx.length
        ? await this.productsService.getInventoryByProductIds(newProductIdsInTx, { includeAlsoDeductTargets: true })
        : new Map();
      const newCountByStockKey = this.buildInventoryCountByKey(itemsToCreate, invMapNewInTx);
      await this.deductInventory(queryRunner.manager, newCountByStockKey);

      // Agregar extras (adicionales, código 90)
      if (dto.extrasToAdd?.length) {
        for (const ex of dto.extrasToAdd) {
          const extra = queryRunner.manager.create(OrderExtra, {
            order,
            title: ex.title,
            description: ex.description ?? null,
            amount: ex.amount,
            quantity: ex.quantity ?? 1,
          });
          await queryRunner.manager.save(extra);
        }
      }

      // Leer la orden DENTRO de la misma transacción (después de DELETE + INSERT).
      // Una lectura tras el commit con otro QueryRunner puede ver estado inconsistente (p. ej. ítems borrados aún visibles).
      console.log('[PPP-BACKEND] updateOrderItems PASO 4 lectura dentro de la transacción', { orderId });
      fullOrderInTx = await queryRunner.manager.findOne(Order, {
        where: { id: order.id },
        relations: ['items', 'items.product', 'items.attributes', 'extras'],
      });
      const idsInTx = fullOrderInTx?.items?.map((i) => i.id) ?? [];
      console.log('[PPP-BACKEND] updateOrderItems PASO 4 resultado en tx', {
        orderId,
        itemsCount: fullOrderInTx?.items?.length ?? 0,
        itemIds: idsInTx,
      });

      await queryRunner.commitTransaction();
      console.log('[PPP-BACKEND] updateOrderItems PASO 5 COMMIT ok', { orderId });
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }

    let fullOrder = fullOrderInTx;
    if (fullOrder?.items?.some((i) => !i.product)) {
      const retryRunner = this.dataSource.createQueryRunner();
      await retryRunner.connect();
      try {
        fullOrder = await retryRunner.manager.findOne(Order, {
          where: { id: order.id },
          relations: ['items', 'items.product', 'items.attributes', 'extras'],
        }) ?? fullOrder;
      } finally {
        await retryRunner.release();
      }
    }

    if (fullOrder) {
      fullOrder.items = this.deduplicateOrderItemsById(fullOrder.items);
      const itemIdsAfterDedup = fullOrder.items.map((i) => i.id);
      console.log('[PPP-BACKEND] updateOrderItems PASO 6 dedup + puntos', {
        orderId,
        itemsCount: fullOrder.items.length,
        itemIds: itemIdsAfterDedup,
      });
      const allCodes: number[] = [];
      for (const item of fullOrder.items) {
        if (!item.product) continue;
        allCodes.push(item.product.code);
      }
      const recalculatedPoints = this.pointsService.calculatePointsFromCodes(allCodes);
      fullOrder.points = recalculatedPoints;
      await this.orderRepo.save(fullOrder);
      try {
        await this.pointsService.updatePointCodesForOrder(
          fullOrder.id,
          fullOrder.dailyOrderNumber,
          recalculatedPoints
        );
      } catch {
        // Don't fail order update if point code update fails
      }

      // Usar fullOrder (lectura fresca) para formatear y emitir; no hacer otro findOne (evita caché).
      const formatted = await this.mapOrderToGroupedFormat(fullOrder);
      const responseItemsCount = (formatted?.items ?? []).reduce((acc: number, g: any) => acc + (g.variants?.length ?? 0), 0);
      const groupCount = (formatted?.items ?? []).length;
      console.log('[PPP-BACKEND] updateOrderItems PASO 7 EMIT', {
        orderId,
        dtoCount: incomingCount,
        createdItemsCount,
        fullOrderItemsCount: fullOrder.items.length,
        emitVariantes: responseItemsCount,
        emitGrupos: groupCount,
        esperadoOk: responseItemsCount === createdItemsCount,
      });
      this.gateway.emitOrdersUpdates("updated_order_items", formatted);
    }

    return {
      success: true,
      message: `Order #${fullOrder?.dailyOrderNumber} updated successfully`,
    };
  }

  /**
   * Actualiza solo el precio unitario de todos los ítems de un producto en la orden (aplicar descuento después de creada).
   * No modifica inventario ni otros ítems.
   */
  async updateOrderItemUnitPrice(orderId: number, dto: UpdateOrderItemUnitPriceDto) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'items.attributes', 'extras'],
    });
    if (!order) throw new NotFoundException('No se encontró la orden');
    if (['completed', 'canceled'].includes(order.orderStatus)) {
      throw new BadRequestException('No se puede modificar el precio de una orden completada o cancelada');
    }
    const itemsToUpdate = order.items.filter((i) => i.product?.id === dto.productId);
    if (itemsToUpdate.length === 0) {
      throw new NotFoundException('No hay ítems de ese producto en la orden');
    }
    const value = Number(dto.unitPrice);
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException('Precio unitario inválido');
    }
    await this.itemRepo.update(
      { order: { id: orderId }, product: { id: dto.productId } },
      { unitPrice: value },
    );
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

  /**
   * Añade un adicional (extra) a una orden existente.
   */
  async addExtra(orderId: number, dto: AddOrderExtraDto) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, orderStatus: Not('canceled') },
    });
    if (!order) throw new NotFoundException('Orden no encontrada o cancelada');
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

  /**
   * Elimina un adicional de una orden.
   */
  async deleteExtra(orderId: number, extraId: number) {
    const extra = await this.extraRepo.findOne({
      where: { id: extraId },
      relations: ['order'],
    });
    if (!extra || extra.order?.id !== orderId) throw new NotFoundException('Adicional no encontrado o no pertenece a esta orden');
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

  /**
   * Actualiza un adicional de una orden.
   */
  async updateExtra(orderId: number, extraId: number, dto: UpdateOrderExtraDto) {
    const extra = await this.extraRepo.findOne({
      where: { id: extraId },
      relations: ['order'],
    });
    if (!extra || extra.order?.id !== orderId) throw new NotFoundException('Adicional no encontrado o no pertenece a esta orden');
    if (dto.title !== undefined) extra.title = dto.title;
    if (dto.description !== undefined) extra.description = dto.description;
    if (dto.amount !== undefined) extra.amount = dto.amount;
    if (dto.quantity !== undefined) extra.quantity = dto.quantity;
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

  /**
   * Actualiza información general de la orden:
   * - Nombre Cliente
   * - Teléfono
   * - Dirección
   * - Tipo de orden
   * - Estado
   * - Impresión
   *
   * Notifica por WebSocket dependiendo del tipo de actualización.
   *
   * @param orderId - ID de la orden.
   * @param dto - Campos opcionales a actualizar.
   */
  async updateOrderGeneral(orderId: number, dto: UpdateOrderGeneralDto) {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new Error('No se encontró la orden');

    // Check if order is being canceled
    const wasCanceled = dto.orderStatus === 'canceled' && order.orderStatus !== 'canceled';

    // Update only provided fields
    if (dto.customerName !== undefined) order.customerName = dto.customerName;
    if (dto.phone !== undefined) order.phone = dto.phone;
    if (dto.address !== undefined) order.address = dto.address;
    if (dto.orderType !== undefined) order.orderType = dto.orderType;
    if (dto.orderStatus !== undefined) order.orderStatus = dto.orderStatus;
    if (dto.printed !== undefined) order.printed = dto.printed;

    // ✅ (AÑADIDO) Actualizar deliveryFee sin romper lo demás
    // - si cambia a delivery: permite actualizar deliveryFee
    // - si cambia a NO delivery: lo resetea a 0
    if (dto.orderType === 'delivery') {
      if (dto.deliveryFee !== undefined) {
        order.deliveryFee = dto.deliveryFee;
      }
    } else if (dto.orderType !== undefined) {
      order.deliveryFee = 0;
    }

    await this.orderRepo.save(order);

    // Cuando cocina marca la orden como lista/empacando, marcar todos los ítems pendientes como preparados
    if (dto.orderStatus === 'cooked' || dto.orderStatus === 'packing') {
      await this.itemRepo.update(
        { order: { id: orderId }, kitchenPreparedAt: IsNull() },
        { kitchenPreparedAt: new Date() },
      );
    }

    // Invalidate points if order was just canceled
    if (wasCanceled) {
      try {
        await this.pointsService.invalidatePointsForCanceledOrder(orderId);
      } catch {
        // Don't fail order update if point invalidation fails
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

      } else if (
        dto.orderStatus === 'completed' &&
        fullOrder.orderType === 'table'
      ) {
        this.gateway.emitOrdersUpdates("orderCompleted", formatted);
      } else {
        this.gateway.emitOrdersUpdates("updated_order_items", formatted);
      }
    }

    return {
      success: true,
      message: `Order #${orderId} updated successfully`,
      updatedFields: dto,
    };
  }

  /**
   * Cambia la mesa de una orden (solo tipo table). Si la mesa destino tiene orden activa, se intercambian.
   */
  async changeTable(orderId: number, dto: ChangeTableDto) {
    const newTable = String(dto.newTable ?? '').trim();
    if (!newTable) throw new BadRequestException('newTable es requerido');

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'items.attributes'],
    });
    if (!order) throw new NotFoundException(`No se encontró la orden #${orderId}`);
    if (order.orderType !== 'table') throw new BadRequestException('Solo se puede cambiar mesa en órdenes tipo mesa');
    if (order.orderStatus === 'completed' || order.orderStatus === 'canceled') {
      throw new BadRequestException('No se puede cambiar mesa en una orden completada o cancelada');
    }

    const currentTable = String(order.address ?? '').trim();
    if (currentTable === newTable) {
      throw new BadRequestException('La orden ya está en esa mesa');
    }

    const otherOrder = await this.orderRepo.findOne({
      where: {
        address: newTable,
        orderType: 'table',
        orderStatus: Not(In(['completed', 'canceled'])),
      },
      relations: ['items', 'items.product', 'items.attributes'],
    });

    if (!otherOrder) {
      order.address = newTable;
      await this.orderRepo.save(order);
      const formatted = await this.mapOrderToGroupedFormat(order);
      this.gateway.emitOrdersUpdates('updated_order_items', formatted);
      return {
        success: true,
        message: `Orden movida a la mesa ${newTable}`,
        swapped: false,
      };
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Order);
      const o1 = await repo.findOne({ where: { id: order.id } });
      const o2 = await repo.findOne({ where: { id: otherOrder.id } });
      if (!o1 || !o2) throw new InternalServerErrorException('Orden no encontrada en transacción');
      o1.address = newTable;
      o2.address = currentTable;
      await repo.save(o1);
      await repo.save(o2);
    });

    const [updated1, updated2] = await Promise.all([
      this.orderRepo.findOne({
        where: { id: order.id },
        relations: ['items', 'items.product', 'items.attributes'],
      }),
      this.orderRepo.findOne({
        where: { id: otherOrder.id },
        relations: ['items', 'items.product', 'items.attributes'],
      }),
    ]);
    if (updated1) {
      const formatted = await this.mapOrderToGroupedFormat(updated1);
      this.gateway.emitOrdersUpdates('updated_order_items', formatted);
    }
    if (updated2) {
      const formatted = await this.mapOrderToGroupedFormat(updated2);
      this.gateway.emitOrdersUpdates('updated_order_items', formatted);
    }

    return {
      success: true,
      message: `Mesas intercambiadas: orden de mesa ${currentTable} → ${newTable}, orden de mesa ${newTable} → ${currentTable}`,
      swapped: true,
    };
  }

  /**
   * Convierte una orden en un formato agrupado por producto,
   * útil para cocina y frontend.
   *
   * @param order - Orden completa cargada con relaciones.
   * @returns Objeto con items ordenados y agrupados.
   */
  /**
   * Firma para ítem entrante (productId + atributos + note). Mismo criterio que en frontend.
   */
  private incomingItemSignature(item: {
    productId: number;
    note?: string | null;
    attributes?: Array<{ attributeName: string; attributeValue: string }>;
  }): string {
    const attrs = (item.attributes ?? []).slice().sort((a, b) => (a.attributeName || '').localeCompare(b.attributeName || ''));
    return `${item.productId}|${attrs.map((a) => `${a.attributeName}=${a.attributeValue}`).join(',')}|${item.note ?? ''}`;
  }

  /**
   * Deduplica el payload entrante (dto.items) por productId+atributos+note.
   * Evita crear ítems duplicados al editar o al eliminar si el front envía líneas repetidas.
   */
  private deduplicateIncomingUpdateItems<T extends { productId: number; note?: string | null; attributes?: Array<{ attributeName: string; attributeValue: string }> }>(items: T[]): T[] {
    if (!items?.length) return [];
    const seen = new Set<string>();
    return items.filter((it) => {
      const sig = this.incomingItemSignature(it);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }

  /**
   * TypeORM con relations ['items', 'items.attributes'] puede devolver ítems duplicados por los JOINs.
   * Deduplicar por id evita duplicar líneas al borrar, inventario y en la respuesta.
   */
  private deduplicateOrderItemsById(items: OrderItem[] | undefined): OrderItem[] {
    if (!items?.length) return [];
    const seen = new Set<number>();
    const out = items.filter((i) => {
      const id = i.id;
      if (id == null || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (out.length !== items.length) {
      console.log('[PPP-BACKEND] deduplicateOrderItemsById eliminó duplicados', { antes: items.length, despues: out.length });
    }
    return out;
  }

  private async mapOrderToGroupedFormat(order: Order): Promise<any> {
    const groupedItems: Record<number, any> = {};
    const items = this.deduplicateOrderItemsById(order.items);

    for (const item of items) {
      if (!item.product) continue;
      const productId = item.product.id;
      const productName = item.product.name;
      const code = item.product.code;
      const imageUrl = item.product.imageUrl;
      const rawUnit = (item as any).unitPrice ?? (item as any).unit_price;
      const price = rawUnit != null && rawUnit !== '' ? Number(rawUnit) : Number(item.product?.price ?? 0);

      const attributeMap = item.attributes?.reduce((acc, attr) => {
        acc[attr.attributeName] = attr.attributeValue;
        return acc;
      }, {} as Record<string, string>);

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

    // Convert createdAt from UTC to Bogotá timezone ISO string
    const createdAtBogota = formatToBogotaISO(order.createdAt);
    
    const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);

    const extrasList = (order as any).extras?.map((e: OrderExtra) => ({
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
    };
  }

  /**
   * Validates a redemption code (public method, no auth required).
   * Used by internal order apps to validate prize codes.
   * 
   * @param code - Redemption code
   * @returns Redemption prize if valid
   */
  async validateRedemptionCodePublic(code: string): Promise<any> {
    return await this.pointsService.validateRedemptionCode(code);
  }

  /**
   * Applies a redemption prize to an existing order.
   * Validates:
   * 1. The redemption code exists and is valid
   * 2. The order contains at least one product with code 2 or 5 (half chicken)
   * 3. The prize hasn't been used
   * 
   * @param orderId - Order ID
   * @param redemptionCode - Redemption code
   * @returns Updated order
   */
  async applyRedemptionVoucher(orderId: number, redemptionCode: string): Promise<Order> {
    // Find the order with items and products
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });

    if (!order) {
      throw new BadRequestException('Orden no encontrada');
    }

    // Check if order already has a redemption code
    if (order.redemptionCode) {
      throw new BadRequestException('This order already has a redemption prize applied');
    }

    // Validate redemption code
    const redemption = await this.pointsService.validateRedemptionCode(redemptionCode.toUpperCase().trim());

    // Check if order contains at least one product with code 2 or 5 (half chicken)
    const hasHalfChicken = order.items.some(item => {
      const productCode = item.product?.code;
      return productCode === 2 || productCode === 5;
    });

    if (!hasHalfChicken) {
      throw new BadRequestException(
        'To use a redemption prize, your order must include at least one half chicken (product code 2 or 5)'
      );
    }

    // Apply prize to order
    order.redemptionCode = redemption.code;

    // Recalculate points considering the prize discount
    // The prize discounts one half chicken, so we need to adjust point calculation
    const allCodes: number[] = [];
    for (const item of order.items) {
      if (item.product?.code) {
        allCodes.push(item.product.code);
      }
    }

    // Adjust codes: remove one instance of code 2 or 5 (the discounted one)
    let adjustedCodes = [...allCodes];
    const hasCode2 = adjustedCodes.includes(2);
    const hasCode5 = adjustedCodes.includes(5);
    
    if (hasCode2 && hasCode5) {
      // Remove one instance of code 2 or 5 (prefer code 2)
      const indexToRemove = adjustedCodes.indexOf(2);
      if (indexToRemove !== -1) {
        adjustedCodes.splice(indexToRemove, 1);
      } else {
        const index5 = adjustedCodes.indexOf(5);
        if (index5 !== -1) {
          adjustedCodes.splice(index5, 1);
        }
      }
    } else if (hasCode2) {
      const indexToRemove = adjustedCodes.indexOf(2);
      if (indexToRemove !== -1) {
        adjustedCodes.splice(indexToRemove, 1);
      }
    } else if (hasCode5) {
      const indexToRemove = adjustedCodes.indexOf(5);
      if (indexToRemove !== -1) {
        adjustedCodes.splice(indexToRemove, 1);
      }
    }

    const newPoints = this.pointsService.calculatePointsFromCodes(adjustedCodes);
    const oldPoints = order.points || 0;

    // Update points in order
    order.points = newPoints;

    // If points decreased, we need to remove excess point codes
    if (newPoints < oldPoints) {
      const pointsToRemove = oldPoints - newPoints;
      const pointCodes = await this.pointsService.getPointCodesByOrderId(orderId);
      
      // Delete the excess point codes (oldest first)
      if (pointCodes.length > newPoints) {
        const codesToDelete = pointCodes.slice(0, pointsToRemove);
        const pointsRepo = this.dataSource.getRepository(UserPoints);
        for (const codeToDelete of codesToDelete) {
          await pointsRepo.delete({ code: codeToDelete });
        }
      }
    }

    // Mark redemption as used
    await this.pointsService.applyRedemptionToOrder(redemption.code, orderId);

    // Save updated order
    await this.orderRepo.save(order);

    // Fetch full order with relations for socket emission
    const fullOrder = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['items', 'items.product', 'items.attributes'],
    });

    if (fullOrder) {
      // Format order and emit socket event to update frontend in real-time
      const formatted = await this.mapOrderToGroupedFormat(fullOrder);
      this.gateway.emitOrdersUpdates("updated_order_items", formatted);
    }

    return order;
  }

  /**
   * Obtiene datos breves de órdenes por IDs (para listados de puntos u otros reportes).
   */
  async getOrdersBrief(orderIds: number[]): Promise<Array<{ id: number; dailyOrderNumber: number; createdAt: Date }>> {
    if (!orderIds?.length) return [];
    const uniq = [...new Set(orderIds)];
    const orders = await this.orderRepo.find({
      where: { id: In(uniq) },
      select: ['id', 'dailyOrderNumber', 'createdAt'],
    });
    return orders;
  }

  /**
   * Obtiene órdenes de una fecha específica (Bogotá timezone).
   * Excluye canceladas.
   * 
   * @param date - Fecha en formato YYYY-MM-DD (Bogotá timezone)
   * @returns Lista de órdenes formateadas
   */
  async findOrdersByDate(date: string): Promise<any[]> {
    // Parse date string (YYYY-MM-DD) - interpret as Bogotá timezone
    // The issue: new Date('YYYY-MM-DD') interprets as UTC midnight, causing off-by-one day errors
    // Solution: Create date strings with explicit Bogotá timezone offset
    const [year, month, day] = date.split('-').map(Number);
    
    // Create date strings with explicit Bogotá timezone: 'YYYY-MM-DDTHH:mm:ss-05:00'
    // Bogotá is UTC-5 (no DST), so we use -05:00 offset
    // This ensures the date is interpreted as midnight in Bogotá, not UTC
    const startBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`;
    const endBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999-05:00`;
    
    // Convert to UTC for database query
    // The Date object created from the string with -05:00 offset already represents the correct UTC time
    const startUtc = new Date(startBogotaString);
    const endUtc = new Date(endBogotaString);

    const orders = await this.orderRepo.find({
      where: {
        createdAt: Between(startUtc, endUtc),
        orderStatus: Not('canceled'),
      },
      relations: ['items', 'items.product', 'items.attributes', 'extras'],
      order: { createdAt: 'DESC' },
    });

    const ordersWithPointCodes = await Promise.all(
      orders.map(async (order) => {
        const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
        const pointsValue = order.points ?? pointCodes.length ?? 0;
        return { order, pointCodes, pointsValue };
      })
    );

    const mappedOrders = await Promise.all(
      ordersWithPointCodes.map(async ({ order, pointCodes, pointsValue }) => {
        const formatted = await this.mapOrderToGroupedFormat(order);
        return { ...formatted, points: pointsValue, pointCodes };
      })
    );

    return mappedOrders;
  }

  /**
   * Obtiene el resumen/corte de caja del día.
   * Calcula totales, cantidad de órdenes, etc.
   * 
   * @param date - Fecha en formato YYYY-MM-DD (Bogotá timezone). Si no se proporciona, usa hoy.
   * @returns Resumen del día
   */
  async getDailySummary(date?: string): Promise<any> {
    let startUtc: Date;
    let endUtc: Date;

    if (date) {
      // Parse date string (YYYY-MM-DD) - interpret as Bogotá timezone
      // The issue: new Date('YYYY-MM-DD') interprets as UTC midnight, causing off-by-one day errors
      // Solution: Create date strings with explicit Bogotá timezone offset
      const [year, month, day] = date.split('-').map(Number);
      
      // Create date strings with explicit Bogotá timezone: 'YYYY-MM-DDTHH:mm:ss-05:00'
      // Bogotá is UTC-5 (no DST), so we use -05:00 offset
      const startBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`;
      const endBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999-05:00`;
      
      // Convert to UTC for database query
      // The Date object created from the string with -05:00 offset already represents the correct UTC time
      startUtc = new Date(startBogotaString);
      endUtc = new Date(endBogotaString);
    } else {
      // Use today
      const { start, end } = getBogotaDayRange();
      startUtc = start;
      endUtc = end;
    }

    const orders = await this.orderRepo.find({
      where: {
        createdAt: Between(startUtc, endUtc),
        orderStatus: Not('canceled'),
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

    const ordersByType: Record<string, number> = {
      delivery: 0,
      pickup: 0,
      table: 0,
      counter: 0,
      rappi: 0,
    };

    const productsSold: Record<number, { code: number; name: string; quantity: number; totalRevenue: number }> = {};

    for (const order of orders) {
      let orderSubtotal = 0;
      for (const item of order.items) {
        if (!item.product) continue;
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
      for (const ex of (order as any).extras ?? []) {
        orderSubtotal += Number(ex.amount) * (ex.quantity ?? 1);
      }

      if (order.orderType === 'delivery' && order.deliveryFee) {
        totalDeliveryFees += Number(order.deliveryFee);
      }

      if (order.redemptionCode) {
        const halfChickenItem = order.items.find(
          item => item.product && (item.product.code === 2 || item.product.code === 5)
        );
        if (halfChickenItem && halfChickenItem.product) {
          const product = allProducts.find(p => p.id === halfChickenItem.product.id);
          if (product) {
            const premioPrice = Number(halfChickenItem.unitPrice ?? product.price);
            totalPremioDiscounts += premioPrice;
            // Adjust product revenue (one less sale due to discount)
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

    // Convert productsSold to array and sort by code
    const productsSoldArray = Object.values(productsSold).sort((a, b) => a.code - b.code);

    return {
      date: date || formatInTimeZone(new Date(), 'America/Bogota', 'yyyy-MM-dd'),
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
        createdAt: formatToBogotaISO(o.createdAt),
      })),
    };
  }

  /**
   * Obtiene el reporte de ventas entre dos fechas (Bogotá timezone).
   *
   * @param from - Fecha inicio YYYY-MM-DD
   * @param to - Fecha fin YYYY-MM-DD
   * @returns Resumen agregado del periodo + desglose por día
   */
  async getSalesReport(from: string, to: string): Promise<any> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
    }

    const { start: startUtc } = getBogotaDateRange(from);
    const { end: endUtc } = getBogotaDateRange(to);
    if (startUtc > endUtc) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha fin');
    }

    const orders = await this.orderRepo.find({
      where: {
        createdAt: Between(startUtc, endUtc),
        orderStatus: Not('canceled'),
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

    const ordersByType: Record<string, number> = {
      delivery: 0,
      pickup: 0,
      table: 0,
      counter: 0,
      rappi: 0,
    };
    const revenueByOrderType: Record<string, number> = {
      delivery: 0,
      pickup: 0,
      table: 0,
      counter: 0,
      rappi: 0,
    };

    type ProductSold = {
      code: number;
      name: string;
      quantity: number;
      totalRevenue: number;
      categoryId?: number;
      categoryName?: string;
    };
    const productsSold: Record<number, ProductSold> = {};
    const dailyBreakdown: Record<string, { total: number; orders: number; dayOfWeek: string }> = {};
    const hourlyBreakdown: Record<number, { orders: number; total: number }> = {};
    for (let h = 0; h < 24; h++) hourlyBreakdown[h] = { orders: 0, total: 0 };

    const TICKET_BUCKETS = [0, 20000, 50000, 100000, 200000, Infinity];
    const ticketDistribution: { min: number; max: number; label: string; count: number }[] = [
      { min: 0, max: 20000, label: 'Hasta $20k', count: 0 },
      { min: 20000, max: 50000, label: '$20k - $50k', count: 0 },
      { min: 50000, max: 100000, label: '$50k - $100k', count: 0 },
      { min: 100000, max: 200000, label: '$100k - $200k', count: 0 },
      { min: 200000, max: Infinity, label: 'Más de $200k', count: 0 },
    ];

    const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (const order of orders) {
      const orderDate = formatInTimeZone(order.createdAt, 'America/Bogota', 'yyyy-MM-dd');
      const dayOfWeek = DAY_NAMES[new Date(orderDate + 'T12:00:00').getDay()];
      if (!dailyBreakdown[orderDate]) {
        dailyBreakdown[orderDate] = { total: 0, orders: 0, dayOfWeek };
      }
      dailyBreakdown[orderDate].orders += 1;

      let orderSubtotal = 0;
      let orderDelivery = 0;
      let orderPremio = 0;

      for (const item of order.items) {
        if (!item.product) continue;
        const product = allProducts.find(p => p.id === item.product.id);
        if (product) {
          const itemPrice = Number(item.unitPrice ?? product.price);
          orderSubtotal += itemPrice;
          totalItemsSold += 1;
          const cat = (product as any).categories?.[0];
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
      for (const ex of (order as any).extras ?? []) {
        orderSubtotal += Number(ex.amount) * (ex.quantity ?? 1);
      }

      if (order.orderType === 'delivery' && order.deliveryFee) {
        orderDelivery = Number(order.deliveryFee);
        totalDeliveryFees += orderDelivery;
      }

      if (order.redemptionCode) {
        ordersWithPremio += 1;
        const halfChickenItem = order.items.find(
          item => item.product && (item.product.code === 2 || item.product.code === 5)
        );
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
      const ot = order.orderType as string;
      revenueByOrderType[ot] = (revenueByOrderType[ot] || 0) + orderTotal;

      const hour = parseInt(formatInTimeZone(order.createdAt, 'America/Bogota', 'H'), 10);
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

    const byCategory = new Map<number, ProductSold[]>();
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

    const averageTicketByOrderType: Record<string, number> = {};
    for (const [type, count] of Object.entries(ordersByType)) {
      const rev = revenueByOrderType[type] ?? 0;
      averageTicketByOrderType[type] = count > 0 ? rev / count : 0;
    }

    let previousPeriod: { from: string; to: string; totalOrders: number; total: number } | null = null;
    const fromDate = new Date(from + 'T12:00:00');
    const toDate = new Date(to + 'T12:00:00');
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const prevEndDate = new Date(fromDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - diffDays + 1);
    const prevFrom = prevStartDate.toISOString().slice(0, 10);
    const prevTo = prevEndDate.toISOString().slice(0, 10);
    if (prevStartDate < prevEndDate) {
      const { start: prevStartUtc } = getBogotaDateRange(prevFrom);
      const { end: prevEndUtc } = getBogotaDateRange(prevTo);
      const prevOrders = await this.orderRepo.find({
        where: {
          createdAt: Between(prevStartUtc, prevEndUtc),
          orderStatus: Not('canceled'),
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
            if (product) orderSubtotal += Number(item.unitPrice ?? product.price);
          }
        }
        for (const ex of (order as any).extras ?? []) {
          orderSubtotal += Number(ex.amount) * (ex.quantity ?? 1);
        }
        if (order.orderType === 'delivery' && order.deliveryFee) orderDelivery = Number(order.deliveryFee);
        if (order.redemptionCode) {
          const halfChickenItem = order.items.find(
            item => item.product && (item.product.code === 2 || item.product.code === 5)
          );
          if (halfChickenItem?.product) {
            const product = allProducts.find(p => p.id === halfChickenItem.product.id);
            if (product) orderPremio = Number(halfChickenItem.unitPrice ?? product.price);
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

  /**
   * Backfill unit_price for all order items where unit_price IS NULL,
   * setting it to the current product price. Used for historical data.
   * Returns the number of rows updated.
   */
  async backfillUnitPrices(): Promise<{ updated: number }> {
    const result = await this.dataSource.query(
      `UPDATE ppp_order_items oi
       INNER JOIN ppp_products p ON oi.product_id = p.id
       SET oi.unit_price = p.price
       WHERE oi.unit_price IS NULL`,
    );
    const raw = result as { affectedRows?: number; affected?: number; rowCount?: number } | undefined;
    const updated = typeof raw?.affectedRows === 'number' ? raw.affectedRows
      : typeof raw?.affected === 'number' ? raw.affected
      : typeof raw?.rowCount === 'number' ? raw.rowCount
      : 0;
    return { updated };
  }
}
