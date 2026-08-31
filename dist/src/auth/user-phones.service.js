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
exports.UserPhonesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const phone_entity_1 = require("./entities/phone.entity");
let UserPhonesService = class UserPhonesService {
    phoneRepository;
    constructor(phoneRepository) {
        this.phoneRepository = phoneRepository;
    }
    async create(userId, createPhoneDto) {
        if (createPhoneDto.isDefault) {
            await this.phoneRepository.update({ userId, isDefault: true }, { isDefault: false });
        }
        const phone = this.phoneRepository.create({
            ...createPhoneDto,
            userId,
            isDefault: createPhoneDto.isDefault ?? false,
            type: createPhoneDto.type ?? 'mobile',
        });
        return await this.phoneRepository.save(phone);
    }
    async findAll(userId) {
        return await this.phoneRepository.find({
            where: { userId },
            order: { isDefault: 'DESC', createdAt: 'DESC' },
        });
    }
    async findOne(userId, id) {
        const phone = await this.phoneRepository.findOne({
            where: { id, userId },
        });
        if (!phone) {
            throw new common_1.NotFoundException(`Phone with ID ${id} not found`);
        }
        return phone;
    }
    async update(userId, id, updatePhoneDto) {
        const phone = await this.findOne(userId, id);
        if (updatePhoneDto.isDefault === true && !phone.isDefault) {
            await this.phoneRepository.update({ userId, isDefault: true }, { isDefault: false });
        }
        Object.assign(phone, updatePhoneDto);
        return await this.phoneRepository.save(phone);
    }
    async remove(userId, id) {
        const phone = await this.findOne(userId, id);
        await this.phoneRepository.remove(phone);
    }
    async setDefault(userId, id) {
        await this.phoneRepository.update({ userId, isDefault: true }, { isDefault: false });
        const phone = await this.findOne(userId, id);
        phone.isDefault = true;
        return await this.phoneRepository.save(phone);
    }
};
exports.UserPhonesService = UserPhonesService;
exports.UserPhonesService = UserPhonesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(phone_entity_1.Phone)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UserPhonesService);
//# sourceMappingURL=user-phones.service.js.map