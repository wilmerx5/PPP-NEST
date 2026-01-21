import { Injectable, BadRequestException, InternalServerErrorException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Between, Not, Repository, DataSource, EntityManager, In } from 'typeorm';
import { CreateOrderDto, UpdateOrderGeneralDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersGateway } from './Websocket/order.gateway';
import { getBogotaDayRange, formatToBogotaISO, transformDatesToBogota } from '../common/utils/date.util';
import { PointsService } from '../auth/services/points.service';
import { User } from '../auth/entities/user.entity';
import { UserPoints } from '../auth/entities/user-points.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,

    @InjectRepository(OrderItemAttribute)
    private readonly attrRepo: Repository<OrderItemAttribute>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly gateway: OrdersGateway,
    
    private readonly dataSource: DataSource,

    @Inject(forwardRef(() => PointsService))
    private readonly pointsService: PointsService,
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
    const { customerName, phone, address, items, customerEmail, orderSource, redemptionCode } = createOrderDto;
    const orderType = createOrderDto.orderType ?? 'pickup';
    const deliveryFee = createOrderDto.deliveryFee;
    const source = orderSource ?? 'internal';

    // Validate items
    if (!items || items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
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

      // Calculate points before saving order
      // Get all product codes (each item represents one unit)
      const allCodes: number[] = [];
      
      for (const item of items) {
        const product = await this.productRepo.findOne({
          where: { id: item.productId },
          select: ['code'],
        });
        if (product) {
          // Each item in the array represents one unit, so add the code once per item
          allCodes.push(product.code);
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
        } catch (error) {
          // Log error but don't fail order creation if point code generation fails
          console.error('Error creating point codes:', error);
        }
      }

      // Fetch full order with relations
      const fullOrder = await this.orderRepo.findOne({
        where: { id: savedOrder.id },
        relations: ['items', 'items.product', 'items.attributes'],
      });

      // Apply redemption prize if provided
      if (redemptionCode && redemptionCode.trim()) {
        try {
          await this.applyRedemptionVoucher(savedOrder.id, redemptionCode.trim());
          console.log(`✅ [Order Create] Redemption prize ${redemptionCode} applied successfully to order #${newOrderNumber}`);
        } catch (prizeError: any) {
          // Log error but don't fail order creation if prize fails
          console.error(`❌ [Order Create] Failed to apply redemption prize:`, prizeError?.message || prizeError);
          // Order is created but without prize applied
        }
      }

      // Reload order to get updated redemption code
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
    // Get today's range in Bogotá timezone, converted to UTC for database query
    const { start: todayStartUtc, end: todayEndUtc } = getBogotaDayRange();

    const orders = await this.orderRepo.find({
      where: {
        createdAt: Between(todayStartUtc, todayEndUtc),
        orderStatus: Not('canceled'),
      },
      relations: ['items', 'items.product', 'items.attributes'],
      order: { createdAt: 'DESC' },
    });
    
    // Debug: Log to verify points and redemptionCode fields are loaded from DB
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

    // Get point codes for all orders in parallel
    const ordersWithPointCodes = await Promise.all(
      orders.map(async (order) => {
        const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
        // Ensure points is set - if null/undefined, use pointCodes length as fallback
        // This handles orders created before points field was added
        const dbPoints = order.points;
        const pointsValue = (dbPoints !== null && dbPoints !== undefined) ? dbPoints : (pointCodes.length || 0);
        
        // Log for debugging (can be removed later)
        if (dbPoints === null || dbPoints === undefined) {
          console.log(`[findOrdersToday] Order #${order.dailyOrderNumber} has null/undefined points, using pointCodes.length: ${pointCodes.length}`);
        }
        
        return { order, pointCodes, pointsValue };
      })
    );

    // Use mapOrderToGroupedFormat to ensure consistency and include redemptionCode
    const mappedOrders = await Promise.all(
      ordersWithPointCodes.map(async ({ order, pointCodes, pointsValue }) => {
        const formatted = await this.mapOrderToGroupedFormat(order);
        // Override points with the calculated pointsValue (which handles null/undefined)
        return {
          ...formatted,
          points: pointsValue,
          pointCodes,
        };
      })
    );

    return mappedOrders;
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
      relations: ['items', 'items.product', 'items.attributes'],
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

      return {
        orderId: order.id,
        dailyOrderNumber: order.dailyOrderNumber,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        createdAt: createdAtBogota, // Already in Bogotá timezone ISO string
        orderType: order.orderType,
        orderStatus: order.orderStatus,
        printed: order.printed,
        deliveryFee: order.deliveryFee ?? 0,
        orderSource: order.orderSource ?? 'internal',
        points: pointsValue, // Use calculated value (from DB or pointCodes.length)
        pointCodes: pointCodes, // Array of point codes
        items: Object.values(groupedItems),
        redemptionCode: order.redemptionCode ?? null, // Include redemption code if applied
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
    } catch (error) {
      console.error('Error invalidating points for canceled order:', error);
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

    // Eliminar items y atributos actuales
    for (const item of order.items) {
      await this.attrRepo.delete({ orderItem: { id: item.id } });
      await this.itemRepo.delete(item.id);
    }

    // Si no hay items → cancelar orden
    if (!dto.items?.length) {
      order.orderStatus = 'canceled';
      await this.orderRepo.save(order);

      // Invalidate points for canceled order
      try {
        await this.pointsService.invalidatePointsForCanceledOrder(orderId);
      } catch (error) {
        console.error('Error invalidating points for canceled order:', error);
        // Don't fail order cancellation if point invalidation fails
      }

      this.gateway.emitOrdersUpdates("deleted_order", order);

      return {
        success: true,
        message: `Order #${orderId} was canceled because no items remained`,
      };
    }

    // Crear nuevos items
    for (const itemDto of dto.items) {
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

    const fullOrder = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['items', 'items.product', 'items.attributes'],
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
      } catch (error) {
        // Log error but don't fail order update if point code update fails
        console.error('Error updating point codes:', error);
      }

      // Reload order to ensure we have latest data including updated point codes
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
      } catch (error) {
        console.error('Error invalidating points for canceled order:', error);
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
    
    // Get point codes for this order
    const pointCodes = await this.pointsService.getPointCodesByOrderId(order.id);
    
    return {
      orderId: order.id,
      dailyOrderNumber: order.dailyOrderNumber,
      customerName: order.customerName,
      phone: order.phone,
      address: order.address,
      createdAt: createdAtBogota, // Already in Bogotá timezone ISO string
      orderType: order.orderType,
      orderStatus: order.orderStatus,
      printed: order.printed,
      deliveryFee: order.deliveryFee ?? 0,
      orderSource: order.orderSource ?? 'internal',
      points: order.points ?? 0,
      pointCodes: pointCodes, // Array of point codes (12-char alphanumeric)
      items: Object.values(groupedItems),
      redemptionCode: order.redemptionCode ?? null, // Explicitly include, even if null
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
      console.log(`✅ [Apply Premio] Prize ${redemption.code} applied to order #${order.dailyOrderNumber}`);
    }

    return order;
  }
}
