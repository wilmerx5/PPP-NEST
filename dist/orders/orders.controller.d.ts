import { AddOrderExtraDto, AppendOrderItemsDto, ChangeTableDto, CreateOrderDto, LinkTablesDto, RemoveOrderItemsDto, UpdateOrderExtraDto, UpdateOrderGeneralDto, UpdateOrderItemUnitPriceDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
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
        extras: any;
        redemptionCode: string | null;
    }[]>;
    createOrder(createOrderDto: CreateOrderDto, idempotencyKey?: string): Promise<{
        success: boolean;
        orderId: number;
        dailyOrderNumber: number;
    } | {
        duplicate: boolean;
        success: boolean;
        orderId: number;
        dailyOrderNumber: number;
    }>;
    getTodayOrders(orderType?: string): Promise<any[]>;
    validateRedemptionPrize(body: {
        code: string;
    }): Promise<{
        valid: boolean;
        code: any;
        expiresAt: any;
        message: string;
    }>;
    deleteOrder(id: string, force?: string): Promise<{
        success: true;
        message: string;
        dailyOrderNumber?: number;
    }>;
    updateItemUnitPrice(id: string, dto: UpdateOrderItemUnitPriceDto): Promise<any>;
    appendItems(id: string, dto: AppendOrderItemsDto): Promise<any>;
    removeItems(id: string, dto: RemoveOrderItemsDto): Promise<any>;
    updateItems(id: string, dto: UpdateOrderItemsDto): Promise<any>;
    addExtra(id: string, dto: AddOrderExtraDto): Promise<{
        success: boolean;
        message: string;
        extra: {
            id: number;
            title: string;
            description: string | null;
            amount: number;
            quantity: number;
        };
    }>;
    deleteExtra(id: string, extraId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    updateExtra(id: string, extraId: string, dto: UpdateOrderExtraDto): Promise<{
        success: boolean;
        message: string;
        extra: {
            id: number;
            title: string;
            description: string | null;
            amount: number;
            quantity: number;
        };
    }>;
    updateOrderGeneral(id: number, dto: UpdateOrderGeneralDto): Promise<{
        success: true;
        message: string;
        dailyOrderNumber?: number;
    } | {
        success: boolean;
        message: string;
        updatedFields: UpdateOrderGeneralDto;
        completedOrderIds: number[];
    } | {
        success: boolean;
        message: string;
        updatedFields: UpdateOrderGeneralDto;
        completedOrderIds?: undefined;
    }>;
    changeTable(id: string, dto: ChangeTableDto): Promise<{
        success: boolean;
        message: string;
        swapped: boolean;
    }>;
    linkTables(id: string, dto: LinkTablesDto): Promise<{
        success: boolean;
        message: string;
        tableGroupId: number;
        linkedTables: string[];
    }>;
    unlinkTable(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    applyRedemptionVoucher(id: number, body: {
        redemptionCode: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
}
