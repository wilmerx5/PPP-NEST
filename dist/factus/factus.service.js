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
var FactusService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactusService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const order_entity_1 = require("../orders/entities/order.entity");
const factus_api_client_1 = require("./factus-api.client");
const factus_auth_service_1 = require("./factus-auth.service");
const factus_invoice_mapper_1 = require("./factus-invoice.mapper");
let FactusService = FactusService_1 = class FactusService {
    orderRepo;
    auth;
    api;
    mapper;
    logger = new common_1.Logger(FactusService_1.name);
    constructor(orderRepo, auth, api, mapper) {
        this.orderRepo = orderRepo;
        this.auth = auth;
        this.api = api;
        this.mapper = mapper;
    }
    getStatus() {
        const env = (process.env.FACTUS_ENV || 'sandbox').toLowerCase();
        return {
            configured: this.auth.isConfigured(),
            env,
            baseUrl: this.auth.getBaseUrl(),
        };
    }
    async issueForOrder(orderId, dto) {
        const debug = this.isDebug();
        this.logger.log(`[FE] inicio orden=#${orderId} env=${process.env.FACTUS_ENV || 'sandbox'} ` +
            `doc=${dto.identificationDocumentCode}:${dto.identification} ` +
            `persona=${dto.legalOrganizationCode}`);
        if (!this.auth.isConfigured()) {
            this.logger.error('[FE] Factus no configurado (faltan FACTUS_* en .env)');
            throw new common_1.BadRequestException('Facturación electrónica no configurada. Pide a un admin cargar las credenciales Factus.');
        }
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        if (!order) {
            this.logger.warn(`[FE] orden #${orderId} no encontrada`);
            throw new common_1.NotFoundException('Orden no encontrada');
        }
        if (order.orderStatus === 'canceled') {
            this.logger.warn(`[FE] orden #${orderId} anulada — no facturable`);
            throw new common_1.BadRequestException('No se puede facturar una orden anulada');
        }
        if (order.electronicInvoiceStatus === 'accepted' && order.electronicInvoiceNumber) {
            this.logger.warn(`[FE] orden #${orderId} ya facturada → ${order.electronicInvoiceNumber}`);
            throw new common_1.ConflictException({
                message: 'Esta orden ya tiene factura electrónica',
                number: order.electronicInvoiceNumber,
                cufe: order.electronicInvoiceCufe,
                publicUrl: order.electronicInvoicePublicUrl,
            });
        }
        if (!order.items?.length && !order.extras?.length) {
            this.logger.warn(`[FE] orden #${orderId} sin ítems`);
            throw new common_1.BadRequestException('La orden no tiene ítems para facturar');
        }
        if (dto.legalOrganizationCode === '2' && !dto.names?.trim() && !order.customerName?.trim()) {
            throw new common_1.BadRequestException('Indica el nombre del cliente');
        }
        if (dto.legalOrganizationCode === '1' && !dto.company?.trim()) {
            throw new common_1.BadRequestException('Indica la razón social');
        }
        order.electronicInvoiceStatus = 'pending';
        order.electronicInvoiceError = null;
        order.electronicInvoiceReference = `PPP-ORD-${order.id}`;
        await this.orderRepo.save(order);
        const { payload, invoiceTotal } = this.mapper.buildValidatePayload(order, dto);
        this.logger.log(`[FE] payload listo orden=#${order.id} ref=${payload.reference_code} ` +
            `items=${payload.items?.length ?? 0} total≈${invoiceTotal} ` +
            `cliente=${payload.customer?.names || payload.customer?.company || '?'}`);
        if (debug) {
            this.logger.debug(`[FE] payload completo: ${JSON.stringify(payload)}`);
        }
        try {
            const result = await this.api.validateBill(payload);
            const data = result.data;
            order.electronicInvoiceStatus = data?.is_validated ? 'accepted' : 'rejected';
            order.electronicInvoiceNumber = data?.number || null;
            order.electronicInvoiceCufe = data?.cufe || null;
            order.electronicInvoicePublicUrl = data?.links?.public_url || null;
            order.electronicInvoiceQrUrl = data?.links?.qr || null;
            order.electronicInvoiceIssuedAt = new Date();
            order.electronicInvoiceError = data?.is_validated
                ? null
                : JSON.stringify(data?.errors || result.message || 'No validada').slice(0, 1000);
            order.invoiceCustomerDocType = dto.identificationDocumentCode;
            order.invoiceCustomerDocNumber = dto.identification.replace(/\D/g, '');
            if (dto.email)
                order.customerEmail = dto.email;
            await this.orderRepo.save(order);
            if (data?.is_validated) {
                this.logger.log(`[FE] OK orden=#${order.id} number=${order.electronicInvoiceNumber} ` +
                    `cufe=${(order.electronicInvoiceCufe || '').slice(0, 24)}… ` +
                    `url=${order.electronicInvoicePublicUrl || '-'}`);
            }
            else {
                this.logger.warn(`[FE] RECHAZADA/sin validar orden=#${order.id} number=${order.electronicInvoiceNumber} ` +
                    `msg=${result.message} errors=${JSON.stringify(data?.errors || {})}`);
            }
            if (debug && data?.errors && Object.keys(data.errors).length) {
                this.logger.debug(`[FE] avisos DIAN: ${JSON.stringify(data.errors)}`);
            }
            return {
                success: !!data?.is_validated,
                orderId: order.id,
                status: order.electronicInvoiceStatus,
                number: order.electronicInvoiceNumber,
                cufe: order.electronicInvoiceCufe,
                publicUrl: order.electronicInvoicePublicUrl,
                qrUrl: order.electronicInvoiceQrUrl,
                message: result.message,
                errors: data?.errors || {},
                totals: data?.totals,
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : undefined;
            this.logger.error(`[FE] ERROR orden=#${order.id} ref=${payload.reference_code}: ${message}`, stack);
            order.electronicInvoiceStatus = 'error';
            order.electronicInvoiceError = message.slice(0, 1000);
            await this.orderRepo.save(order);
            throw err;
        }
    }
    isDebug() {
        return (process.env.FACTUS_DEBUG || '').toLowerCase() === 'true';
    }
};
exports.FactusService = FactusService;
exports.FactusService = FactusService = FactusService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        factus_auth_service_1.FactusAuthService,
        factus_api_client_1.FactusApiClient,
        factus_invoice_mapper_1.FactusInvoiceMapper])
], FactusService);
//# sourceMappingURL=factus.service.js.map