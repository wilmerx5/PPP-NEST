export declare const EXPENSE_CATEGORIES: readonly ["proveedores", "impuestos", "nomina", "arriendo", "servicios", "otros"];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export declare class Expense {
    id: number;
    category: string;
    name: string;
    amount: number;
    expenseDate: string;
    createdAt: Date;
}
