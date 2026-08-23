"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const mercadopago_1 = require("mercadopago");
const order_entity_1 = require("../orders/entities/order.entity");
const payment_entity_1 = require("./entities/payment.entity");
const orders_service_1 = require("../orders/orders.service");
const mail_service_1 = require("../common/mail/mail.service");
const date_util_1 = require("../common/utils/date.util");
const business_service_1 = require("../business/business.service");
const products_service_1 = require("../products/products.service");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    paymentRepo;
    orderRepo;
    dataSource;
    configService;
    moduleRef;
    mailService;
    businessService;
    productsService;
    logger = new common_1.Logger(PaymentsService_1.name);
    client;
    preference;
    payment;
    ordersService;
    constructor(paymentRepo, orderRepo, dataSource, configService, moduleRef, mailService, businessService, productsService) {
        this.paymentRepo = paymentRepo;
        this.orderRepo = orderRepo;
        this.dataSource = dataSource;
        this.configService = configService;
        this.moduleRef = moduleRef;
        this.mailService = mailService;
        this.businessService = businessService;
        this.productsService = productsService;
        try {
            const accessToken = this.configService.get('MERCADO_PAGO_ACCESS_TOKEN');
            if (!accessToken) {
                return;
            }
            this.client = new mercadopago_1.MercadoPagoConfig({
                accessToken: accessToken,
                options: {
                    timeout: 5000,
                },
            });
            this.preference = new mercadopago_1.Preference(this.client);
            this.payment = new mercadopago_1.Payment(this.client);
        }
        catch {
        }
    }
    async createPreference(orderData, items, totalAmount, customerInfo, options) {
        if (!this.client || !this.preference) {
            throw new common_1.BadRequestException('Mercado Pago no está configurado. Configura MERCADO_PAGO_ACCESS_TOKEN en las variables de entorno.');
        }
        if (!options?.bypassOnlineHours) {
            await this.businessService.assertAcceptingOnlineOrders();
        }
        const productIds = (orderData.items ?? []).map((i) => i.productId);
        await this.productsService.assertOnlineProductsAvailable(productIds);
        let mercadopagoFrontendUrl = this.configService.get('FRONTEND_URL_NGROK') ||
            this.configService.get('FRONTEND_URL') ||
            'http://localhost:3000';
        let mercadopagoBackendUrl = this.configService.get('BACKEND_URL_NGROK') ||
            this.configService.get('BACKEND_URL') ||
            'http://localhost:4000';
        const authFrontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
        const authBackendUrl = this.configService.get('BACKEND_URL') || 'http://localhost:4000';
        const normalizeUrl = (url, defaultProtocol = 'http') => {
            if (!url)
                return url;
            url = url.trim();
            url = url.replace(/^https?:\/\/(https?):/i, '$1:');
            url = url.replace(/^https?:\/\/(https?:\/\/)/i, '$1');
            if (!url.match(/^https?:\/\//i)) {
                if (url.match(/^https?:[^/]/i)) {
                    url = url.replace(/^(https?):/i, '$1://');
                }
                else {
                    url = `${defaultProtocol}://${url}`;
                }
            }
            url = url.replace(/^(https?:\/\/)\/+/i, '$1');
            url = url.replace(/\/+$/, '');
            return url;
        };
        mercadopagoFrontendUrl = normalizeUrl(mercadopagoFrontendUrl || 'http://localhost:3000', mercadopagoFrontendUrl?.match(/^https/i) ? 'https' : 'http');
        mercadopagoBackendUrl = normalizeUrl(mercadopagoBackendUrl || 'http://localhost:4000', mercadopagoBackendUrl?.match(/^https/i) ? 'https' : 'http');
        const baseUrl = mercadopagoFrontendUrl;
        const backendUrl = mercadopagoBackendUrl;
        if (!baseUrl || baseUrl.length === 0) {
            throw new common_1.BadRequestException('FRONTEND_URL no está configurada correctamente');
        }
        try {
            new URL(baseUrl);
        }
        catch {
            throw new common_1.BadRequestException(`FRONTEND_URL (o FRONTEND_URL_NGROK) no es una URL válida: "${baseUrl}". ` +
                'Revisa que no tengas protocolo duplicado (ej: http://http://...) y que sea una URL accesible (usa ngrok en desarrollo).');
        }
        try {
            new URL(`${backendUrl}/api/payments/webhook`);
        }
        catch {
            throw new common_1.BadRequestException(`BACKEND_URL (o BACKEND_URL_NGROK) no permite una URL de webhook válida: "${backendUrl}".`);
        }
        const payerData = {
            name: customerInfo.name,
            email: customerInfo.email,
        };
        if (customerInfo.phone) {
            payerData.phone = { number: customerInfo.phone };
        }
        const backUrls = {
            success: `${baseUrl}/checkout/success`,
            failure: `${baseUrl}/checkout/failure`,
            pending: `${baseUrl}/checkout/pending`,
        };
        if (!backUrls.success || !backUrls.failure || !backUrls.pending) {
            throw new common_1.BadRequestException('Las URLs de retorno no están correctamente configuradas');
        }
        if (typeof backUrls.success !== 'string' || backUrls.success.length === 0) {
            throw new common_1.BadRequestException(`URL de success inválida: ${backUrls.success}`);
        }
        if (typeof backUrls.failure !== 'string' || backUrls.failure.length === 0) {
            throw new common_1.BadRequestException(`URL de failure inválida: ${backUrls.failure}`);
        }
        if (typeof backUrls.pending !== 'string' || backUrls.pending.length === 0) {
            throw new common_1.BadRequestException(`URL de pending inválida: ${backUrls.pending}`);
        }
        const backUrlsObj = {
            success: String(backUrls.success || ''),
            failure: String(backUrls.failure || ''),
            pending: String(backUrls.pending || ''),
        };
        if (!backUrlsObj.success || !backUrlsObj.failure || !backUrlsObj.pending) {
            throw new common_1.BadRequestException(`back_urls incompleto. success: "${backUrlsObj.success}", failure: "${backUrlsObj.failure}", pending: "${backUrlsObj.pending}"`);
        }
        const preferenceData = {
            items: items.map(item => ({
                title: item.title,
                quantity: item.quantity,
                unit_price: item.unit_price,
            })),
            payer: payerData,
            back_urls: backUrlsObj,
            auto_return: 'all',
            external_reference: `payment_${Date.now()}`,
            notification_url: `${backendUrl}/api/payments/webhook`,
            metadata: {
                order_data: orderData,
                ...(options?.channel && { channel: options.channel }),
                ...(options?.conversationId != null && { conversation_id: options.conversationId }),
                ...(options?.waId && { wa_id: options.waId }),
            },
        };
        if (!preferenceData.back_urls || typeof preferenceData.back_urls !== 'object') {
            throw new common_1.BadRequestException('back_urls debe ser un objeto válido');
        }
        if (!preferenceData.back_urls.success || typeof preferenceData.back_urls.success !== 'string') {
            throw new common_1.BadRequestException(`back_urls.success debe ser un string válido. Valor recibido: ${JSON.stringify(preferenceData.back_urls.success)}`);
        }
        try {
            if (!preferenceData.back_urls ||
                !preferenceData.back_urls.success ||
                !preferenceData.back_urls.failure ||
                !preferenceData.back_urls.pending) {
                throw new common_1.BadRequestException('back_urls no está correctamente configurado. Todas las URLs (success, failure, pending) deben estar definidas.');
            }
            const bodyToSend = {
                items: preferenceData.items.map((item) => ({
                    title: String(item.title),
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                })),
                payer: {
                    name: String(preferenceData.payer.name),
                    email: String(preferenceData.payer.email),
                    ...(preferenceData.payer.phone && {
                        phone: typeof preferenceData.payer.phone === 'string'
                            ? { number: String(preferenceData.payer.phone) }
                            : preferenceData.payer.phone
                    }),
                },
                back_urls: {
                    success: String(preferenceData.back_urls.success),
                    failure: String(preferenceData.back_urls.failure),
                    pending: String(preferenceData.back_urls.pending),
                },
                auto_return: 'approved',
                external_reference: String(preferenceData.external_reference),
                notification_url: String(preferenceData.notification_url),
            };
            if (preferenceData.metadata && Object.keys(preferenceData.metadata).length > 0) {
                bodyToSend.metadata = preferenceData.metadata;
            }
            if (!bodyToSend.back_urls || !bodyToSend.back_urls.success) {
                throw new common_1.BadRequestException('back_urls.success se perdió durante la serialización del objeto');
            }
            try {
                const response = await this.preference.create({
                    body: bodyToSend,
                    requestOptions: {
                        idempotencyKey: `pref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                    },
                });
                if (!response.id) {
                    throw new common_1.BadRequestException('No se recibió un ID de preferencia válido de Mercado Pago');
                }
                const preferenceId = response.id;
                const accessToken = this.configService.get('MERCADO_PAGO_ACCESS_TOKEN') || '';
                const useSandboxCheckout = accessToken.trim().startsWith('TEST-');
                const initPoint = useSandboxCheckout
                    ? (response.sandbox_init_point || response.init_point || '')
                    : (response.init_point || response.sandbox_init_point || '');
                const payment = this.paymentRepo.create({
                    orderId: null,
                    preferenceId: preferenceId,
                    amount: totalAmount,
                    status: 'pending',
                    metadata: JSON.stringify({
                        preference_id: preferenceId,
                        init_point: initPoint,
                        order_data: orderData,
                        external_reference: preferenceData.external_reference,
                        customer_email: customerInfo.email,
                        ...(options?.channel && { channel: options.channel }),
                        ...(options?.conversationId != null && { conversation_id: options.conversationId }),
                        ...(options?.waId && { wa_id: options.waId }),
                    }),
                });
                await this.paymentRepo.save(payment);
                return {
                    preferenceId: preferenceId,
                    initPoint: initPoint,
                    paymentId: payment.id,
                };
            }
            catch (createError) {
                if (createError?.error === 'invalid_auto_return' || createError?.message?.includes('auto_return')) {
                    const bodyWithoutAutoReturn = JSON.parse(JSON.stringify({
                        items: bodyToSend.items,
                        payer: bodyToSend.payer,
                        back_urls: bodyToSend.back_urls,
                        external_reference: bodyToSend.external_reference,
                        notification_url: bodyToSend.notification_url,
                        metadata: bodyToSend.metadata,
                    }));
                    const response = await this.preference.create({
                        body: bodyWithoutAutoReturn,
                        requestOptions: {
                            idempotencyKey: `pref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                        },
                    });
                    if (!response.id) {
                        throw new common_1.BadRequestException('No se recibió un ID de preferencia válido de Mercado Pago');
                    }
                    const preferenceId = response.id;
                    const accessTokenRetry = this.configService.get('MERCADO_PAGO_ACCESS_TOKEN') || '';
                    const useSandboxRetry = accessTokenRetry.trim().startsWith('TEST-');
                    const initPoint = useSandboxRetry
                        ? (response.sandbox_init_point || response.init_point || '')
                        : (response.init_point || response.sandbox_init_point || '');
                    const payment = this.paymentRepo.create({
                        orderId: null,
                        preferenceId: preferenceId,
                        amount: totalAmount,
                        status: 'pending',
                        metadata: JSON.stringify({
                            preference_id: preferenceId,
                            init_point: initPoint,
                            order_data: orderData,
                            external_reference: preferenceData.external_reference,
                            customer_email: customerInfo.email,
                            ...(options?.channel && { channel: options.channel }),
                            ...(options?.conversationId != null && { conversation_id: options.conversationId }),
                            ...(options?.waId && { wa_id: options.waId }),
                        }),
                    });
                    await this.paymentRepo.save(payment);
                    return {
                        preferenceId: preferenceId,
                        initPoint: initPoint,
                        paymentId: payment.id,
                    };
                }
                throw createError;
            }
        }
        catch (error) {
            const errorMessage = error.response?.data?.message
                || error.message
                || 'Failed to create payment preference';
            throw new common_1.BadRequestException(`Error al crear la preferencia de pago: ${errorMessage}`);
        }
    }
    async handleWebhook(data) {
        try {
            if (!this.client || !this.payment) {
                return { success: false, message: 'Mercado Pago is not configured' };
            }
            const { type, data: webhookData } = data || {};
            if (type !== 'payment') {
                return { success: true, message: 'Webhook procesado (no es un evento de pago)' };
            }
            const paymentId = webhookData?.id;
            if (!paymentId) {
                return { success: false, message: 'ID de pago no encontrado' };
            }
            const mpPaymentId = paymentId.toString();
            const mpPayment = await this.payment.get({ id: mpPaymentId });
            if (!mpPayment) {
                return { success: false, message: 'Pago no encontrado en Mercado Pago' };
            }
            const alreadyByMpId = await this.paymentRepo.findOne({
                where: { paymentId: mpPaymentId },
            });
            if (alreadyByMpId?.orderId) {
                this.logger.log(`[webhook] Pago MP ${mpPaymentId} ya tiene orderId=${alreadyByMpId.orderId}; skip`);
                return {
                    success: true,
                    paymentId: alreadyByMpId.id,
                    status: alreadyByMpId.status,
                    orderId: alreadyByMpId.orderId,
                    message: `Order #${alreadyByMpId.orderId} already linked (idempotent)`,
                };
            }
            let paymentRow = alreadyByMpId;
            if (!paymentRow && mpPayment.external_reference) {
                const allPayments = await this.paymentRepo.find({ where: {} });
                for (const p of allPayments) {
                    try {
                        const meta = JSON.parse(p.metadata || '{}');
                        if (meta.external_reference === mpPayment.external_reference) {
                            paymentRow = p;
                            break;
                        }
                    }
                    catch {
                    }
                }
            }
            if (!paymentRow) {
                return { success: false, message: 'Registro de pago no encontrado' };
            }
            let status = 'pending';
            if (mpPayment.status === 'approved') {
                status = 'approved';
            }
            else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
                status = mpPayment.status;
            }
            else if (mpPayment.status === 'refunded') {
                status = 'refunded';
            }
            let metadataObj = {};
            try {
                if (paymentRow.metadata)
                    metadataObj = JSON.parse(paymentRow.metadata);
            }
            catch {
                metadataObj = {};
            }
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            let createdOrderId = null;
            let shouldSendEmail = false;
            let emailContext = null;
            try {
                const locked = await queryRunner.manager
                    .getRepository(payment_entity_1.Payment)
                    .createQueryBuilder('p')
                    .setLock('pessimistic_write')
                    .where('p.id = :id', { id: paymentRow.id })
                    .getOne();
                if (!locked) {
                    await queryRunner.rollbackTransaction();
                    return { success: false, message: 'Registro de pago no encontrado' };
                }
                locked.status = status;
                locked.paymentId = mpPaymentId;
                locked.metadata = JSON.stringify({
                    ...metadataObj,
                    mp_payment: mpPayment,
                });
                if (locked.orderId) {
                    await queryRunner.manager.save(locked);
                    await queryRunner.commitTransaction();
                    this.logger.log(`[webhook] Pago #${locked.id} ya vinculado a orderId=${locked.orderId}; skip create`);
                    return {
                        success: true,
                        paymentId: locked.id,
                        status: locked.status,
                        orderId: locked.orderId,
                        message: `Order #${locked.orderId} already linked (idempotent)`,
                    };
                }
                if (status === 'approved' && metadataObj.order_data) {
                    if (!this.ordersService) {
                        this.ordersService = this.moduleRef.get(orders_service_1.OrdersService, { strict: false });
                    }
                    const isWhatsapp = metadataObj.channel === 'whatsapp' ||
                        metadataObj.order_data?.orderSource === 'whatsapp';
                    const orderDataWithEmail = {
                        ...metadataObj.order_data,
                        customerEmail: isWhatsapp
                            ? metadataObj.customer_email || metadataObj.order_data?.customerEmail || null
                            : metadataObj.customer_email || null,
                        orderSource: isWhatsapp ? 'whatsapp' : 'online',
                        clientRequestId: `mp-pay-${locked.paymentId || locked.id}`.slice(0, 64),
                    };
                    const orderResponse = await this.ordersService.create(orderDataWithEmail);
                    locked.orderId = orderResponse.orderId;
                    createdOrderId = orderResponse.orderId;
                    await queryRunner.manager.save(locked);
                    await queryRunner.commitTransaction();
                    if (orderDataWithEmail.redemptionCode) {
                        try {
                            await this.ordersService.applyRedemptionVoucher(orderResponse.orderId, orderDataWithEmail.redemptionCode);
                        }
                        catch {
                        }
                    }
                    if (isWhatsapp) {
                        const conversationId = Number(metadataObj.conversation_id);
                        const waId = String(metadataObj.wa_id || '');
                        if (conversationId && waId) {
                            void this.notifyWhatsappPaymentSuccess({
                                conversationId,
                                waId,
                                orderId: orderResponse.orderId,
                            });
                        }
                        else {
                            this.logger.warn(`[webhook] Pago WhatsApp sin conversation_id/wa_id (order #${orderResponse.orderId})`);
                        }
                    }
                    const emailTo = metadataObj.customer_email || mpPayment?.payer?.email;
                    if (emailTo && !String(emailTo).endsWith('@whatsapp.ppp.local')) {
                        shouldSendEmail = true;
                        emailContext = {
                            orderId: orderResponse.orderId,
                            emailTo,
                            customerName: metadataObj.order_data?.customerName ||
                                mpPayment.payer?.name ||
                                'Cliente',
                        };
                    }
                }
                else {
                    await queryRunner.manager.save(locked);
                    await queryRunner.commitTransaction();
                }
                if (shouldSendEmail && emailContext) {
                    void this.sendOrderConfirmationEmail(emailContext.orderId, emailContext.emailTo, emailContext.customerName, mpPayment);
                }
                return {
                    success: true,
                    paymentId: paymentRow.id,
                    status,
                    orderId: createdOrderId ?? paymentRow.orderId,
                    message: createdOrderId
                        ? `Order #${createdOrderId} created successfully`
                        : 'Payment processed but order not created yet',
                };
            }
            catch (err) {
                if (queryRunner.isTransactionActive) {
                    await queryRunner.rollbackTransaction();
                }
                this.logger.error(`[webhook] Error procesando pago MP ${mpPaymentId}`, err);
                throw err;
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    }
    async sendOrderConfirmationEmail(orderId, emailTo, customerName, mpPayment) {
        try {
            const fullOrder = await this.orderRepo.findOne({
                where: { id: orderId },
                relations: ['items', 'items.product'],
            });
            if (!fullOrder || !emailTo)
                return;
            const groupedItems = {};
            for (const item of fullOrder.items) {
                const productId = item.product?.id || 0;
                const productName = item.product?.name || 'Producto';
                const price = item.product?.price || 0;
                if (!groupedItems[productId]) {
                    groupedItems[productId] = { productName, quantity: 0, price };
                }
                groupedItems[productId].quantity += 1;
            }
            const emailItems = Object.values(groupedItems);
            const subtotal = emailItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const deliveryNum = Number(fullOrder.deliveryFee) || 0;
            const totalForEmail = mpPayment.transaction_amount != null && mpPayment.transaction_amount !== ''
                ? Number(mpPayment.transaction_amount)
                : subtotal + deliveryNum;
            await this.mailService.sendOrderConfirmation(emailTo, fullOrder.dailyOrderNumber ?? fullOrder.id, customerName, emailItems, totalForEmail, String(fullOrder.orderType || 'delivery'), fullOrder.address, fullOrder.phone, deliveryNum > 0 ? deliveryNum : undefined);
        }
        catch (e) {
            this.logger.warn(`[webhook] Falló correo de orden #${orderId}: ${e.message}`);
        }
    }
    async getPaymentStatus(orderId) {
        const payment = await this.paymentRepo.findOne({
            where: { orderId },
            order: { createdAt: 'DESC' },
        });
        if (!payment) {
            return null;
        }
        return {
            id: payment.id,
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            preferenceId: payment.preferenceId,
            paymentId: payment.paymentId,
            createdAt: (0, date_util_1.formatToBogotaISO)(payment.createdAt),
            updatedAt: (0, date_util_1.formatToBogotaISO)(payment.updatedAt),
        };
    }
    async getPaymentByPreference(preferenceId) {
        const payment = await this.paymentRepo.findOne({
            where: { preferenceId },
            relations: ['order'],
        });
        if (!payment) {
            return null;
        }
        let metadataObj = {};
        try {
            if (payment.metadata) {
                metadataObj = JSON.parse(payment.metadata);
            }
        }
        catch {
        }
        return {
            id: payment.id,
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            preferenceId: payment.preferenceId,
            paymentId: payment.paymentId,
            hasOrder: !!payment.orderId,
            orderData: metadataObj.order_data || null,
            createdAt: (0, date_util_1.formatToBogotaISO)(payment.createdAt),
            updatedAt: (0, date_util_1.formatToBogotaISO)(payment.updatedAt),
            order: payment.orderId ? {
                id: payment.order?.id,
                dailyOrderNumber: payment.order?.dailyOrderNumber,
                orderStatus: payment.order?.orderStatus,
            } : null,
        };
    }
    async getPaymentById(paymentId) {
        const payment = await this.paymentRepo.findOne({
            where: { id: paymentId },
            relations: ['order'],
        });
        if (!payment) {
            return null;
        }
        let metadataObj = {};
        try {
            if (payment.metadata) {
                metadataObj = JSON.parse(payment.metadata);
            }
        }
        catch {
        }
        return {
            id: payment.id,
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            preferenceId: payment.preferenceId,
            paymentId: payment.paymentId,
            hasOrder: !!payment.orderId,
            orderData: metadataObj.order_data || null,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
            order: payment.orderId ? {
                id: payment.order?.id,
                dailyOrderNumber: payment.order?.dailyOrderNumber,
                orderStatus: payment.order?.orderStatus,
            } : null,
        };
    }
    async notifyWhatsappPaymentSuccess(params) {
        try {
            const { WhatsappOrchestratorService } = await Promise.resolve().then(() => require('../whatsapp/whatsapp-orchestrator.service'));
            const orch = this.moduleRef.get(WhatsappOrchestratorService, { strict: false });
            if (!orch?.completeAfterMercadoPagoPayment) {
                this.logger.warn('[webhook] WhatsappOrchestratorService no disponible para notificar pago');
                return;
            }
            await orch.completeAfterMercadoPagoPayment(params);
        }
        catch (err) {
            this.logger.error(`[webhook] No se pudo notificar WhatsApp tras pago order=#${params.orderId}`, err);
        }
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(1, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        config_1.ConfigService,
        core_1.ModuleRef,
        mail_service_1.MailService,
        business_service_1.BusinessService,
        products_service_1.ProductsService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map