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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const payments_service_1 = require("./payments.service");
let PaymentsController = class PaymentsController {
    paymentsService;
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    async createPreference(createPreferenceDto) {
        return this.paymentsService.createPreference(createPreferenceDto.orderData, createPreferenceDto.items, createPreferenceDto.totalAmount, createPreferenceDto.customerInfo);
    }
    async handleWebhook(body, req) {
        console.log('🔔 [Webhook Controller] Received webhook request');
        console.log('📥 [Webhook Controller] Body:', JSON.stringify(body, null, 2));
        console.log('📥 [Webhook Controller] Query:', JSON.stringify(req.query, null, 2));
        console.log('📥 [Webhook Controller] Headers:', JSON.stringify(req.headers, null, 2));
        try {
            let data = body || req.body;
            if (req.query?.id) {
                data = {
                    type: 'payment',
                    data: { id: req.query.id },
                };
            }
            if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
                if (req.query?.data_id) {
                    data = {
                        type: 'payment',
                        data: { id: req.query.data_id },
                    };
                }
            }
            if (data && data.type && data.data) {
                console.log('✅ [Webhook Controller] Processing with format: { type, data: { id } }');
                const result = await this.paymentsService.handleWebhook(data);
                console.log('📤 [Webhook Controller] Webhook processing result:', JSON.stringify(result, null, 2));
                return result;
            }
            if (data && data.id && !data.type) {
                return await this.paymentsService.handleWebhook({
                    type: 'payment',
                    data: { id: data.id },
                });
            }
            if (data) {
                return await this.paymentsService.handleWebhook(data);
            }
            console.warn('Webhook received with no valid data:', { body, query: req.query });
            return { success: false, message: 'No valid webhook data received' };
        }
        catch (error) {
            console.error('Error in webhook handler:', error);
            return { success: false, message: error.message || 'Error processing webhook' };
        }
    }
    async getPaymentStatus(orderId) {
        const orderIdNum = parseInt(orderId, 10);
        return this.paymentsService.getPaymentStatus(orderIdNum);
    }
    async getPaymentByPreference(preferenceId) {
        return this.paymentsService.getPaymentByPreference(preferenceId);
    }
    async getPaymentById(paymentId) {
        const paymentIdNum = parseInt(paymentId, 10);
        return this.paymentsService.getPaymentById(paymentIdNum);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)('create-preference'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a Mercado Pago payment preference',
        description: 'Creates a payment preference in Mercado Pago and returns the payment URL.',
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                orderData: {
                    type: 'object',
                    description: 'Datos de la orden que se creará después del pago confirmado',
                },
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', example: 'Pollo Broaster' },
                            quantity: { type: 'number', example: 2 },
                            unit_price: { type: 'number', example: 25000 },
                        },
                    },
                },
                totalAmount: { type: 'number', example: 50000 },
                customerInfo: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', example: 'Juan Pérez' },
                        email: { type: 'string', example: 'juan@example.com' },
                        phone: { type: 'string', example: '+573001234567' },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Preference created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "createPreference", null);
__decorate([
    (0, common_1.Post)('webhook'),
    (0, swagger_1.ApiOperation)({
        summary: 'Mercado Pago webhook endpoint',
        description: 'Receives webhook notifications from Mercado Pago.',
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                type: { type: 'string', example: 'payment' },
                data: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: '12345678901' },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Webhook processed successfully' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "handleWebhook", null);
__decorate([
    (0, common_1.Get)('status/:orderId'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get payment status for an order',
        description: 'Returns the payment status for a given order ID.',
    }),
    (0, swagger_1.ApiParam)({ name: 'orderId', example: 125, description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment status retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Payment not found' }),
    __param(0, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getPaymentStatus", null);
__decorate([
    (0, common_1.Get)('by-preference/:preferenceId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get payment by preference ID',
        description: 'Returns payment information including order status by preference ID. Public endpoint for checkout verification.',
    }),
    (0, swagger_1.ApiParam)({ name: 'preferenceId', example: '1234567890', description: 'Mercado Pago Preference ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment information retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Payment not found' }),
    __param(0, (0, common_1.Param)('preferenceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getPaymentByPreference", null);
__decorate([
    (0, common_1.Get)('by-payment-id/:paymentId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get payment by payment ID',
        description: 'Returns payment information including order status by internal payment ID. Public endpoint for checkout verification.',
    }),
    (0, swagger_1.ApiParam)({ name: 'paymentId', example: '1', description: 'Internal Payment ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment information retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Payment not found' }),
    __param(0, (0, common_1.Param)('paymentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getPaymentById", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)('Payments'),
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map