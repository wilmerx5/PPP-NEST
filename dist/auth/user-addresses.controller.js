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
exports.UserAddressesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const user_addresses_service_1 = require("./user-addresses.service");
const create_address_dto_1 = require("./dto/create-address.dto");
const update_address_dto_1 = require("./dto/update-address.dto");
const auth_decorator_1 = require("./decorators/auth.decorator");
const date_util_1 = require("../common/utils/date.util");
let UserAddressesController = class UserAddressesController {
    addressesService;
    constructor(addressesService) {
        this.addressesService = addressesService;
    }
    async create(req, createAddressDto) {
        const user = req.user;
        const address = await this.addressesService.create(user.id, createAddressDto);
        return (0, date_util_1.transformDatesToBogota)(address, ['createdAt', 'updatedAt']);
    }
    async geocode(body) {
        return this.addressesService.geocodePreview(body.address);
    }
    async reverseGeocode(body) {
        return this.addressesService.reverseGeocodePreview(body.lat, body.lng);
    }
    async findAll(req) {
        const user = req.user;
        const addresses = await this.addressesService.findAll(user.id);
        return addresses.map((addr) => (0, date_util_1.transformDatesToBogota)(addr, ['createdAt', 'updatedAt']));
    }
    async findOne(req, id) {
        const user = req.user;
        const address = await this.addressesService.findOne(user.id, id);
        return (0, date_util_1.transformDatesToBogota)(address, ['createdAt', 'updatedAt']);
    }
    async update(req, id, updateAddressDto) {
        const user = req.user;
        const address = await this.addressesService.update(user.id, id, updateAddressDto);
        return (0, date_util_1.transformDatesToBogota)(address, ['createdAt', 'updatedAt']);
    }
    remove(req, id) {
        const user = req.user;
        return this.addressesService.remove(user.id, id);
    }
    async setDefault(req, id) {
        const user = req.user;
        const address = await this.addressesService.setDefault(user.id, id);
        return (0, date_util_1.transformDatesToBogota)(address, ['createdAt', 'updatedAt']);
    }
};
exports.UserAddressesController = UserAddressesController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una nueva dirección para el usuario autenticado' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Dirección creada exitosamente' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_address_dto_1.CreateAddressDto]),
    __metadata("design:returntype", Promise)
], UserAddressesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('geocode'),
    (0, swagger_1.ApiOperation)({ summary: 'Vista previa de ubicación en mapa (antes de confirmar el pin)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Coordenadas sugeridas' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_address_dto_1.GeocodeAddressDto]),
    __metadata("design:returntype", Promise)
], UserAddressesController.prototype, "geocode", null);
__decorate([
    (0, common_1.Post)('reverse-geocode'),
    (0, swagger_1.ApiOperation)({ summary: 'Dirección legible a partir del pin confirmado' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Texto de dirección según Google Maps' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_address_dto_1.ReverseGeocodeDto]),
    __metadata("design:returntype", Promise)
], UserAddressesController.prototype, "reverseGeocode", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener todas las direcciones del usuario autenticado' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lista de direcciones' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserAddressesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener una dirección específica por ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Dirección encontrada' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Dirección no encontrada' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], UserAddressesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar una dirección' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Dirección actualizada exitosamente' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Dirección no encontrada' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_address_dto_1.UpdateAddressDto]),
    __metadata("design:returntype", Promise)
], UserAddressesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar una dirección' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Dirección eliminada exitosamente' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Dirección no encontrada' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], UserAddressesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/set-default'),
    (0, swagger_1.ApiOperation)({ summary: 'Establecer una dirección como predeterminada' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Dirección establecida como predeterminada' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], UserAddressesController.prototype, "setDefault", null);
exports.UserAddressesController = UserAddressesController = __decorate([
    (0, swagger_1.ApiTags)('User Addresses'),
    (0, common_1.Controller)('auth/addresses'),
    (0, auth_decorator_1.Auth)(),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [user_addresses_service_1.UserAddressesService])
], UserAddressesController);
//# sourceMappingURL=user-addresses.controller.js.map