import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Between, Not, Repository, DataSource, EntityManager, In } from 'typeorm';
import { AddOrderExtraDto, CreateOrderDto, UpdateOrderExtraDto, UpdateOrderGeneralDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderExtra } from './entities/order-extra.entity';
import { OrdersGateway } from './Websocket/order.gateway';
import { getBogotaDayRange, formatToBogotaISO, transformDatesToBogota } from '../common/utils/date.util';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { PointsService } from '../auth/services/points.service';
import { User } from '../auth/entities/user.entity';
import { UserPoints } from '../auth/entities/user-points.entity';
import { MailService } from '../common/mail/mail.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';

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

    // Get today's range in Bogotá timezone, converted to UTC for database query
    const { start: todayStartUtc, end: todayEndUtc } = getBogotaDayRange();

    // Validate delivery fee
    let finalDeliveryFee = 0;
    if (orderType === 'delivery') {
      if (deliveryFee == null) {
        throw new BadRequestException('Delivery fee is required for delivery orders');
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
          'Order number conflict detected. Please try again.'
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

      // Calculate points from product codes only (extras do not generate points)
      const allCodes: number[] = [];
      if (items?.length) {
        for (const item of items) {
          const product = await this.productRepo.findOne({
            where: { id: item.productId },
            select: ['code'],
          });
          if (product) {
            allCodes.push(product.code);
          }
        }
      }

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

      // Create items and attributes
      if (items?.length) {
        for (const item of items) {
          const orderItem = queryRunner.manager.create(OrderItem, {
            order: savedOrder,
            product: { id: item.productId },
            note: item.note,
          });

          const savedItem = await queryRunner.manager.save(orderItem);

          if (item.attributes?.length) {
            const attrs = item.attributes.map(attr =>
              queryRunner.manager.create(OrderItemAttribute, {
                orderItem: savedItem,
                attributeName: attr.attributeName,
                attributeValue: attr.attributeValue,
              })
            );
            await queryRunner.manager.save(attrs);
          }
        }
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
            // Use DataSource repository directly since transaction is committed
            const pointsRepo = this.dataSource.getRepository(UserPoints);
            for (let i = 0; i < calculatedPoints; i++) {
              const code = await this.pointsService.generateUniquePointCode();
              const pointRecord = pointsRepo.create({
                code,
                userId: null, // Not assigned yet
                orderId: savedOrder.id,
                orderDailyNumber: newOrderNumber,
                isUsed: false,
                type: 'automatic',
                description: `Punto de orden #${newOrderNumber}`,
              });
              await pointsRepo.save(pointRecord);
            }
          }
        } catch {
          // Don't fail order creation if point code generation fails
        }
      }

      const fullOrder = await this.orderRepo.findOne({
        where: { id: savedOrder.id },
        relations: ['items', 'items.product', 'items.attributes', 'extras'],
      });

      // Apply redemption prize if provided
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
              const price = Number(item.product?.price || 0);
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
          'An order with this number already exists. Please try again.'
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
  async findOrdersToday() {
    return this.circuitBreaker.execute(
      async () => {
        const { start: todayStartUtc, end: todayEndUtc } = getBogotaDayRange();
        const orders = await this.orderRepo.find({
          where: {
            createdAt: Between(todayStartUtc, todayEndUtc),
            orderStatus: Not('canceled'),
          },
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
        // Validate product exists before accessing properties
        if (!item.product) {
          console.warn(`[mapOrderToGroupedFormat] Order ${order.id} has item without product relation`);
          continue; // Skip items without product
        }
        const productId = item.product.id;
        const productName = item.product.name;
        const code = item.product.code;
        const imageUrl = item.product.imageUrl;
        const price = item.product.price;

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

    if (!order) throw new Error(`Order with ID ${orderId} not found`);

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
      message: `Order #${orderId} marked as canceled`,
    };
  }

  /**
   * Actualiza solamente los productos (items) de una orden.
   * Elimina los items existentes y los vuelve a crear.
   * Si queda sin items → la orden se cancela.
   *
   * @param orderId - ID de la orden.
   * @param dto - Lista de nuevos items.
   */
  async updateOrderItems(orderId: number, dto: UpdateOrderItemsDto) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.attributes'],
    });

    if (!order) throw new Error(`Order not found`);

    for (const item of order.items) {
      await this.attrRepo.delete({ orderItem: { id: item.id } });
      await this.itemRepo.delete(item.id);
    }

    const hasItems = dto.items?.length;
    const hasExtrasToAdd = dto.extrasToAdd?.length;

    if (!hasItems && !hasExtrasToAdd) {
      order.orderStatus = 'canceled';
      await this.orderRepo.save(order);
      try {
        await this.pointsService.invalidatePointsForCanceledOrder(orderId);
      } catch {
        // Don't fail order cancellation if point invalidation fails
      }
      this.gateway.emitOrdersUpdates("deleted_order", order);
      return {
        success: true,
        message: `Order #${orderId} was canceled because no items remained`,
      };
    }

    for (const itemDto of dto.items ?? []) {
      const orderItem = this.itemRepo.create({
        order,
        product: { id: itemDto.productId },
        note: itemDto.note,
      });

      await this.itemRepo.save(orderItem);

      if (itemDto.attributes?.length) {
        const attributes = itemDto.attributes.map(attr =>
          this.attrRepo.create({
            orderItem,
            attributeName: attr.attributeName,
            attributeValue: attr.attributeValue,
          })
        );
        await this.attrRepo.save(attributes);
      }
    }

    // Agregar extras (adicionales, código 90)
    if (dto.extrasToAdd?.length) {
      for (const ex of dto.extrasToAdd) {
        const extra = this.extraRepo.create({
          order,
          title: ex.title,
          description: ex.description ?? null,
          amount: ex.amount,
          quantity: ex.quantity ?? 1,
        });
        await this.extraRepo.save(extra);
      }
    }

    const fullOrder = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['items', 'items.product', 'items.attributes', 'extras'],
    });

    if (fullOrder) {
      // Recalculate points after updating items
      const allCodes: number[] = [];
      for (const item of fullOrder.items) {
        // Each item is a single unit, so just add the code once per item
        allCodes.push(item.product.code);
      }

      const recalculatedPoints = this.pointsService.calculatePointsFromCodes(allCodes);
      
      // Update order points count
      fullOrder.points = recalculatedPoints;
      await this.orderRepo.save(fullOrder);
      
      // Regenerate point codes if the number of points changed
      // This ensures the printed codes match the current order items
      // IMPORTANT: Do this BEFORE calling mapOrderToGroupedFormat so it gets updated codes
      try {
        await this.pointsService.updatePointCodesForOrder(
          fullOrder.id,
          fullOrder.dailyOrderNumber,
          recalculatedPoints
        );
      } catch {
        // Don't fail order update if point code update fails
      }

      const refreshedOrder = await this.orderRepo.findOne({
        where: { id: fullOrder.id },
        relations: ['items', 'items.product', 'items.attributes', 'extras'],
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

  /**
   * Añade un adicional (extra) a una orden existente.
   */
  async addExtra(orderId: number, dto: AddOrderExtraDto) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, orderStatus: Not('canceled') },
    });
    if (!order) throw new NotFoundException('Order not found or canceled');
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
    if (!extra || extra.order?.id !== orderId) throw new NotFoundException('Extra not found or does not belong to order');
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
    if (!extra || extra.order?.id !== orderId) throw new NotFoundException('Extra not found or does not belong to order');
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
    if (!order) throw new Error('Order not found');

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
   * Convierte una orden en un formato agrupado por producto,
   * útil para cocina y frontend.
   *
   * @param order - Orden completa cargada con relaciones.
   * @returns Objeto con items ordenados y agrupados.
   */
  private async mapOrderToGroupedFormat(order: Order): Promise<any> {
    const groupedItems: Record<number, any> = {};

    for (const item of order.items) {
      // Validate product exists before accessing properties
      if (!item.product) {
        console.warn(`[mapOrderToGroupedFormat] Order ${order.id} has item without product relation`);
        continue; // Skip items without product
      }
      const productId = item.product.id;
      const productName = item.product.name;
      const code = item.product.code;
      const imageUrl = item.product.imageUrl;
      const price = item.product.price;

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
      throw new BadRequestException('Order not found');
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

    const allProducts = await this.productRepo.find();

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
        if (!item.product) {
          console.warn(`[getDailySummary] Order has item without product relation`);
          continue; // Skip items without product
        }
        const product = allProducts.find(p => p.id === item.product.id);
        if (product) {
          orderSubtotal += Number(product.price);
          if (!productsSold[product.code]) {
            productsSold[product.code] = {
              code: product.code,
              name: product.name,
              quantity: 0,
              totalRevenue: 0,
            };
          }
          productsSold[product.code].quantity += 1;
          productsSold[product.code].totalRevenue += Number(product.price);
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
            totalPremioDiscounts += Number(product.price);
            // Adjust product revenue (one less sale due to discount)
            if (productsSold[product.code]) {
              productsSold[product.code].totalRevenue -= Number(product.price);
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
}
