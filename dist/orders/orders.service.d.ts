import { Product } from 'src/products/entities/product.entity';
import { Repository, DataSource } from 'typeorm';
import { CreateOrderDto, UpdateOrderGeneralDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersGateway } from './Websocket/order.gateway';
import { PointsService } from '../auth/services/points.service';
import { User } from '../auth/entities/user.entity';
export declare class OrdersService {
    private readonly orderRepo;
    private readonly itemRepo;
    private readonly attrRepo;
    private readonly productRepo;
    private readonly userRepo;
    private readonly gateway;
    private readonly dataSource;
    private readonly pointsService;
    constructor(orderRepo: Repository<Order>, itemRepo: Repository<OrderItem>, attrRepo: Repository<OrderItemAttribute>, productRepo: Repository<Product>, userRepo: Repository<User>, gateway: OrdersGateway, dataSource: DataSource, pointsService: PointsService);
    private generateNextOrderNumber;
    create(createOrderDto: CreateOrderDto): Promise<{
        success: boolean;
        orderId: number;
        dailyOrderNumber: number;
    }>;
    findOrdersToday(): Promise<any[]>;
    findMine(email: string): Promise<{
        orderId: number;
        dailyOrderNumber: number;
        customerName: string;
        phone: string;
        address: string;
        createdAt: string | null;
        orderType: import("./entities/order.entity").OrderType;
        orderStatus: import("./entities/order.entity").OrderStatus;
        printed: boolean;
        deliveryFee: number;
        orderSource: import("./entities/order.entity").OrderSource;
        points: number;
        pointCodes: string[];
        items: any[];
        redemptionCode: string | null;
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
    validateRedemptionCodePublic(code: string): Promise<any>;
    applyRedemptionVoucher(orderId: number, redemptionCode: string): Promise<Order>;
}
