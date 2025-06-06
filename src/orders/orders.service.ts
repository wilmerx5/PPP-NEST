import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Product } from 'src/products/entities/product.entity';
import { Between, Repository } from 'typeorm';
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
  ) { }
  
   private readonly timeZone = 'America/Bogota';

 
  private getTodayUtcRange(): { todayStartUtc: Date, todayEndUtc: Date } {
    // 1. Obtener la fecha y hora actual en la zona horaria de Bogotá (como Date object)
    const nowInBogota = toZonedTime(new Date(), this.timeZone);
    const startOfBogotaDay = startOfDay(nowInBogota); // Esto ya es un Date object
    const endOfBogotaDay = endOfDay(nowInBogota);     // Esto ya es un Date object

 

    return { todayStartUtc: startOfBogotaDay, todayEndUtc: endOfBogotaDay };
  }
  async create(createOrderDto: CreateOrderDto) {
    const { customerName, phone, address, items } = createOrderDto;
      const { todayStartUtc, todayEndUtc } = this.getTodayUtcRange();

    const ordersTodayCount = await this.orderRepo.count({
      where: {
        createdAt: Between(todayStartUtc, todayEndUtc),
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
        note: item.note, // ✅ Save the note
      });
      await this.itemRepo.save(orderItem);

      if (item.attributes && item.attributes.length > 0) {
        const attrs = item.attributes.map((attr) =>
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
        createdAt: Between(todayStartUtc, todayEndUtc),
          canceled: false,
      },
      relations: ['items', 'items.product', 'items.attributes'],
      order: {
        createdAt: 'DESC',
      },
    });

    return orders.map((order) => {
      const groupedItems: Record<number, any> = {};

      for (const item of order.items) {
        const productId = item.product.id;
        const productName = item.product.name;
        const code = item.product.code

        const attributeMap = item.attributes?.reduce((acc, attr) => {
          acc[attr.attributeName] = attr.attributeValue;
          return acc;
        }, {} as Record<string, string>);

        if (!groupedItems[productId]) {
          groupedItems[productId] = {
            productId,
            productName,
            quantity: 0,
            code:code,
            variants: [],
          };
        }

        groupedItems[productId].quantity += 1;
        groupedItems[productId].variants.push({
          note: item.note || null, // Include the note per unit
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
        printed:order.printed,
        canceled: order.canceled,
        items: Object.values(groupedItems)
      };
    });
  }

async removeOrder(orderId: number) {
  const order = await this.orderRepo.findOne({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error(`Order with ID ${orderId} not found`);
  }

  order.canceled = true;
  await this.orderRepo.save(order);

  this.gateway.emitOrdersUpdates("deleted_order", order);

  return {
    success: true,
    message: `Order #${orderId} marked as canceled`,
  };
}


  async updateOrderItems(orderId: number, dto: UpdateOrderItemsDto) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.attributes'],
    });

    if (!order) throw new Error(`Order not found`);

    // 1. Remove all existing items and their attributes
    for (const item of order.items) {
      await this.attrRepo.delete({ orderItem: { id: item.id } });
      await this.itemRepo.delete(item.id);
    }

    // 2. If the new list is empty, delete the order itself
    if (!dto.items || dto.items.length === 0) {
      await this.orderRepo.delete(orderId);
      this.gateway.emitOrdersUpdates("deleted_order", order);
      return {
        success: true,
        message: `Order #${orderId} deleted because item list was empty`,
      };
    }

    // 3. Recreate items and attributes
    for (const itemDto of dto.items) {
      const orderItem = this.itemRepo.create({
        order,
        product: { id: itemDto.productId },
        note: itemDto.note, // ✅ Include note here
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
      const formattedOrder = this.mapOrderToGroupedFormat(fullOrder);
      this.gateway.emitOrdersUpdates("updated_order_items", formattedOrder);
    }

    return {
      success: true,
      message: `Order #${fullOrder?.dailyOrderNumber} updated successfully`,
    };
  }

  async updateOrderGeneral(orderId: number, dto: UpdateOrderGeneralDto) {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new Error('Order not found');

    // Solo actualizamos los campos enviados en el DTO
    if (dto.customerName !== undefined) order.customerName = dto.customerName;
    if (dto.phone !== undefined) order.phone = dto.phone;
    if (dto.address !== undefined) order.address = dto.address;
    if (dto.orderType !== undefined) order.orderType = dto.orderType;
    if (dto.printed !== undefined) order.printed = dto.printed;



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




private mapOrderToGroupedFormat(order: Order): any {
  const groupedItems: Record<number, any> = {};


  for (const item of order.items) {
    const productId = item.product.id;
    const productName = item.product.name;
    const code = item.product.code;

    const attributeMap = item.attributes?.reduce((acc, attr) => {
      acc[attr.attributeName] = attr.attributeValue;
      return acc;
    }, {} as Record<string, string>);

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

  const localCreatedAt = toZonedTime(order.createdAt, this.timeZone);
  return {
    orderId: order.id,
    dailyOrderNumber: order.dailyOrderNumber,
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    createdAt: localCreatedAt, 
    orderType: order.orderType,
    printed: order.printed,
    canceled:order.canceled,
    items: Object.values(groupedItems),
  };
}

}