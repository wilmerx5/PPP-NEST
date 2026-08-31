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
exports.ExpensesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const expense_entity_1 = require("./entities/expense.entity");
let ExpensesService = class ExpensesService {
    expenseRepo;
    constructor(expenseRepo) {
        this.expenseRepo = expenseRepo;
    }
    getCategories() {
        return [...expense_entity_1.EXPENSE_CATEGORIES];
    }
    async create(data) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(data.expenseDate)) {
            throw new common_1.BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD (día en hora Colombia).');
        }
        const category = (data.category || '').toLowerCase().trim();
        if (!expense_entity_1.EXPENSE_CATEGORIES.includes(category)) {
            throw new common_1.BadRequestException(`Categoría inválida. Usa una de: ${expense_entity_1.EXPENSE_CATEGORIES.join(', ')}`);
        }
        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new common_1.BadRequestException('El monto debe ser un número positivo.');
        }
        const name = (data.name || '').trim();
        if (!name) {
            throw new common_1.BadRequestException('El nombre/concepto es obligatorio.');
        }
        const expense = this.expenseRepo.create({
            category,
            name,
            amount,
            expenseDate: data.expenseDate,
        });
        return this.expenseRepo.save(expense);
    }
    async findByPeriod(from, to) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(from) || !dateRegex.test(to)) {
            throw new common_1.BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
        }
        if (from > to) {
            throw new common_1.BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha fin');
        }
        return this.expenseRepo.find({
            where: {
                expenseDate: (0, typeorm_2.Between)(from, to),
            },
            order: { expenseDate: 'DESC', id: 'DESC' },
        });
    }
    async getTotalByPeriod(from, to) {
        const list = await this.findByPeriod(from, to);
        return list.reduce((sum, e) => sum + Number(e.amount), 0);
    }
    async delete(id) {
        const expense = await this.expenseRepo.findOne({ where: { id } });
        if (!expense) {
            return;
        }
        await this.expenseRepo.remove(expense);
    }
};
exports.ExpensesService = ExpensesService;
exports.ExpensesService = ExpensesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(expense_entity_1.Expense)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ExpensesService);
//# sourceMappingURL=expenses.service.js.map