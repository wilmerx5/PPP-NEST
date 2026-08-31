import { InventorySelection } from './inventory-selection.entity';
import { Product } from './product.entity';
export declare class InventorySelectionProduct {
    id: number;
    selectionId: number;
    selection: InventorySelection;
    productId: number;
    product: Product;
    baseUnits: number;
    sortOrder: number;
}
