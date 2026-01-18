import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { CreateOrderDto } from '../orders/DTOS/orderDTO';
import { MailService } from '../common/mail/mail.service';
export declare class PaymentsService {
    private readonly paymentRepo;
    private readonly orderRepo;
    private readonly configService;
    private readonly moduleRef;
    private readonly mailService;
    private client;
    private preference;
    private payment;
    private ordersService;
    constructor(paymentRepo: Repository<Payment>, orderRepo: Repository<Order>, configService: ConfigService, moduleRef: ModuleRef, mailService: MailService);
    createPreference(orderData: CreateOrderDto, items: Array<{
        title: string;
        quantity: number;
        unit_price: number;
    }>, totalAmount: number, customerInfo: {
        name: string;
        email: string;
        phone?: string;
    }): Promise<{
        preferenceId: string;
        initPoint: string;
        paymentId: number;
    }>;
    handleWebhook(data: any): Promise<{
        success: boolean;
        paymentId: number;
        status: PaymentStatus;
        orderId: number | null;
        message: string;
    } | {
        success: boolean;
        message: any;
        paymentId?: undefined;
        status?: undefined;
        orderId?: undefined;
    }>;
    getPaymentStatus(orderId: number): Promise<{
        id: number;
        orderId: number | null;
        status: PaymentStatus;
        amount: number;
        preferenceId: string;
        paymentId: string;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    getPaymentByPreference(preferenceId: string): Promise<{
        id: number;
        orderId: number | null;
        status: PaymentStatus;
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
    getPaymentById(paymentId: number): Promise<{
        id: number;
        orderId: number | null;
        status: PaymentStatus;
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
