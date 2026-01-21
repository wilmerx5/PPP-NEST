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
exports.UserPhonesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const user_phones_service_1 = require("./user-phones.service");
const create_phone_dto_1 = require("./dto/create-phone.dto");
const update_phone_dto_1 = require("./dto/update-phone.dto");
const auth_decorator_1 = require("./decorators/auth.decorator");
const date_util_1 = require("../common/utils/date.util");
let UserPhonesController = class UserPhonesController {
    phonesService;
    constructor(phonesService) {
        this.phonesService = phonesService;
    }
    async create(req, createPhoneDto) {
        const user = req.user;
        const phone = await this.phonesService.create(user.id, createPhoneDto);
        return (0, date_util_1.transformDatesToBogota)(phone, ['createdAt', 'updatedAt']);
    }
    async findAll(req) {
        const user = req.user;
        const phones = await this.phonesService.findAll(user.id);
        return phones.map(phone => (0, date_util_1.transformDatesToBogota)(phone, ['createdAt', 'updatedAt']));
    }
    async findOne(req, id) {
        const user = req.user;
        const phone = await this.phonesService.findOne(user.id, id);
        return (0, date_util_1.transformDatesToBogota)(phone, ['createdAt', 'updatedAt']);
    }
    async update(req, id, updatePhoneDto) {
        const user = req.user;
        const phone = await this.phonesService.update(user.id, id, updatePhoneDto);
        return (0, date_util_1.transformDatesToBogota)(phone, ['createdAt', 'updatedAt']);
    }
    async remove(req, id) {
        const user = req.user;
        return this.phonesService.remove(user.id, id);
    }
    async setDefault(req, id) {
        const user = req.user;
        const phone = await this.phonesService.setDefault(user.id, id);
        return (0, date_util_1.transformDatesToBogota)(phone, ['createdAt', 'updatedAt']);
    }
};
exports.UserPhonesController = UserPhonesController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear un nuevo teléfono para el usuario autenticado' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Teléfono creado exitosamente' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_phone_dto_1.CreatePhoneDto]),
    __metadata("design:returntype", Promise)
], UserPhonesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener todos los teléfonos del usuario autenticado' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lista de teléfonos' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserPhonesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener un teléfono específico por ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Teléfono encontrado' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Teléfono no encontrado' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], UserPhonesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar un teléfono' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Teléfono actualizado exitosamente' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Teléfono no encontrado' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_phone_dto_1.UpdatePhoneDto]),
    __metadata("design:returntype", Promise)
], UserPhonesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar un teléfono' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Teléfono eliminado exitosamente' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Teléfono no encontrado' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], UserPhonesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/set-default'),
    (0, swagger_1.ApiOperation)({ summary: 'Establecer un teléfono como predeterminado' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Teléfono establecido como predeterminado' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], UserPhonesController.prototype, "setDefault", null);
exports.UserPhonesController = UserPhonesController = __decorate([
    (0, swagger_1.ApiTags)('User Phones'),
    (0, common_1.Controller)('auth/phones'),
    (0, auth_decorator_1.Auth)(),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [user_phones_service_1.UserPhonesService])
], UserPhonesController);
//# sourceMappingURL=user-phones.controller.js.map