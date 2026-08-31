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
const products_service_1 = require("../products/products.service");
const invoice_customer_entity_1 = require("./entities/invoice-customer.entity");
const factus_standalone_invoice_entity_1 = require("./entities/factus-standalone-invoice.entity");
const factus_api_client_1 = require("./factus-api.client");
const factus_auth_service_1 = require("./factus-auth.service");
const factus_invoice_mapper_1 = require("./factus-invoice.mapper");
const factus_invoice_settings_service_1 = require("./factus-invoice-settings.service");
const factus_invoice_customer_util_1 = require("./factus-invoice-customer.util");
const factus_customer_utils_1 = require("./factus-customer.utils");
const factus_numbering_util_1 = require("./factus-numbering.util");
const factus_bulk_select_util_1 = require("./factus-bulk-select.util");
const date_util_1 = require("../common/utils/date.util");
const BULK_CONSUMIDOR_FINAL = {
    identificationDocumentCode: '13',
    identification: '222222222222',
    legalOrganizationCode: '2',
    names: 'Consumidor final',
    sendEmail: false,
};
let FactusService = class FactusService {
    static { FactusService_1 = this; }
    orderRepo;
    customerRepo;
    standaloneInvoiceRepo;
    config;
    auth;
    api;
    mapper;
    invoiceSettings;
    productsService;
    logger = new common_1.Logger(FactusService_1.name);
    creditNoteRangeCache = null;
    static NC_RANGE_CACHE_MS = 10 * 60 * 1000;
    constructor(orderRepo, customerRepo, standaloneInvoiceRepo, config, auth, api, mapper, invoiceSettings, productsService) {
        this.orderRepo = orderRepo;
        this.customerRepo = customerRepo;
        this.standaloneInvoiceRepo = standaloneInvoiceRepo;
        this.config = config;
        this.auth = auth;
        this.api = api;
        this.mapper = mapper;
        this.invoiceSettings = invoiceSettings;
        this.productsService = productsService;
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
        return this.toInvoiceCustomerDto(row);
    }
    async searchCustomers(query, limit = 10) {
        const q = query.trim();
        if (q.length < 2)
            return [];
        const pattern = `%${(0, factus_invoice_customer_util_1.escapeLikePattern)(q)}%`;
        const idDigits = q.replace(/\D/g, '');
        const qb = this.customerRepo.createQueryBuilder('c');
        if (idDigits.length >= 3) {
            qb.where(`(${(0, factus_invoice_customer_util_1.invoiceCustomerTextSearchSql)('c')} OR c.identification LIKE :idPattern)`, { pattern, idPattern: `%${idDigits}%` });
        }
        else {
            qb.where((0, factus_invoice_customer_util_1.invoiceCustomerTextSearchSql)('c'), { pattern });
        }
        const rows = await qb
            .orderBy('c.times_used', 'DESC')
            .addOrderBy('c.updated_at', 'DESC')
            .take(Math.min(Math.max(limit, 1), 20))
            .getMany();
        return rows.map((row) => this.toInvoiceCustomerDto(row));
    }
    async listCustomersAdmin(page = 1, limit = 50, search) {
        const safePage = Math.max(1, page);
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const qb = this.customerRepo.createQueryBuilder('c');
        if (search?.trim()) {
            (0, factus_invoice_customer_util_1.applyInvoiceCustomerSearchFilter)(qb, search);
        }
        qb.orderBy('c.times_used', 'DESC').addOrderBy('c.updated_at', 'DESC');
        const [rows, total] = await qb
            .skip((safePage - 1) * safeLimit)
            .take(safeLimit)
            .getManyAndCount();
        return {
            data: rows.map((row) => ({
                id: row.id,
                ...this.toInvoiceCustomerDto(row),
                displayName: (0, factus_customer_utils_1.invoiceCustomerDisplayName)(row),
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            })),
            total,
            page: safePage,
            limit: safeLimit,
            totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        };
    }
    async updateCustomerAdmin(id, dto) {
        const row = await (0, factus_invoice_customer_util_1.updateInvoiceCustomerRow)(this.customerRepo, id, dto);
        return {
            id: row.id,
            ...this.toInvoiceCustomerDto(row),
            displayName: (0, factus_customer_utils_1.invoiceCustomerDisplayName)(row),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    toInvoiceCustomerDto(row) {
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
            updatedAt: row.updatedAt,
        };
    }
    normalizeIssueDto(dto) {
        const legalOrganizationCode = dto.legalOrganizationCode ||
            (0, factus_customer_utils_1.resolveLegalOrganizationFromDocType)(dto.identificationDocumentCode);
        return { ...dto, legalOrganizationCode };
    }
    async issueForOrder(orderId, rawDto) {
        const dto = this.normalizeIssueDto(rawDto);
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
        const taxConfig = await this.invoiceSettings.getResolvedTaxConfig();
        const { payload, invoiceTotal } = this.mapper.buildValidatePayload(order, dto, taxConfig);
        this.logger.log(`[FE] payload listo orden=#${order.id} ref=${payload.reference_code} ` +
            `items=${payload.items?.length ?? 0} total≈${invoiceTotal} ` +
            `impuestos=${taxConfig.source} ` +
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
        const taxConfig = await this.invoiceSettings.getResolvedTaxConfig();
        const payload = this.mapper.buildCreditNotePayload(order, {
            observation: dto.observation,
            correctionConceptCode: dto.correctionConceptCode,
            savedCustomer,
            numberingRangeId: await this.resolveCreditNoteRangeId(),
            taxConfig,
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
        const legalOrganizationCode = dto.legalOrganizationCode ||
            (0, factus_customer_utils_1.resolveLegalOrganizationFromDocType)(dto.identificationDocumentCode);
        try {
            const existing = await this.customerRepo.findOne({
                where: {
                    identificationDocumentCode: dto.identificationDocumentCode,
                    identification,
                },
            });
            if (existing) {
                existing.dv = dto.dv?.trim() || existing.dv;
                existing.legalOrganizationCode = legalOrganizationCode;
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
                legalOrganizationCode,
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
    async previewBulkElectronicInvoices(dto) {
        const catalog = await this.loadBulkCatalogProducts();
        const plan = (0, factus_bulk_select_util_1.planBulkInvoicesFromCatalog)(Math.round(dto.targetTotal), dto.quantity, catalog, dto.maxDeviationRatio ?? 0.08);
        return {
            ...plan,
            catalogSize: catalog.length,
        };
    }
    async issueBulkElectronicInvoices(dto) {
        if (!this.auth.isConfigured()) {
            throw new common_1.BadRequestException('Facturación electrónica no configurada. Pide a un admin cargar las credenciales Factus.');
        }
        let invoices = dto.invoices || [];
        if (!invoices.length) {
            if (dto.targetTotal == null || dto.quantity == null) {
                throw new common_1.BadRequestException('Envía el plan (invoices) o targetTotal + quantity para regenerarlo');
            }
            const catalog = await this.loadBulkCatalogProducts();
            const plan = (0, factus_bulk_select_util_1.planBulkInvoicesFromCatalog)(Math.round(dto.targetTotal), dto.quantity, catalog, dto.maxDeviationRatio ?? 0.08);
            invoices = plan.invoices;
        }
        if (!invoices.length) {
            throw new common_1.BadRequestException('No hay facturas para emitir');
        }
        if (invoices.length > 40) {
            throw new common_1.BadRequestException('Máximo 40 facturas por lote');
        }
        for (const inv of invoices) {
            if (!inv.lines?.length) {
                throw new common_1.BadRequestException(`La factura #${inv.index} no tiene productos`);
            }
        }
        const issueDto = {
            ...BULK_CONSUMIDOR_FINAL,
            sendEmail: dto.sendEmail === true,
            paymentMethodCode: dto.paymentMethodCode,
            observation: dto.observation?.slice(0, 250) || 'Lote FE admin (catálogo)',
        };
        const taxConfig = await this.invoiceSettings.getResolvedTaxConfig();
        const batchId = `lote-${Date.now()}`;
        const results = [];
        for (const inv of invoices) {
            try {
                const referenceCode = `PPP-LOTE-${batchId}-${inv.index}`.slice(0, 100);
                const { payload, invoiceTotal } = this.mapper.buildValidatePayloadFromCatalogLines(inv.lines, issueDto, taxConfig, {
                    referenceCode,
                    observation: issueDto.observation,
                });
                this.logger.log(`[FE bulk] #${inv.index} ref=${referenceCode} items=${payload.items.length} total≈${invoiceTotal}`);
                const result = await this.api.validateBill(payload);
                const data = result.data;
                if (data?.is_validated) {
                    await this.upsertInvoiceCustomer(issueDto);
                    await this.standaloneInvoiceRepo.save(this.standaloneInvoiceRepo.create({
                        batchId,
                        batchIndex: inv.index,
                        referenceCode,
                        customerName: issueDto.names || 'Consumidor final',
                        invoiceStatus: 'accepted',
                        invoiceNumber: data?.number ?? null,
                        invoiceCufe: data?.cufe ?? null,
                        publicUrl: data?.links?.public_url ?? null,
                        qrUrl: data?.links?.qr_url ?? null,
                        issuedAt: new Date(),
                        plannedSum: inv.sum,
                        invoiceCustomerDocType: issueDto.identificationDocumentCode,
                        invoiceCustomerDocNumber: issueDto.identification,
                    }));
                    results.push({
                        index: inv.index,
                        ok: true,
                        sum: inv.sum,
                        number: data?.number ?? null,
                        cufe: data?.cufe ?? null,
                        publicUrl: data?.links?.public_url ?? null,
                    });
                }
                else {
                    const errMsg = result.message ||
                        JSON.stringify(data?.errors || 'Factura no validada por DIAN').slice(0, 400);
                    await this.standaloneInvoiceRepo.save(this.standaloneInvoiceRepo.create({
                        batchId,
                        batchIndex: inv.index,
                        referenceCode,
                        customerName: issueDto.names || 'Consumidor final',
                        invoiceStatus: 'rejected',
                        invoiceNumber: data?.number ?? null,
                        invoiceError: errMsg,
                        plannedSum: inv.sum,
                        invoiceCustomerDocType: issueDto.identificationDocumentCode,
                        invoiceCustomerDocNumber: issueDto.identification,
                    }));
                    results.push({
                        index: inv.index,
                        ok: false,
                        sum: inv.sum,
                        number: data?.number ?? null,
                        error: errMsg,
                    });
                }
            }
            catch (err) {
                const message = err instanceof Error
                    ? err.message
                    : typeof err === 'object' && err && 'message' in err
                        ? String(err.message)
                        : 'Error al emitir';
                this.logger.warn(`[FE bulk] factura #${inv.index} falló: ${message}`);
                const referenceCode = `PPP-LOTE-${batchId}-${inv.index}`.slice(0, 100);
                await this.standaloneInvoiceRepo.save(this.standaloneInvoiceRepo.create({
                    batchId,
                    batchIndex: inv.index,
                    referenceCode,
                    customerName: issueDto.names || 'Consumidor final',
                    invoiceStatus: 'error',
                    invoiceError: message.slice(0, 1000),
                    plannedSum: inv.sum,
                    invoiceCustomerDocType: issueDto.identificationDocumentCode,
                    invoiceCustomerDocNumber: issueDto.identification,
                }));
                results.push({ index: inv.index, ok: false, sum: inv.sum, error: message });
            }
        }
        const okCount = results.filter((r) => r.ok).length;
        return {
            total: results.length,
            okCount,
            failCount: results.length - okCount,
            results,
        };
    }
    async findElectronicInvoicesForAdmin(opts) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(opts.from) || !dateRegex.test(opts.to)) {
            throw new common_1.BadRequestException('from/to deben ser YYYY-MM-DD');
        }
        if (opts.from > opts.to) {
            throw new common_1.BadRequestException('from no puede ser mayor que to');
        }
        const { start } = (0, date_util_1.getBogotaDateRange)(opts.from);
        const { end } = (0, date_util_1.getBogotaDateRange)(opts.to);
        const page = Math.max(1, opts.page || 1);
        const limit = opts.exportMode
            ? Math.min(10_000, Math.max(1, opts.limit || 10_000))
            : Math.min(100, Math.max(1, opts.limit || 25));
        const status = (opts.status || 'all').trim().toLowerCase();
        const search = opts.search?.trim() || '';
        const orderBaseQb = () => {
            const qb = this.orderRepo
                .createQueryBuilder('o')
                .where('o.electronicInvoiceStatus IS NOT NULL')
                .andWhere("o.electronicInvoiceStatus != :none", { none: 'none' })
                .andWhere(`(
            (o.electronicInvoiceIssuedAt IS NOT NULL AND o.electronicInvoiceIssuedAt BETWEEN :start AND :end)
            OR (o.electronicInvoiceIssuedAt IS NULL AND o.createdAt BETWEEN :start AND :end)
          )`, { start, end });
            if (status && status !== 'all') {
                qb.andWhere('o.electronicInvoiceStatus = :status', { status });
            }
            if (search) {
                const like = `%${search}%`;
                qb.andWhere(`(
            o.electronicInvoiceNumber LIKE :like
            OR o.electronicCreditNoteNumber LIKE :like
            OR o.customerName LIKE :like
            OR o.invoiceCustomerDocNumber LIKE :like
            OR CAST(o.dailyOrderNumber AS CHAR) LIKE :like
            OR CAST(o.id AS CHAR) LIKE :like
          )`, { like });
            }
            return qb;
        };
        const standaloneBaseQb = () => {
            const qb = this.standaloneInvoiceRepo
                .createQueryBuilder('s')
                .where(`(
            (s.issuedAt IS NOT NULL AND s.issuedAt BETWEEN :start AND :end)
            OR (s.issuedAt IS NULL AND s.createdAt BETWEEN :start AND :end)
          )`, { start, end });
            if (status && status !== 'all') {
                qb.andWhere('s.invoiceStatus = :status', { status });
            }
            if (search) {
                const like = `%${search}%`;
                qb.andWhere(`(
            s.invoiceNumber LIKE :like
            OR s.referenceCode LIKE :like
            OR s.customerName LIKE :like
            OR s.invoiceCustomerDocNumber LIKE :like
            OR CAST(s.batchIndex AS CHAR) LIKE :like
            OR s.batchId LIKE :like
          )`, { like });
            }
            return qb;
        };
        const summary = {
            accepted: 0,
            credit_noted: 0,
            rejected: 0,
            error: 0,
            pending: 0,
            total: 0,
        };
        const orderSummaryRows = await orderBaseQb()
            .select('o.electronicInvoiceStatus', 'status')
            .addSelect('COUNT(*)', 'c')
            .groupBy('o.electronicInvoiceStatus')
            .getRawMany();
        for (const row of orderSummaryRows) {
            const n = Number(row.c) || 0;
            summary[row.status] = (summary[row.status] || 0) + n;
            summary.total += n;
        }
        const standaloneSummaryRows = await standaloneBaseQb()
            .select('s.invoiceStatus', 'status')
            .addSelect('COUNT(*)', 'c')
            .groupBy('s.invoiceStatus')
            .getRawMany();
        for (const row of standaloneSummaryRows) {
            const n = Number(row.c) || 0;
            summary[row.status] = (summary[row.status] || 0) + n;
            summary.total += n;
        }
        const orders = await orderBaseQb()
            .orderBy('COALESCE(o.electronic_invoice_issued_at, o.created_at)', 'DESC')
            .getMany();
        const standalones = await standaloneBaseQb()
            .orderBy('COALESCE(s.issued_at, s.created_at)', 'DESC')
            .getMany();
        const orderItems = orders.map((o) => ({
            source: 'order',
            orderId: o.id,
            dailyOrderNumber: o.dailyOrderNumber,
            customerName: o.customerName,
            phone: o.phone,
            orderType: o.orderType,
            orderStatus: o.orderStatus,
            createdAt: (0, date_util_1.formatToBogotaISO)(o.createdAt),
            electronicInvoiceStatus: o.electronicInvoiceStatus ?? 'none',
            electronicInvoiceNumber: o.electronicInvoiceNumber ?? null,
            electronicInvoiceCufe: o.electronicInvoiceCufe ?? null,
            electronicInvoicePublicUrl: o.electronicInvoicePublicUrl ?? null,
            electronicInvoiceQrUrl: o.electronicInvoiceQrUrl ?? null,
            electronicInvoiceIssuedAt: (0, date_util_1.formatToBogotaISO)(o.electronicInvoiceIssuedAt),
            electronicInvoiceError: o.electronicInvoiceError ?? null,
            electronicCreditNoteNumber: o.electronicCreditNoteNumber ?? null,
            electronicCreditNoteCufe: o.electronicCreditNoteCufe ?? null,
            electronicCreditNotePublicUrl: o.electronicCreditNotePublicUrl ?? null,
            electronicCreditNoteIssuedAt: (0, date_util_1.formatToBogotaISO)(o.electronicCreditNoteIssuedAt),
            invoiceCustomerDocType: o.invoiceCustomerDocType ?? null,
            invoiceCustomerDocNumber: o.invoiceCustomerDocNumber ?? null,
            invoiceCustomerDocDv: o.invoiceCustomerDocDv ?? null,
            customerEmail: o.customerEmail ?? null,
            _sortAt: o.electronicInvoiceIssuedAt ?? o.createdAt,
        }));
        const bulkItems = standalones.map((s) => ({
            source: 'bulk',
            bulkInvoiceId: s.id,
            batchId: s.batchId,
            batchIndex: s.batchIndex,
            orderId: null,
            dailyOrderNumber: null,
            customerName: s.customerName,
            phone: null,
            orderType: 'bulk',
            orderStatus: '—',
            createdAt: (0, date_util_1.formatToBogotaISO)(s.createdAt),
            electronicInvoiceStatus: s.invoiceStatus,
            electronicInvoiceNumber: s.invoiceNumber,
            electronicInvoiceCufe: s.invoiceCufe,
            electronicInvoicePublicUrl: s.publicUrl,
            electronicInvoiceQrUrl: s.qrUrl,
            electronicInvoiceIssuedAt: (0, date_util_1.formatToBogotaISO)(s.issuedAt),
            electronicInvoiceError: s.invoiceError,
            electronicCreditNoteNumber: null,
            electronicCreditNoteCufe: null,
            electronicCreditNotePublicUrl: null,
            electronicCreditNoteIssuedAt: null,
            invoiceCustomerDocType: s.invoiceCustomerDocType,
            invoiceCustomerDocNumber: s.invoiceCustomerDocNumber,
            invoiceCustomerDocDv: null,
            customerEmail: null,
            _sortAt: s.issuedAt ?? s.createdAt,
        }));
        const merged = [...orderItems, ...bulkItems].sort((a, b) => {
            const ta = a._sortAt ? new Date(a._sortAt).getTime() : 0;
            const tb = b._sortAt ? new Date(b._sortAt).getTime() : 0;
            return tb - ta;
        });
        const total = merged.length;
        const pageItems = opts.exportMode
            ? merged
            : merged.slice((page - 1) * limit, page * limit);
        const items = pageItems.map(({ _sortAt, ...row }) => row);
        return {
            from: opts.from,
            to: opts.to,
            page,
            limit,
            total,
            summary,
            items,
        };
    }
    async exportElectronicInvoicesCsv(opts) {
        const data = await this.findElectronicInvoicesForAdmin({
            ...opts,
            page: 1,
            limit: 10_000,
            exportMode: true,
        });
        const headers = [
            'origen',
            'pedido_diario',
            'order_id',
            'lote_id',
            'cliente',
            'telefono',
            'email',
            'tipo_doc',
            'documento',
            'dv',
            'estado_fe',
            'numero_fe',
            'cufe',
            'url_publica',
            'emitida_at',
            'numero_nc',
            'cufe_nc',
            'nc_at',
            'error',
            'tipo_orden',
            'estado_orden',
            'creada_at',
        ];
        const escape = (v) => {
            if (v == null || v === '')
                return '';
            const s = String(v);
            if (/[",\n\r]/.test(s))
                return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
        const lines = [headers.join(',')];
        for (const row of data.items) {
            lines.push([
                row.source === 'bulk' ? 'lote' : 'pedido',
                row.dailyOrderNumber ?? (row.batchIndex != null ? `Lote #${row.batchIndex}` : ''),
                row.orderId ?? '',
                row.batchId ?? '',
                row.customerName,
                row.phone,
                row.customerEmail,
                row.invoiceCustomerDocType,
                row.invoiceCustomerDocNumber,
                row.invoiceCustomerDocDv,
                row.electronicInvoiceStatus,
                row.electronicInvoiceNumber,
                row.electronicInvoiceCufe,
                row.electronicInvoicePublicUrl,
                row.electronicInvoiceIssuedAt,
                row.electronicCreditNoteNumber,
                row.electronicCreditNoteCufe,
                row.electronicCreditNoteIssuedAt,
                row.electronicInvoiceError,
                row.orderType,
                row.orderStatus,
                row.createdAt,
            ]
                .map(escape)
                .join(','));
        }
        return {
            filename: `facturas-fe_${opts.from}_${opts.to}.csv`,
            csv: lines.join('\n'),
        };
    }
    async backfillStandaloneInvoicesFromFactus(opts) {
        if (!this.auth.isConfigured()) {
            throw new common_1.BadRequestException('Factus no está configurado');
        }
        const limit = Math.min(50, Math.max(1, opts?.limit ?? 1));
        const includeOrderInvoices = opts?.includeOrderInvoices === true;
        const perPage = 20;
        const maxPages = 10;
        const lotePrefix = 'PPP-LOTE-';
        const toProcess = [];
        let fetched = 0;
        for (let page = 1; page <= maxPages && toProcess.length < limit; page += 1) {
            const listRes = await this.api.listBills({ page, perPage });
            const rows = listRes.data?.data ?? [];
            if (!rows.length)
                break;
            fetched += rows.length;
            for (const row of rows) {
                const ref = row.reference_code || '';
                if (!ref || !row.number)
                    continue;
                if (!includeOrderInvoices && !ref.startsWith(lotePrefix))
                    continue;
                toProcess.push(row);
                if (toProcess.length >= limit)
                    break;
            }
            const lastPage = listRes.data?.last_page ?? page;
            if (page >= lastPage)
                break;
        }
        const result = {
            fetched,
            candidates: toProcess.length,
            inserted: 0,
            skipped: 0,
            items: [],
        };
        for (const summary of toProcess) {
            const number = summary.number?.trim();
            const ref = summary.reference_code?.trim() || '';
            if (!number)
                continue;
            if (!includeOrderInvoices && !ref.startsWith(lotePrefix)) {
                result.skipped += 1;
                result.items.push({
                    number,
                    action: 'skipped_not_lote',
                    reason: ref || 'sin reference_code',
                });
                continue;
            }
            const existingStandalone = await this.standaloneInvoiceRepo.findOne({
                where: { invoiceNumber: number },
            });
            if (existingStandalone) {
                result.skipped += 1;
                result.items.push({
                    number,
                    action: 'skipped_exists',
                    id: existingStandalone.id,
                    reason: 'ya en ppp_factus_standalone_invoices',
                });
                continue;
            }
            const linkedOrder = await this.orderRepo.findOne({
                where: { electronicInvoiceNumber: number },
            });
            if (linkedOrder) {
                result.skipped += 1;
                result.items.push({
                    number,
                    action: 'skipped_order',
                    reason: `orden PPP #${linkedOrder.id}`,
                });
                continue;
            }
            let detail = summary;
            if (!detail.cufe || !detail.links?.public_url) {
                try {
                    detail = await this.api.getBill(number);
                }
                catch (err) {
                    this.logger.warn(`[FE backfill] getBill ${number} falló: ${err instanceof Error ? err.message : err}`);
                }
            }
            const { batchId, batchIndex } = this.parseLoteReferenceCode(detail.reference_code || ref);
            const customer = detail.customer;
            const customerName = customer?.names ||
                customer?.graphic_representation_name ||
                customer?.company ||
                'Consumidor final';
            const plannedSum = Math.round(Number.parseFloat(String(detail.total ?? summary.total ?? '0')) || 0);
            const saved = await this.standaloneInvoiceRepo.save(this.standaloneInvoiceRepo.create({
                batchId,
                batchIndex,
                referenceCode: (detail.reference_code || ref).slice(0, 100),
                customerName: customerName.slice(0, 100),
                invoiceStatus: detail.is_validated === false ? 'rejected' : 'accepted',
                invoiceNumber: number,
                invoiceCufe: detail.cufe ?? null,
                publicUrl: detail.links?.public_url ?? null,
                qrUrl: detail.links?.qr ?? null,
                issuedAt: this.parseFactusDateTime(detail.validated_at) ||
                    this.parseFactusDateTime(detail.created_at) ||
                    new Date(),
                plannedSum,
                invoiceCustomerDocType: customer?.identification_document?.code ?? null,
                invoiceCustomerDocNumber: customer?.identification ?? null,
            }));
            result.inserted += 1;
            result.items.push({ number, action: 'inserted', id: saved.id });
            this.logger.log(`[FE backfill] guardada ${number} → standalone id=${saved.id} batch=${batchId}#${batchIndex}`);
        }
        return result;
    }
    parseLoteReferenceCode(referenceCode) {
        const ref = referenceCode.trim();
        const m = ref.match(/^PPP-LOTE-(.+)-(\d+)$/);
        if (m) {
            return { batchId: m[1].slice(0, 64), batchIndex: parseInt(m[2], 10) || 1 };
        }
        return {
            batchId: `backfill-${Date.now()}`.slice(0, 64),
            batchIndex: 1,
        };
    }
    parseFactusDateTime(value) {
        if (!value)
            return null;
        const m = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
        if (!m)
            return null;
        let hour = parseInt(m[4], 10);
        const ampm = m[7].toUpperCase();
        if (ampm === 'PM' && hour < 12)
            hour += 12;
        if (ampm === 'AM' && hour === 12)
            hour = 0;
        return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), hour, parseInt(m[5], 10), parseInt(m[6], 10));
    }
    async loadBulkCatalogProducts() {
        const all = await this.productsService.findAll();
        return (all || [])
            .filter((p) => p?.isActive !== false && Number(p.price) > 0)
            .map((p) => {
            const defaultAttributes = [];
            if (p.hasAttributes && Array.isArray(p.attributes)) {
                for (const attr of p.attributes) {
                    const name = String(attr?.attributeName || '').trim();
                    const options = Array.isArray(attr?.options)
                        ? attr.options
                        : typeof attr?.options === 'string'
                            ? (() => {
                                try {
                                    return JSON.parse(attr.options);
                                }
                                catch {
                                    return [];
                                }
                            })()
                            : [];
                    const first = String(options?.[0] || '').trim();
                    if (name && first) {
                        defaultAttributes.push({
                            attributeName: name,
                            attributeValue: first,
                        });
                    }
                }
            }
            return {
                id: p.id,
                name: p.name,
                code: Number(p.code),
                price: Math.round(Number(p.price)),
                ...(defaultAttributes.length ? { defaultAttributes } : {}),
            };
        });
    }
};
exports.FactusService = FactusService;
exports.FactusService = FactusService = FactusService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(invoice_customer_entity_1.InvoiceCustomer)),
    __param(2, (0, typeorm_1.InjectRepository)(factus_standalone_invoice_entity_1.FactusStandaloneInvoice)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        factus_auth_service_1.FactusAuthService,
        factus_api_client_1.FactusApiClient,
        factus_invoice_mapper_1.FactusInvoiceMapper,
        factus_invoice_settings_service_1.FactusInvoiceSettingsService,
        products_service_1.ProductsService])
], FactusService);
//# sourceMappingURL=factus.service.js.map