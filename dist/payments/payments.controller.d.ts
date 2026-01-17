import { PaymentsService } from './payments.service';
interface CreatePreferenceDto {
    orderData: {
        customerName: string;
        phone: string;
        address: string;
        orderType?: 'delivery' | 'pickup' | 'table' | 'counter';
        deliveryFee?: number;
        items: Array<{
            productId: number;
            note?: string;
            attributes?: Array<{
                attributeName: string;
                attributeValue: string;
            }>;
        }>;
    };
    items: Array<{
        title: string;
        quantity: number;
        unit_price: number;
    }>;
    totalAmount: number;
    customerInfo: {
        name: string;
        email: string;
        phone?: string;
    };
}
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    createPreference(createPreferenceDto: CreatePreferenceDto): Promise<{
        preferenceId: string;
        initPoint: string;
        paymentId: number;
    }>;
    handleWebhook(body: any, req: any): Promise<{
        success: boolean;
        paymentId: number;
        status: import("./entities/payment.entity").PaymentStatus;
        orderId: number | null;
        message: string;
    } | {
        success: boolean;
        message: any;
        paymentId?: undefined;
        status?: undefined;
        orderId?: undefined;
    }>;
    getPaymentStatus(orderId: string): Promise<{
        id: number;
        orderId: number | null;
        status: import("./entities/payment.entity").PaymentStatus;
        amount: number;
        preferenceId: string;
        paymentId: string;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    getPaymentByPreference(preferenceId: string): Promise<{
        id: number;
        orderId: number | null;
        status: import("./entities/payment.entity").PaymentStatus;
        amount: number;
        preferenceId: string;
        paymentId: string;
        hasOrder: boolean;
        orderData: any;
        createdAt: Date;
        updatedAt: Date;
        order: {
            id: number;
            dailyOrderNumber: number;
            orderStatus: import("../orders/entities/order.entity").OrderStatus;
        } | null;
    } | null>;
    getPaymentById(paymentId: string): Promise<{
        id: number;
        orderId: number | null;
        status: import("./entities/payment.entity").PaymentStatus;
        amount: number;
        preferenceId: string;
        paymentId: string;
        hasOrder: boolean;
        orderData: any;
        createdAt: Date;
        updatedAt: Date;
        order: {
            id: number;
            dailyOrderNumber: number;
            orderStatus: import("../orders/entities/order.entity").OrderStatus;
        } | null;
    } | null>;
}
export {};
