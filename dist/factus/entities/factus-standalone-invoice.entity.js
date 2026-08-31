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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactusStandaloneInvoice = void 0;
const typeorm_1 = require("typeorm");
let FactusStandaloneInvoice = class FactusStandaloneInvoice {
    id;
    batchId;
    batchIndex;
    referenceCode;
    customerName;
    invoiceStatus;
    invoiceNumber;
    invoiceCufe;
    publicUrl;
    qrUrl;
    issuedAt;
    invoiceError;
    plannedSum;
    invoiceCustomerDocType;
    invoiceCustomerDocNumber;
    createdAt;
};
exports.FactusStandaloneInvoice = FactusStandaloneInvoice;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], FactusStandaloneInvoice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'batch_id', type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], FactusStandaloneInvoice.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'batch_index', type: 'int' }),
    __metadata("design:type", Number)
], FactusStandaloneInvoice.prototype, "batchIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reference_code', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], FactusStandaloneInvoice.prototype, "referenceCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'customer_name', type: 'varchar', length: 100, default: 'Consumidor final' }),
    __metadata("design:type", String)
], FactusStandaloneInvoice.prototype, "customerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_status', type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], FactusStandaloneInvoice.prototype, "invoiceStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_number', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], FactusStandaloneInvoice.prototype, "invoiceNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_cufe', type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], FactusStandaloneInvoice.prototype, "invoiceCufe", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'public_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], FactusStandaloneInvoice.prototype, "publicUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'qr_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], FactusStandaloneInvoice.prototype, "qrUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'issued_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], FactusStandaloneInvoice.prototype, "issuedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_error', type: 'varchar', length: 1000, nullable: true }),
    __metadata("design:type", Object)
], FactusStandaloneInvoice.prototype, "invoiceError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'planned_sum', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FactusStandaloneInvoice.prototype, "plannedSum", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_customer_doc_type', type: 'varchar', length: 5, nullable: true }),
    __metadata("design:type", Object)
], FactusStandaloneInvoice.prototype, "invoiceCustomerDocType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_customer_doc_number', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], FactusStandaloneInvoice.prototype, "invoiceCustomerDocNumber", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], FactusStandaloneInvoice.prototype, "createdAt", void 0);
exports.FactusStandaloneInvoice = FactusStandaloneInvoice = __decorate([
    (0, typeorm_1.Entity)({ name: 'ppp_factus_standalone_invoices' }),
    (0, typeorm_1.Index)(['issuedAt']),
    (0, typeorm_1.Index)(['invoiceNumber'])
], FactusStandaloneInvoice);
//# sourceMappingURL=factus-standalone-invoice.entity.js.map