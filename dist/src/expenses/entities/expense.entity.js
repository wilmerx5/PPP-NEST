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
exports.Expense = exports.EXPENSE_CATEGORIES = void 0;
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
exports.EXPENSE_CATEGORIES = [
    'proveedores',
    'impuestos',
    'nomina',
    'arriendo',
    'servicios',
    'otros',
];
let Expense = class Expense {
    id;
    category;
    name;
    amount;
    expenseDate;
    createdAt;
};
exports.Expense = Expense;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Expense.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.EXPENSE_CATEGORIES, description: 'Categoría del egreso' }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], Expense.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Nombre o concepto del egreso' }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Expense.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Monto del egreso (positivo)' }),
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], Expense.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-01-15' }),
    (0, typeorm_1.Column)({ name: 'expense_date', type: 'date' }),
    __metadata("design:type", String)
], Expense.prototype, "expenseDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Expense.prototype, "createdAt", void 0);
exports.Expense = Expense = __decorate([
    (0, typeorm_1.Entity)({ name: 'ppp_expenses' })
], Expense);
//# sourceMappingURL=expense.entity.js.map