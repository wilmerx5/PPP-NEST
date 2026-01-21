import { CreateOrderDto, UpdateOrderGeneralDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrdersService } from './orders.service';
export declare class OrdersController {
    private readonly orderService;
    constructor(orderService: OrdersService);
    getMine(req: any): Promise<{
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
    createOrder(createOrderDto: CreateOrderDto): Promise<{
        success: boolean;
        orderId: number;
        dailyOrderNumber: number;
    }>;
    getTodayOrders(): Promise<any[]>;
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
    validateRedemptionPrize(body: {
        code: string;
    }): Promise<{
        valid: boolean;
        code: any;
        expiresAt: any;
        message: string;
    }>;
    applyRedemptionVoucher(id: number, body: {
        redemptionCode: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
}
