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
exports.HolidayClosure = void 0;
const typeorm_1 = require("typeorm");
let HolidayClosure = class HolidayClosure {
    id;
    closureDate;
    name;
    allDay;
    startTime;
    endTime;
    createdAt;
};
exports.HolidayClosure = HolidayClosure;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], HolidayClosure.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'closure_date', type: 'date' }),
    __metadata("design:type", String)
], HolidayClosure.prototype, "closureDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255 }),
    __metadata("design:type", String)
], HolidayClosure.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'all_day', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], HolidayClosure.prototype, "allDay", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_time', type: 'varchar', length: 5, nullable: true }),
    __metadata("design:type", Object)
], HolidayClosure.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'end_time', type: 'varchar', length: 5, nullable: true }),
    __metadata("design:type", Object)
], HolidayClosure.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], HolidayClosure.prototype, "createdAt", void 0);
exports.HolidayClosure = HolidayClosure = __decorate([
    (0, typeorm_1.Entity)('ppp_holiday_closures')
], HolidayClosure);
//# sourceMappingURL=holiday-closure.entity.js.map