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
exports.InvoiceCustomer = void 0;
const typeorm_1 = require("typeorm");
let InvoiceCustomer = class InvoiceCustomer {
    id;
    identificationDocumentCode;
    identification;
    dv;
    legalOrganizationCode;
    names;
    company;
    email;
    phone;
    address;
    municipalityCode;
    timesUsed;
    createdAt;
    updatedAt;
};
exports.InvoiceCustomer = InvoiceCustomer;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InvoiceCustomer.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'identification_document_code', type: 'varchar', length: 5 }),
    __metadata("design:type", String)
], InvoiceCustomer.prototype, "identificationDocumentCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], InvoiceCustomer.prototype, "identification", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1, nullable: true }),
    __metadata("design:type", Object)
], InvoiceCustomer.prototype, "dv", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'legal_organization_code', type: 'varchar', length: 1 }),
    __metadata("design:type", String)
], InvoiceCustomer.prototype, "legalOrganizationCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: true }),
    __metadata("design:type", Object)
], InvoiceCustomer.prototype, "names", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: true }),
    __metadata("design:type", Object)
], InvoiceCustomer.prototype, "company", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], InvoiceCustomer.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], InvoiceCustomer.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 250, nullable: true }),
    __metadata("design:type", Object)
], InvoiceCustomer.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'municipality_code', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], InvoiceCustomer.prototype, "municipalityCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'times_used', type: 'int', default: 1 }),
    __metadata("design:type", Number)
], InvoiceCustomer.prototype, "timesUsed", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], InvoiceCustomer.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], InvoiceCustomer.prototype, "updatedAt", void 0);
exports.InvoiceCustomer = InvoiceCustomer = __decorate([
    (0, typeorm_1.Entity)({ name: 'ppp_invoice_customers' }),
    (0, typeorm_1.Index)(['identificationDocumentCode', 'identification'], { unique: true })
], InvoiceCustomer);
//# sourceMappingURL=invoice-customer.entity.js.map