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
exports.FactusController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
const valid_roles_interface_1 = require("../auth/interfaces/valid.roles.interface");
const factus_actions_dto_1 = require("./dto/factus-actions.dto");
const issue_electronic_invoice_dto_1 = require("./dto/issue-electronic-invoice.dto");
const bulk_electronic_invoice_dto_1 = require("./dto/bulk-electronic-invoice.dto");
const factus_invoice_settings_dto_1 = require("./dto/factus-invoice-settings.dto");
const update_invoice_customer_dto_1 = require("./dto/update-invoice-customer.dto");
const factus_service_1 = require("./factus.service");
const factus_invoice_settings_service_1 = require("./factus-invoice-settings.service");
const OPS = [
    valid_roles_interface_1.ValidRoles.admin,
    valid_roles_interface_1.ValidRoles.ordersUser,
    valid_roles_interface_1.ValidRoles.tableUser,
];
let FactusController = class FactusController {
    factusService;
    invoiceSettings;
    constructor(factusService, invoiceSettings) {
        this.factusService = factusService;
        this.invoiceSettings = invoiceSettings;
    }
    getStatus() {
        return this.factusService.getStatus();
    }
    getInvoiceSettings() {
        return this.invoiceSettings.getAdminSettings();
    }
    updateInvoiceSettings(dto) {
        return this.invoiceSettings.updateAdminSettings(dto);
    }
    searchCustomers(q, limit) {
        const parsedLimit = limit ? Number(limit) : 10;
        return this.factusService.searchCustomers(q, Number.isFinite(parsedLimit) ? parsedLimit : 10);
    }
    listCustomersAdmin(page, limit, search) {
        const p = page ? Number(page) : 1;
        const l = limit ? Number(limit) : 50;
        return this.factusService.listCustomersAdmin(Number.isFinite(p) ? p : 1, Number.isFinite(l) ? l : 50, search);
    }
    updateCustomerAdmin(id, dto) {
        return this.factusService.updateCustomerAdmin(id, dto);
    }
    previewBulkInvoices(dto) {
        return this.factusService.previewBulkElectronicInvoices(dto);
    }
    issueBulkInvoices(dto) {
        return this.factusService.issueBulkElectronicInvoices(dto);
    }
    lookupCustomer(identificationDocumentCode, identification) {
        return this.factusService.lookupCustomer(identificationDocumentCode, identification);
    }
    issueInvoice(id, dto) {
        return this.factusService.issueForOrder(id, dto);
    }
    downloadPdf(id) {
        return this.factusService.getInvoicePdf(id);
    }
    resendEmail(id, dto) {
        return this.factusService.resendInvoiceEmail(id, dto);
    }
    cancelInvoice(id, dto) {
        return this.factusService.cancelInvoice(id, dto);
    }
};
exports.FactusController = FactusController;
__decorate([
    (0, common_1.Get)('factus/status'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin, valid_roles_interface_1.ValidRoles.ordersUser),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Estado de configuración Factus (sin secretos)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('admin/factus/invoice-settings'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Config impuestos FE (admin) — editable sin tocar .env' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "getInvoiceSettings", null);
__decorate([
    (0, common_1.Patch)('admin/factus/invoice-settings'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Guardar impuestos FE por ítem (admin)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [factus_invoice_settings_dto_1.UpdateFactusInvoiceSettingsDto]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "updateInvoiceSettings", null);
__decorate([
    (0, common_1.Get)('factus/customers/search'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar clientes fiscales guardados por nombre (autocomplete FE)' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "searchCustomers", null);
__decorate([
    (0, common_1.Get)('admin/factus/customers'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar clientes fiscales guardados al emitir FE (admin)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "listCustomersAdmin", null);
__decorate([
    (0, common_1.Patch)('admin/factus/customers/:id'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Editar cliente fiscal guardado (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: Number }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_invoice_customer_dto_1.UpdateInvoiceCustomerDto]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "updateCustomerAdmin", null);
__decorate([
    (0, common_1.Post)('admin/factus/bulk-invoices/preview'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Preview lote FE desde catálogo (montos desiguales ≈ total)',
        description: 'Reparte productos del menú en N facturas con totales distintos que suman el objetivo. No usa órdenes del día.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_electronic_invoice_dto_1.BulkElectronicInvoicePreviewDto]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "previewBulkInvoices", null);
__decorate([
    (0, common_1.Post)('admin/factus/bulk-invoices/issue'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Emitir lote FE: crea órdenes counter + Factus (consumidor final)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_electronic_invoice_dto_1.BulkElectronicInvoiceIssueDto]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "issueBulkInvoices", null);
__decorate([
    (0, common_1.Get)('factus/customers/lookup'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar cliente fiscal guardado (autocomplete FE)' }),
    (0, swagger_1.ApiQuery)({ name: 'identificationDocumentCode', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'identification', required: true }),
    __param(0, (0, common_1.Query)('identificationDocumentCode')),
    __param(1, (0, common_1.Query)('identification')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "lookupCustomer", null);
__decorate([
    (0, common_1.Post)('orders/:id/electronic-invoice'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Emitir factura electrónica manual (Factus → DIAN)',
        description: 'No se factura automáticamente. Solo cuando el operador lo pide desde tomar pedidos. PPP es la fuente de verdad; Factus solo transmite.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID de la orden PPP' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Factura creada/validada' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Datos incompletos o Factus rechazó' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Orden ya facturada' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, issue_electronic_invoice_dto_1.IssueElectronicInvoiceDto]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "issueInvoice", null);
__decorate([
    (0, common_1.Get)('orders/:id/electronic-invoice/pdf'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Descargar / imprimir PDF de la factura electrónica' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID de la orden PPP' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "downloadPdf", null);
__decorate([
    (0, common_1.Post)('orders/:id/electronic-invoice/resend-email'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Reenviar factura electrónica por correo' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, factus_actions_dto_1.ResendElectronicInvoiceEmailDto]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "resendEmail", null);
__decorate([
    (0, common_1.Post)('orders/:id/electronic-invoice/cancel'),
    (0, auth_decorator_1.Auth)(...OPS),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Anular factura electrónica (nota crédito Factus → DIAN)',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, factus_actions_dto_1.CancelElectronicInvoiceDto]),
    __metadata("design:returntype", void 0)
], FactusController.prototype, "cancelInvoice", null);
exports.FactusController = FactusController = __decorate([
    (0, swagger_1.ApiTags)('Facturación electrónica (Factus)'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [factus_service_1.FactusService,
        factus_invoice_settings_service_1.FactusInvoiceSettingsService])
], FactusController);
//# sourceMappingURL=factus.controller.js.map