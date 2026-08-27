import { Product } from 'src/products/entities/product.entity';
import { Repository, DataSource } from 'typeorm';
import { AddOrderExtraDto, ChangeTableDto, CreateOrderDto, AppendOrderItemsDto, RemoveOrderItemsDto, UpdateOrderExtraDto, UpdateOrderGeneralDto, UpdateOrderItemUnitPriceDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderExtra } from './entities/order-extra.entity';
import { OrdersGateway } from './Websocket/order.gateway';
import { PointsService } from '../auth/services/points.service';
import { User } from '../auth/entities/user.entity';
import { MailService } from '../common/mail/mail.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import { ProductsService } from '../products/products.service';
import { BusinessService } from '../business/business.service';
import { WebDeliveryService } from '../delivery/web-delivery.service';
export declare class OrdersService {
    private readonly orderRepo;
    private readonly itemRepo;
    private readonly attrRepo;
    private readonly extraRepo;
    private readonly productRepo;
    private readonly userRepo;
    private readonly gateway;
    private readonly dataSource;
    private readonly pointsService;
    private readonly productsService;
    private readonly businessService;
    private readonly webDelivery;
    private readonly mailService;
    private readonly circuitBreaker;
    private readonly inflightCreates;
    private static readonly SOFT_DEDUPE_WINDOW_MS;
    constructor(orderRepo: Repository<Order>, itemRepo: Repository<OrderItem>, attrRepo: Repository<OrderItemAttribute>, extraRepo: Repository<OrderExtra>, productRepo: Repository<Product>, userRepo: Repository<User>, gateway: OrdersGateway, dataSource: DataSource, pointsService: PointsService, productsService: ProductsService, businessService: BusinessService, webDelivery: WebDeliveryService, mailService: MailService, circuitBreaker: CircuitBreakerService);
    private buildOrderContentFingerprint;
    private findExistingByClientRequestId;
    private findSoftDuplicate;
    private resolveBulkInsertIds;
    private generateNextOrderNumber;
    private buildInventoryCountByKey;
    private parseVariantKey;
    private validateInventoryCounts;
    private deductInventory;
    private restoreInventory;
    create(createOrderDto: CreateOrderDto): Promise<{
        success: boolean;
        orderId: number;
        dailyOrderNumber: number;
    } | {
        duplicate: boolean;
        success: boolean;
        orderId: number;
        dailyOrderNumber: number;
    }>;
    private createOrderInternal;
    private finalizeOrderAfterCreate;
    findOrdersToday(orderType?: string): Promise<any[]>;
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
        extras: any;
        redemptionCode: string | null;
    }[]>;
    private cancelOrderFully;
    removeOrder(orderId: number, force?: boolean): Promise<{
        success: true;
        message: string;
        dailyOrderNumber?: number;
    }>;
    updateOrderItems(orderId: number, dto: UpdateOrderItemsDto): Promise<any>;
    appendOrderItems(orderId: number, dto: AppendOrderItemsDto): Promise<any>;
    removeOrderItems(orderId: number, dto: RemoveOrderItemsDto): Promise<any>;
    private finalizeOrderAfterUpdate;
    updateOrderItemUnitPrice(orderId: number, dto: UpdateOrderItemUnitPriceDto): Promise<any>;
    addExtra(orderId: number, dto: AddOrderExtraDto): Promise<{
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
    deleteExtra(orderId: number, extraId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    updateExtra(orderId: number, extraId: number, dto: UpdateOrderExtraDto): Promise<{
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
    updateOrderGeneral(orderId: number, dto: UpdateOrderGeneralDto): Promise<{
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
    changeTable(orderId: number, dto: ChangeTableDto): Promise<{
        success: boolean;
        message: string;
        swapped: boolean;
    }>;
    linkTables(orderId: number, tableNumbers: string[]): Promise<{
        success: boolean;
        message: string;
        tableGroupId: number;
        linkedTables: string[];
    }>;
    unlinkTable(orderId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    private collectLinkedTableOrderIds;
    private removeOrderFromTableGroupInTransaction;
    private resolveUnifiedTableGroupId;
    private emitFormattedOrdersUpdate;
    private incomingItemSignature;
    private deduplicateIncomingUpdateItems;
    private deduplicateOrderItemsById;
    private loadOrdersWithItemsAndExtras;
    private mapOrdersWithPointCodes;
    private mapOrderToGroupedFormat;
    validateRedemptionCodePublic(code: string): Promise<any>;
    applyRedemptionVoucher(orderId: number, redemptionCode: string): Promise<Order>;
    getOrdersBrief(orderIds: number[]): Promise<Array<{
        id: number;
        dailyOrderNumber: number;
        createdAt: Date;
    }>>;
    findTodayOrdersByPhone(phone: string): Promise<Array<{
        id: number;
        dailyOrderNumber: number;
        orderStatus: Order['orderStatus'];
        orderType: Order['orderType'];
        orderSource: Order['orderSource'];
        createdAt: Date;
    }>>;
    findOrdersByDate(date: string): Promise<any[]>;
    getDailySummary(date?: string): Promise<any>;
    static readonly ADMIN_STATS_MIN_DATE = "2026-01-21";
    getSalesReport(from: string, to: string): Promise<any>;
    getMonthlySalesSummary(year: number): Promise<{
        year: number;
        statsMinDate: string;
        periodFrom: string;
        periodTo: string;
        months: Array<{
            monthKey: string;
            label: string;
            orders: number;
            totalRevenue: number;
        }>;
        monthsByRevenueDesc: Array<{
            monthKey: string;
            label: string;
            orders: number;
            totalRevenue: number;
        }>;
        yearTotalOrders: number;
        yearTotalRevenue: number;
    }>;
    backfillUnitPrices(): Promise<{
        updated: number;
    }>;
}
