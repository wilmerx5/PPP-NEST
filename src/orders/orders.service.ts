import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Product } from 'src/products/entities/product.entity';
import { Between, Not, Repository } from 'typeorm';
import { CreateOrderDto, UpdateOrderGeneralDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersGateway } from './Websocket/order.gateway';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,

    @InjectRepository(OrderItemAttribute)
    private readonly attrRepo: Repository<OrderItemAttribute>,

    @InjectRepository(OrderItemAttribute)
    private readonly productRepo: Repository<Product>,

    private readonly gateway: OrdersGateway,
  ) {}

  /**
   * Zona horaria configurada para Bogotá.
   */
  private readonly timeZone = 'America/Bogota';

  /**
   * Calcula el rango del día actual en la zona horaria de Bogotá.
   * Se utiliza para calcular pedidos diarios (#1, #2, #3…).
   *
   * @returns Object con el inicio y fin del día en formato UTC.
   */
  private getTodayUtcRange(): { todayStartUtc: Date; todayEndUtc: Date } {
    const nowInBogota = toZonedTime(new Date(), this.timeZone);
    const startOfBogotaDay = startOfDay(nowInBogota);
    const endOfBogotaDay = endOfDay(nowInBogota);

    return { todayStartUtc: startOfBogotaDay, todayEndUtc: endOfBogotaDay };
  }

  /**
   * Crea una nueva orden con sus items y atributos.
   *
   * Flujo:
   * 1. Se calcula el número de pedido del día.
   * 2. Se crea la orden.
   * 3. Se crean los items.
   * 4. Se crean los atributos de cada item.
   * 5. Se notifica por WebSocket a cocina.
   *
   * @param createOrderDto - Datos de la orden y sus productos.
   * @returns Detalle de creación con ID y número diario.
   */
  async create(createOrderDto: CreateOrderDto) {
    const { customerName, phone, address, items } = createOrderDto;
    const { todayStartUtc, todayEndUtc } = this.getTodayUtcRange();

    // Contar cuántos pedidos van hoy
    const ordersTodayCount = await this.orderRepo.count({
      where: { createdAt: Between(todayStartUtc, todayEndUtc) },
    });

    const newOrderNumber = ordersTodayCount + 1;

    // Crear orden
    const order = this.orderRepo.create({
      customerName,
      phone,
      address,
      dailyOrderNumber: newOrderNumber,
      orderType: createOrderDto.orderType ?? 'pickup',
    });

    await this.orderRepo.save(order);

    // Crear items y atributos
    for (const item of items) {
      const orderItem = this.itemRepo.create({
        order,
        product: { id: item.productId },
        note: item.note,
      });
      await this.itemRepo.save(orderItem);

      if (item.attributes?.length) {
        const attrs = item.attributes.map(attr =>
          this.attrRepo.create({
            orderItem,
            attributeName: attr.attributeName,
            attributeValue: attr.attributeValue,
          })
        );
        await this.attrRepo.save(attrs);
      }
    }

    const fullOrder = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['items', 'items.product', 'items.attributes'],
    });

    if (fullOrder) {
      const formatted = this.mapOrderToGroupedFormat(fullOrder);
      this.gateway.emitOrdersUpdates("created_order", formatted);
    }

    return {
      success: true,
      orderId: order.id,
      dailyOrderNumber: newOrderNumber,
    };
  }

  /**
   * Obtiene todas las órdenes del día en Bogotá,
   * excluyendo las canceladas.
   * Agrupa items repetidos por producto.
   *
   * @returns Lista de órdenes formateadas.
   */
  async findOrdersToday() {
    const { todayStartUtc, todayEndUtc } = this.getTodayUtcRange();

    const orders = await this.orderRepo.find({
      where: {
        createdAt: Between(todayStartUtc, todayEndUtc),
        orderStatus: Not('canceled'),
      },
      relations: ['items', 'items.product', 'items.attributes'],
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => {
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
        createdAt: order.createdAt,
        orderType: order.orderType,
        orderStatus: order.orderStatus,
        printed: order.printed,
        items: Object.values(groupedItems),
      };
    });
  }

  /**
   * Marca una orden como cancelada.
   * Notifica por WebSocket.
   *
   * @param orderId - ID de la orden a cancelar.
   */
  async removeOrder(orderId: number) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });

    if (!order) throw new Error(`Order with ID ${orderId} not found`);

    order.orderStatus = 'canceled';
    await this.orderRepo.save(order);

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
      const formatted = this.mapOrderToGroupedFormat(fullOrder);
      this.gateway.emitOrdersUpdates("updated_order_items", formatted);
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

    // Actualiza solo campos enviados
    if (dto.customerName !== undefined) order.customerName = dto.customerName;
    if (dto.phone !== undefined) order.phone = dto.phone;
    if (dto.address !== undefined) order.address = dto.address;
    if (dto.orderType !== undefined) order.orderType = dto.orderType;
    if (dto.orderStatus !== undefined) order.orderStatus = dto.orderStatus;
    if (dto.printed !== undefined) order.printed = dto.printed;

    await this.orderRepo.save(order);

    const fullOrder = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['items', 'items.product', 'items.attributes'],
    });

    if (fullOrder) {
      const formatted = this.mapOrderToGroupedFormat(fullOrder);

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
  private mapOrderToGroupedFormat(order: Order): any {
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
      items: Object.values(groupedItems),
    };
  }
}
