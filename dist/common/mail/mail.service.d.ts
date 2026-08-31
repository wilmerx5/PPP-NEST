import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private readonly configService;
    private transporter;
    constructor(configService: ConfigService);
    sendVerificationCode(email: string, code: string): Promise<boolean>;
    sendActivateUser(email: string, userId: string, code: string): Promise<boolean>;
    sendPasswordResetCode(email: string, code: string): Promise<boolean>;
    sendOrderConfirmation(email: string, orderNumber: number, customerName: string, items: Array<{
        productName: string;
        quantity: number;
        price: number;
    }>, total: number, orderType: string, address?: string, phone?: string, deliveryFee?: number): Promise<boolean>;
    sendNewOrderNotification(orderNumber: number, customerName: string, phone: string, address: string, orderType: string, items: Array<{
        productName: string;
        quantity: number;
        price: number;
    }>, total: number, deliveryFee?: number): Promise<boolean>;
}
