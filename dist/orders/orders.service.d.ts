import { Product } from 'src/products/entities/product.entity';
import { Repository } from 'typeorm';
import { CreateOrderDto, UpdateOrderGeneralDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersGateway } from './Websocket/order.gateway';
export declare class OrdersService {
    private readonly orderRepo;
    private readonly itemRepo;
    private readonly attrRepo;
    private readonly productRepo;
    private readonly gateway;
    constructor(orderRepo: Repository<Order>, itemRepo: Repository<OrderItem>, attrRepo: Repository<OrderItemAttribute>, productRepo: Repository<Product>, gateway: OrdersGateway);
    private readonly timeZone;
    private getTodayUtcRange;
    create(createOrderDto: CreateOrderDto): Promise<{
        success: boolean;
        orderId: number;
        dailyOrderNumber: number;
    }>;
    findOrdersToday(): Promise<{
        orderId: number;
        dailyOrderNumber: number;
        customerName: string;
        phone: string;
        address: string;
        createdAt: Date;
        orderType: import("./entities/order.entity").OrderType;
        printed: boolean;
        items: any[];
    }[]>;
    removeOrder(orderId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    updateOrderItems(orderId: number, dto: UpdateOrderItemsDto): Promise<{
        success: boolean;
        message: string;
    }>;
    updateOrderGeneral(orderId: number, dto: UpdateOrderGeneralDto): Promise<{
        success: boolean;
        message: string;
        updatedFields: UpdateOrderGeneralDto;
    }>;
    private mapOrderToGroupedFormat;
}
