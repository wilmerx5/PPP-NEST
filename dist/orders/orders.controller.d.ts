import { CreateOrderDto, UpdateOrderGeneralDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrdersService } from './orders.service';
export declare class OrdersController {
    private readonly orderService;
    constructor(orderService: OrdersService);
    createOrder(createOrderDto: CreateOrderDto): Promise<{
        success: boolean;
        orderId: number;
        dailyOrderNumber: number;
    }>;
    getTodayOrders(): Promise<{
        orderId: number;
        dailyOrderNumber: number;
        customerName: string;
        phone: string;
        address: string;
        createdAt: Date;
        orderType: import("./entities/order.entity").OrderType;
        items: any[];
    }[]>;
    deleteOrder(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    updateItems(id: string, dto: UpdateOrderItemsDto): Promise<{
        success: boolean;
        message: string;
    }>;
    updateOrderGeneral(id: number, dto: UpdateOrderGeneralDto): Promise<{
        success: boolean;
        message: string;
        updatedFields: UpdateOrderGeneralDto;
    }>;
}
