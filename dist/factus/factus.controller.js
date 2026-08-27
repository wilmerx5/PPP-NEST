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
const issue_electronic_invoice_dto_1 = require("./dto/issue-electronic-invoice.dto");
const factus_service_1 = require("./factus.service");
const OPS = [
    valid_roles_interface_1.ValidRoles.admin,
    valid_roles_interface_1.ValidRoles.ordersUser,
    valid_roles_interface_1.ValidRoles.tableUser,
];
let FactusController = class FactusController {
    factusService;
    constructor(factusService) {
        this.factusService = factusService;
    }
    getStatus() {
        return this.factusService.getStatus();
    }
    issueInvoice(id, dto) {
        return this.factusService.issueForOrder(id, dto);
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
exports.FactusController = FactusController = __decorate([
    (0, swagger_1.ApiTags)('Facturación electrónica (Factus)'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [factus_service_1.FactusService])
], FactusController);
//# sourceMappingURL=factus.controller.js.map