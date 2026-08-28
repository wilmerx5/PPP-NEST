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
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const order_entity_1 = require("../orders/entities/order.entity");
const invoice_customer_entity_1 = require("./entities/invoice-customer.entity");
const factus_api_client_1 = require("./factus-api.client");
const factus_auth_service_1 = require("./factus-auth.service");
const factus_invoice_mapper_1 = require("./factus-invoice.mapper");
const factus_numbering_util_1 = require("./factus-numbering.util");
let FactusService = class FactusService {
    static { FactusService_1 = this; }
    orderRepo;
    customerRepo;
    config;
    auth;
    api;
    mapper;
    logger = new common_1.Logger(FactusService_1.name);
    creditNoteRangeCache = null;
    static NC_RANGE_CACHE_MS = 10 * 60 * 1000;
    constructor(orderRepo, customerRepo, config, auth, api, mapper) {
        this.orderRepo = orderRepo;
        this.customerRepo = customerRepo;
        this.config = config;
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
    async lookupCustomer(docType, identification) {
        const id = identification.replace(/\D/g, '');
        if (!docType || id.length < 5)
            return null;
        const row = await this.customerRepo.findOne({
            where: {
                identificationDocumentCode: docType,
                identification: id,
            },
        });
        if (!row)
            return null;
        return {
            identificationDocumentCode: row.identificationDocumentCode,
            identification: row.identification,
            dv: row.dv,
            legalOrganizationCode: row.legalOrganizationCode,
            names: row.names,
            company: row.company,
            email: row.email,
            phone: row.phone,
            address: row.address,
            municipalityCode: row.municipalityCode,
            timesUsed: row.timesUsed,
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
        const order = await this.loadOrderForInvoice(orderId);
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
        if (order.electronicInvoiceStatus === 'credit_noted') {
            throw new common_1.ConflictException({
                message: 'Esta factura ya fue anulada con nota crédito',
                creditNoteNumber: order.electronicCreditNoteNumber,
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
            order.invoiceCustomerDocDv = dto.dv?.trim() || null;
            if (dto.email)
                order.customerEmail = dto.email;
            await this.orderRepo.save(order);
            if (data?.is_validated) {
                await this.upsertInvoiceCustomer(dto);
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
    async getInvoicePdf(orderId) {
        this.requireConfigured();
        const order = await this.requireAcceptedInvoice(orderId);
        const { buffer, fileName } = await this.api.downloadBillPdf(order.electronicInvoiceNumber);
        return new common_1.StreamableFile(buffer, {
            type: 'application/pdf',
            disposition: `inline; filename="${fileName}"`,
        });
    }
    async resendInvoiceEmail(orderId, dto) {
        this.requireConfigured();
        const order = await this.requireAcceptedInvoice(orderId);
        const email = dto.email.trim();
        this.logger.log(`[FE] reenviar email orden=#${orderId} number=${order.electronicInvoiceNumber} → ${email}`);
        const result = await this.api.sendBillEmail(order.electronicInvoiceNumber, email);
        if (email) {
            order.customerEmail = email;
            await this.orderRepo.save(order);
        }
        return {
            success: true,
            orderId,
            number: order.electronicInvoiceNumber,
            email,
            message: result.message || 'Correo enviado',
        };
    }
    async cancelInvoice(orderId, dto) {
        this.requireConfigured();
        const order = await this.loadOrderForInvoice(orderId);
        if (order.electronicInvoiceStatus === 'credit_noted' && order.electronicCreditNoteNumber) {
            throw new common_1.ConflictException({
                message: 'Esta factura ya tiene nota crédito',
                creditNoteNumber: order.electronicCreditNoteNumber,
            });
        }
        if (order.electronicInvoiceStatus !== 'accepted' || !order.electronicInvoiceNumber) {
            throw new common_1.BadRequestException('Solo se pueden anular facturas electrónicas aceptadas por la DIAN');
        }
        let savedCustomer = null;
        if (order.invoiceCustomerDocType && order.invoiceCustomerDocNumber) {
            savedCustomer = await this.customerRepo.findOne({
                where: {
                    identificationDocumentCode: order.invoiceCustomerDocType,
                    identification: order.invoiceCustomerDocNumber.replace(/\D/g, ''),
                },
            });
        }
        const payload = this.mapper.buildCreditNotePayload(order, {
            observation: dto.observation,
            correctionConceptCode: dto.correctionConceptCode,
            savedCustomer,
            numberingRangeId: await this.resolveCreditNoteRangeId(),
        });
        await this.ensureCreditNoteCustomer(payload, order);
        this.logger.log(`[FE] nota crédito orden=#${orderId} bill=${payload.bill_number} ref=${payload.reference_code} ` +
            `cliente=${payload.customer.identification_document_code}:${payload.customer.identification}`);
        try {
            const result = await this.api.validateCreditNote(payload);
            const data = result.data;
            const ok = !!data?.is_validated;
            if (ok) {
                order.electronicInvoiceStatus = 'credit_noted';
                order.electronicCreditNoteNumber = data?.number || null;
                order.electronicCreditNoteCufe = data?.cufe || null;
                order.electronicCreditNotePublicUrl = data?.links?.public_url || null;
                order.electronicCreditNoteIssuedAt = new Date();
                order.electronicInvoiceError = null;
            }
            else {
                order.electronicInvoiceError = JSON.stringify(data?.errors || result.message || 'Nota crédito no validada').slice(0, 1000);
            }
            await this.orderRepo.save(order);
            if (!ok) {
                this.logger.warn(`[FE] NC rechazada orden=#${orderId}: ${result.message} ${JSON.stringify(data?.errors || {})}`);
            }
            else {
                this.logger.log(`[FE] NC OK orden=#${orderId} number=${order.electronicCreditNoteNumber}`);
            }
            return {
                success: ok,
                orderId,
                status: order.electronicInvoiceStatus,
                billNumber: order.electronicInvoiceNumber,
                creditNoteNumber: order.electronicCreditNoteNumber,
                creditNoteCufe: order.electronicCreditNoteCufe,
                creditNotePublicUrl: order.electronicCreditNotePublicUrl,
                message: result.message,
                errors: data?.errors || {},
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`[FE] NC ERROR orden=#${orderId}: ${message}`);
            order.electronicInvoiceError = message.slice(0, 1000);
            await this.orderRepo.save(order);
            throw err;
        }
    }
    async upsertInvoiceCustomer(dto) {
        const identification = dto.identification.replace(/\D/g, '');
        try {
            const existing = await this.customerRepo.findOne({
                where: {
                    identificationDocumentCode: dto.identificationDocumentCode,
                    identification,
                },
            });
            if (existing) {
                existing.dv = dto.dv?.trim() || existing.dv;
                existing.legalOrganizationCode = dto.legalOrganizationCode;
                existing.names = dto.names?.trim() || existing.names;
                existing.company = dto.company?.trim() || existing.company;
                existing.email = dto.email?.trim() || existing.email;
                existing.phone = dto.phone?.replace(/\D/g, '').slice(-10) || existing.phone;
                existing.address = dto.address?.trim() || existing.address;
                existing.municipalityCode = dto.municipalityCode?.trim() || existing.municipalityCode;
                existing.timesUsed = (existing.timesUsed || 0) + 1;
                await this.customerRepo.save(existing);
                return;
            }
            await this.customerRepo.save(this.customerRepo.create({
                identificationDocumentCode: dto.identificationDocumentCode,
                identification,
                dv: dto.dv?.trim() || null,
                legalOrganizationCode: dto.legalOrganizationCode,
                names: dto.names?.trim() || null,
                company: dto.company?.trim() || null,
                email: dto.email?.trim() || null,
                phone: dto.phone?.replace(/\D/g, '').slice(-10) || null,
                address: dto.address?.trim() || null,
                municipalityCode: dto.municipalityCode?.trim() || null,
                timesUsed: 1,
            }));
        }
        catch (err) {
            this.logger.warn(`[FE] no se pudo guardar cliente fiscal: ${err instanceof Error ? err.message : err}`);
        }
    }
    async loadOrderForInvoice(orderId) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'items.attributes', 'extras'],
        });
        if (!order) {
            this.logger.warn(`[FE] orden #${orderId} no encontrada`);
            throw new common_1.NotFoundException('Orden no encontrada');
        }
        return order;
    }
    async requireAcceptedInvoice(orderId) {
        const order = await this.orderRepo.findOne({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Orden no encontrada');
        if ((order.electronicInvoiceStatus !== 'accepted' &&
            order.electronicInvoiceStatus !== 'credit_noted') ||
            !order.electronicInvoiceNumber) {
            throw new common_1.BadRequestException('La orden no tiene factura electrónica aceptada');
        }
        return order;
    }
    requireConfigured() {
        if (!this.auth.isConfigured()) {
            throw new common_1.BadRequestException('Facturación electrónica no configurada. Pide a un admin cargar las credenciales Factus.');
        }
    }
    async ensureCreditNoteCustomer(payload, order) {
        const c = payload.customer;
        const id = c?.identification?.replace(/\D/g, '') || '';
        const complete = id.length >= 5 &&
            !!c?.identification_document_code &&
            !!c?.legal_organization_code &&
            Array.isArray(c?.responsibilities) &&
            c.responsibilities.length > 0;
        if (complete)
            return;
        if (!order.electronicInvoiceNumber) {
            throw new common_1.BadRequestException('La orden no tiene número de factura electrónica');
        }
        this.logger.log(`[FE] NC cliente incompleto orden=#${order.id} — consultando ${order.electronicInvoiceNumber} en Factus`);
        const bill = await this.api.getBill(order.electronicInvoiceNumber);
        payload.customer = this.mapper.customerFromBillDetail(bill);
    }
    async resolveCreditNoteRangeId() {
        const fromEnv = this.config.get('FACTUS_CREDIT_NOTE_RANGE_ID');
        const parsed = fromEnv ? parseInt(fromEnv, 10) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
        const now = Date.now();
        if (this.creditNoteRangeCache &&
            this.creditNoteRangeCache.expiresAt > now) {
            return this.creditNoteRangeCache.id;
        }
        const billRangeRaw = this.config.get('FACTUS_NUMBERING_RANGE_ID');
        const billRangeId = billRangeRaw ? parseInt(billRangeRaw, 10) : undefined;
        const ranges = await this.api.listNumberingRanges();
        const id = (0, factus_numbering_util_1.pickCreditNoteRangeId)(ranges, billRangeId);
        this.logger.log(`[FE] rango NC auto-detectado → id=${id}`);
        this.creditNoteRangeCache = {
            id,
            expiresAt: now + FactusService_1.NC_RANGE_CACHE_MS,
        };
        return id;
    }
    isDebug() {
        return (process.env.FACTUS_DEBUG || '').toLowerCase() === 'true';
    }
};
exports.FactusService = FactusService;
exports.FactusService = FactusService = FactusService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(invoice_customer_entity_1.InvoiceCustomer)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        factus_auth_service_1.FactusAuthService,
        factus_api_client_1.FactusApiClient,
        factus_invoice_mapper_1.FactusInvoiceMapper])
], FactusService);
//# sourceMappingURL=factus.service.js.map