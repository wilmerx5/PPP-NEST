import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
export declare class ExpensesService {
    private readonly expenseRepo;
    constructor(expenseRepo: Repository<Expense>);
    getCategories(): string[];
    create(data: {
        category: string;
        name: string;
        amount: number;
        expenseDate: string;
    }): Promise<Expense>;
    findByPeriod(from: string, to: string): Promise<Expense[]>;
    getTotalByPeriod(from: string, to: string): Promise<number>;
    delete(id: number): Promise<void>;
}
