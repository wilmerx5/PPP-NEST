import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Expense, EXPENSE_CATEGORIES } from './entities/expense.entity';
import { getBogotaDateRange } from '../common/utils/date.util';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
  ) {}

  getCategories(): string[] {
    return [...EXPENSE_CATEGORIES];
  }

  async create(data: { category: string; name: string; amount: number; expenseDate: string }): Promise<Expense> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.expenseDate)) {
      throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD (día en hora Colombia).');
    }
    const category = (data.category || '').toLowerCase().trim();
    if (!EXPENSE_CATEGORIES.includes(category as any)) {
      throw new BadRequestException(`Categoría inválida. Usa una de: ${EXPENSE_CATEGORIES.join(', ')}`);
    }
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto debe ser un número positivo.');
    }
    const name = (data.name || '').trim();
    if (!name) {
      throw new BadRequestException('El nombre/concepto es obligatorio.');
    }

    const expense = this.expenseRepo.create({
      category,
      name,
      amount,
      expenseDate: data.expenseDate,
    });
    return this.expenseRepo.save(expense);
  }

  async findByPeriod(from: string, to: string): Promise<Expense[]> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
    }
    if (from > to) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha fin');
    }

    return this.expenseRepo.find({
      where: {
        expenseDate: Between(from, to),
      },
      order: { expenseDate: 'DESC', id: 'DESC' },
    });
  }

  async getTotalByPeriod(from: string, to: string): Promise<number> {
    const list = await this.findByPeriod(from, to);
    return list.reduce((sum, e) => sum + Number(e.amount), 0);
  }

  async delete(id: number): Promise<void> {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) {
      return;
    }
    await this.expenseRepo.remove(expense);
  }
}
