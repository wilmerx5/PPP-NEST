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
let PaymentsService = class PaymentsService {
    paymentRepo;
    orderRepo;
    configService;
    moduleRef;
    mailService;
    client;
    preference;
    payment;
    ordersService;
    constructor(paymentRepo, orderRepo, configService, moduleRef, mailService) {
        this.paymentRepo = paymentRepo;
        this.orderRepo = orderRepo;
        this.configService = configService;
        this.moduleRef = moduleRef;
        this.mailService = mailService;
        try {
            const accessToken = this.configService.get('MERCADO_PAGO_ACCESS_TOKEN');
            if (!accessToken) {
                console.warn('⚠️ MERCADO_PAGO_ACCESS_TOKEN is not configured. Payment features will not work.');
                return;
            }
            this.client = new mercadopago_1.MercadoPagoConfig({
                accessToken: accessToken,
                options: {
                    timeout: 5000,
                    idempotencyKey: 'ppp-payment',
                },
            });
            this.preference = new mercadopago_1.Preference(this.client);
            this.payment = new mercadopago_1.Payment(this.client);
        }
        catch (error) {
            console.error('Error initializing Mercado Pago client:', error);
        }
    }
    async createPreference(orderData, items, totalAmount, customerInfo) {
        if (!this.client || !this.preference) {
            throw new common_1.BadRequestException('Mercado Pago is not configured. Please set MERCADO_PAGO_ACCESS_TOKEN in environment variables.');
        }
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
        console.log('🌐 [Mercado Pago] URLs configuradas:');
        console.log(`   Frontend (Mercado Pago): ${mercadopagoFrontendUrl}`);
        console.log(`   Backend (Webhook): ${mercadopagoBackendUrl}`);
        console.log(`   Frontend (Auth): ${authFrontendUrl}`);
        console.log(`   Backend (Auth): ${authBackendUrl}`);
        if (!mercadopagoFrontendUrl.startsWith('https://')) {
            console.warn('⚠️ [Mercado Pago] ADVERTENCIA: Usando HTTP para URLs de Mercado Pago');
            console.warn('⚠️ [Mercado Pago] El auto_return puede no funcionar correctamente con HTTP');
            console.warn('⚠️ [Mercado Pago] Para redirección automática, configura FRONTEND_URL_NGROK y BACKEND_URL_NGROK');
            console.warn(`⚠️ [Mercado Pago] Actual: ${mercadopagoFrontendUrl}`);
            console.warn('⚠️ [Mercado Pago] Recomendado: https://tu-id.ngrok-free.app (usa ngrok)');
        }
        else {
            console.log('✅ [Mercado Pago] Usando HTTPS para Mercado Pago (auto_return funcionará)');
        }
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
            },
        };
        if (!preferenceData.back_urls || typeof preferenceData.back_urls !== 'object') {
            throw new common_1.BadRequestException('back_urls debe ser un objeto válido');
        }
        if (!preferenceData.back_urls.success || typeof preferenceData.back_urls.success !== 'string') {
            throw new common_1.BadRequestException(`back_urls.success debe ser un string válido. Valor recibido: ${JSON.stringify(preferenceData.back_urls.success)}`);
        }
        console.log('🔧 [Mercado Pago] Creating preference with:', JSON.stringify({
            back_urls: preferenceData.back_urls,
            auto_return: preferenceData.auto_return,
            baseUrl,
            backendUrl,
            hasBackUrls: !!preferenceData.back_urls,
            successUrl: preferenceData.back_urls?.success,
            failureUrl: preferenceData.back_urls?.failure,
            pendingUrl: preferenceData.back_urls?.pending,
        }, null, 2));
        try {
            if (!preferenceData.back_urls ||
                !preferenceData.back_urls.success ||
                !preferenceData.back_urls.failure ||
                !preferenceData.back_urls.pending) {
                console.error('❌ [Mercado Pago] back_urls inválido:', JSON.stringify(preferenceData.back_urls, null, 2));
                throw new common_1.BadRequestException('back_urls no está correctamente configurado. Todas las URLs (success, failure, pending) deben estar definidas.');
            }
            console.log('📤 [Mercado Pago] Sending preference data to API:', JSON.stringify({
                items: preferenceData.items.length,
                has_back_urls: !!preferenceData.back_urls,
                back_urls: preferenceData.back_urls,
                back_urls_type: typeof preferenceData.back_urls,
                back_urls_keys: preferenceData.back_urls ? Object.keys(preferenceData.back_urls) : [],
                success_exists: !!preferenceData.back_urls?.success,
                success_value: preferenceData.back_urls?.success,
                auto_return: preferenceData.auto_return,
            }, null, 2));
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
                console.error('❌ [Mercado Pago] CRITICAL: back_urls.success is missing after JSON serialization!');
                console.error('❌ [Mercado Pago] bodyToSend:', JSON.stringify(bodyToSend, null, 2));
                throw new common_1.BadRequestException('back_urls.success se perdió durante la serialización del objeto');
            }
            console.log('📤 [Mercado Pago] Final body structure:', JSON.stringify({
                back_urls: bodyToSend.back_urls,
                back_urls_success_type: typeof bodyToSend.back_urls.success,
                back_urls_success_value: bodyToSend.back_urls.success,
                back_urls_keys: Object.keys(bodyToSend.back_urls || {}),
                auto_return: bodyToSend.auto_return,
                has_auto_return: !!bodyToSend.auto_return,
            }, null, 2));
            try {
                console.log('🚀 [Mercado Pago] Creando preferencia CON auto_return para redirección automática...');
                console.log('🔗 [Mercado Pago] URLs de redirección:');
                console.log(`   Success: ${bodyToSend.back_urls.success}`);
                console.log(`   Failure: ${bodyToSend.back_urls.failure}`);
                console.log(`   Pending: ${bodyToSend.back_urls.pending}`);
                const response = await this.preference.create({ body: bodyToSend });
                console.log('✅ [Mercado Pago] Preferencia creada exitosamente CON auto_return');
                console.log(`   Preference ID: ${response.id}`);
                console.log(`   Init Point: ${response.init_point || response.sandbox_init_point || 'N/A'}`);
                if (!mercadopagoFrontendUrl.startsWith('https://')) {
                    console.warn('⚠️ [Mercado Pago] La redirección automática suele FALLAR con HTTP. Configura FRONTEND_URL_NGROK con HTTPS (ngrok).');
                }
                else {
                    console.log('   ℹ️ Redirección: Mercado Pago redirigirá a', bodyToSend.back_urls.success);
                }
                if (!response.id) {
                    throw new common_1.BadRequestException('No se recibió un ID de preferencia válido de Mercado Pago');
                }
                const preferenceId = response.id;
                const initPoint = response.init_point || response.sandbox_init_point || '';
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
                console.error('📛 [Mercado Pago] Error al crear preferencia:', createError?.message);
                if (createError?.cause)
                    console.error('   cause:', createError.cause);
                if (createError?.error)
                    console.error('   error:', createError.error);
                if (createError?.response?.data)
                    console.error('   response.data:', JSON.stringify(createError.response.data));
                if (createError?.error === 'invalid_auto_return' || createError?.message?.includes('auto_return')) {
                    console.warn('⚠️ [Mercado Pago] ADVERTENCIA: Error al crear preferencia con auto_return ("approved")');
                    console.warn('⚠️ [Mercado Pago] Razón posible: URLs HTTP (Mercado Pago exige HTTPS para auto_return) o URLs no accesibles desde internet');
                    console.warn('⚠️ [Mercado Pago] Solución: Configura FRONTEND_URL_NGROK con tu URL HTTPS de ngrok (ej: https://xxx.ngrok-free.app)');
                    console.warn('⚠️ [Mercado Pago] Continuando sin auto_return - El usuario deberá hacer clic en "Volver al sitio"');
                    const bodyWithoutAutoReturn = JSON.parse(JSON.stringify({
                        items: bodyToSend.items,
                        payer: bodyToSend.payer,
                        back_urls: bodyToSend.back_urls,
                        external_reference: bodyToSend.external_reference,
                        notification_url: bodyToSend.notification_url,
                        metadata: bodyToSend.metadata,
                    }));
                    console.log('📤 [Mercado Pago] Creando preferencia sin auto_return (fallback):', JSON.stringify({
                        back_urls: bodyWithoutAutoReturn.back_urls,
                        has_auto_return: false,
                    }, null, 2));
                    const response = await this.preference.create({ body: bodyWithoutAutoReturn });
                    console.warn('⚠️ [Mercado Pago] Preferencia creada SIN auto_return - Redirección manual requerida');
                    if (!response.id) {
                        throw new common_1.BadRequestException('No se recibió un ID de preferencia válido de Mercado Pago');
                    }
                    const preferenceId = response.id;
                    const initPoint = response.init_point || response.sandbox_init_point || '';
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
                        }),
                    });
                    await this.paymentRepo.save(payment);
                    return {
                        preferenceId: preferenceId,
                        initPoint: initPoint,
                        paymentId: payment.id,
                    };
                }
                console.error('📛 [Mercado Pago] No se usó fallback. Revisa FRONTEND_URL_NGROK (HTTPS) y que back_urls.success sea una URL pública válida.');
                throw createError;
            }
        }
        catch (error) {
            console.error('❌ Error creating Mercado Pago preference:', error);
            if (error.response?.data) {
                console.error('📋 Mercado Pago API Error Details:', JSON.stringify(error.response.data, null, 2));
            }
            if (error.cause) {
                console.error('🔍 Error cause:', error.cause);
            }
            const errorMessage = error.response?.data?.message
                || error.message
                || 'Failed to create payment preference';
            throw new common_1.BadRequestException(`Error al crear la preferencia de pago: ${errorMessage}`);
        }
    }
    async handleWebhook(data) {
        console.log('🔔 [Webhook] Received webhook data:', JSON.stringify(data, null, 2));
        try {
            if (!this.client || !this.payment) {
                console.error('❌ [Webhook] Mercado Pago client not initialized. Cannot process webhook.');
                return { success: false, message: 'Mercado Pago is not configured' };
            }
            const { type, data: webhookData } = data || {};
            if (type === 'payment') {
                const paymentId = webhookData?.id;
                if (!paymentId) {
                    console.warn('⚠️ [Webhook] Received without payment ID:', JSON.stringify(data, null, 2));
                    return { success: false, message: 'Payment ID not found' };
                }
                console.log(`📥 [Webhook] Processing payment ID: ${paymentId}`);
                const mpPayment = await this.payment.get({ id: paymentId.toString() });
                console.log('📋 [Webhook] Mercado Pago payment data:', JSON.stringify({
                    id: mpPayment.id,
                    status: mpPayment.status,
                    external_reference: mpPayment.external_reference,
                    preference_id: mpPayment.preference_id,
                    status_detail: mpPayment.status_detail,
                    transaction_amount: mpPayment.transaction_amount,
                }, null, 2));
                if (!mpPayment) {
                    return { success: false, message: 'Payment not found in Mercado Pago' };
                }
                let payment = null;
                if (mpPayment.external_reference) {
                    const allPayments = await this.paymentRepo.find({
                        where: {},
                        relations: ['order'],
                    });
                    for (const p of allPayments) {
                        try {
                            const meta = JSON.parse(p.metadata || '{}');
                            if (meta.external_reference === mpPayment.external_reference) {
                                payment = p;
                                break;
                            }
                        }
                        catch (e) {
                        }
                    }
                }
                if (!payment) {
                    payment = await this.paymentRepo.findOne({
                        where: { paymentId: paymentId.toString() },
                        relations: ['order'],
                    });
                }
                if (!payment) {
                    console.error('Payment record not found for payment_id:', paymentId);
                    return { success: false, message: 'Payment record not found' };
                }
                const foundPayment = payment;
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
                foundPayment.status = status;
                foundPayment.paymentId = paymentId.toString();
                let metadataObj = {};
                try {
                    if (foundPayment.metadata) {
                        metadataObj = JSON.parse(foundPayment.metadata);
                    }
                }
                catch (e) {
                    console.warn('Error parsing payment metadata, using empty object:', e);
                }
                if (status === 'approved' && !foundPayment.orderId && metadataObj.order_data) {
                    try {
                        console.log('💰 [Webhook] Payment approved! Creating order from payment metadata...');
                        console.log('📦 [Webhook] Order data from metadata:', JSON.stringify(metadataObj.order_data, null, 2));
                        if (!this.ordersService) {
                            this.ordersService = this.moduleRef.get(orders_service_1.OrdersService, { strict: false });
                        }
                        const orderDataWithEmail = {
                            ...metadataObj.order_data,
                            customerEmail: metadataObj.customer_email || null,
                            orderSource: 'online',
                        };
                        const orderResponse = await this.ordersService.create(orderDataWithEmail);
                        foundPayment.orderId = orderResponse.orderId;
                        console.log(`✅ [Webhook] Order created successfully!`);
                        console.log(`   Order ID: ${orderResponse.orderId}`);
                        console.log(`   Daily Order Number: ${orderResponse.dailyOrderNumber}`);
                        console.log(`   Payment ID: ${paymentId}`);
                        try {
                            const fullOrder = await this.orderRepo.findOne({
                                where: { id: orderResponse.orderId },
                                relations: ['items', 'items.product'],
                            });
                            const emailTo = metadataObj.customer_email || mpPayment?.payer?.email;
                            if (fullOrder && emailTo) {
                                const groupedItems = {};
                                for (const item of fullOrder.items) {
                                    const productId = item.product?.id || 0;
                                    const productName = item.product?.name || 'Producto';
                                    const price = item.product?.price || 0;
                                    if (!groupedItems[productId]) {
                                        groupedItems[productId] = {
                                            productName,
                                            quantity: 0,
                                            price,
                                        };
                                    }
                                    groupedItems[productId].quantity += 1;
                                }
                                const emailItems = Object.values(groupedItems);
                                const subtotal = emailItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
                                const deliveryNum = Number(fullOrder.deliveryFee) || 0;
                                const totalForEmail = (mpPayment.transaction_amount != null && mpPayment.transaction_amount !== '')
                                    ? Number(mpPayment.transaction_amount)
                                    : subtotal + deliveryNum;
                                const orderNum = fullOrder.dailyOrderNumber ?? fullOrder.id;
                                const sent = await this.mailService.sendOrderConfirmation(emailTo, orderNum, fullOrder.customerName || mpPayment.payer?.name || 'Cliente', emailItems, totalForEmail, String(fullOrder.orderType || 'delivery'), fullOrder.address, fullOrder.phone, deliveryNum > 0 ? deliveryNum : undefined);
                                if (sent) {
                                    console.log(`✅ [Webhook] Correo de confirmación enviado a ${emailTo} (orden #${orderNum})`);
                                }
                                else {
                                    console.warn('⚠️ [Webhook] Correo no enviado (revisa MAIL_* en .env)');
                                }
                            }
                            else {
                                console.warn('⚠️ [Webhook] No se envía correo: falta orden, items o email (customer_email en metadata o payer.email)');
                            }
                        }
                        catch (emailError) {
                            console.error('❌ [Webhook] Error al enviar correo de confirmación:', emailError?.message);
                            console.error('   Detalle:', emailError?.stack || emailError);
                        }
                    }
                    catch (error) {
                        console.error('❌ [Webhook] Error creating order from payment:', error);
                        console.error('❌ [Webhook] Error details:', JSON.stringify({
                            message: error.message,
                            stack: error.stack,
                            order_data: metadataObj.order_data,
                        }, null, 2));
                    }
                }
                else if (status === 'approved' && foundPayment.orderId) {
                    console.log(`✅ [Webhook] Payment already has order associated: Order ID ${foundPayment.orderId}`);
                }
                else if (status === 'approved' && !metadataObj.order_data) {
                    console.warn('⚠️ [Webhook] Payment approved but no order_data in metadata to create order');
                }
                foundPayment.metadata = JSON.stringify({
                    ...metadataObj,
                    mp_payment: mpPayment,
                });
                await this.paymentRepo.save(foundPayment);
                console.log('✅ [Webhook] Payment saved successfully');
                console.log(`   Payment ID (internal): ${foundPayment.id}`);
                console.log(`   Payment ID (Mercado Pago): ${foundPayment.paymentId}`);
                console.log(`   Order ID: ${foundPayment.orderId || 'NOT CREATED YET'}`);
                console.log(`   Status: ${foundPayment.status}`);
                return {
                    success: true,
                    paymentId: foundPayment.id,
                    status: foundPayment.status,
                    orderId: foundPayment.orderId,
                    message: foundPayment.orderId
                        ? `Order #${foundPayment.orderId} created successfully`
                        : 'Payment processed but order not created yet',
                };
            }
            return { success: true, message: 'Webhook processed (not a payment event)' };
        }
        catch (error) {
            console.error('❌ [Webhook] Error processing webhook:', error);
            console.error('❌ [Webhook] Error stack:', error.stack);
            return { success: false, message: error.message };
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
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
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
        catch (e) {
            console.warn('Error parsing payment metadata:', e);
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
        catch (e) {
            console.warn('Error parsing payment metadata:', e);
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
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(1, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        core_1.ModuleRef,
        mail_service_1.MailService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map