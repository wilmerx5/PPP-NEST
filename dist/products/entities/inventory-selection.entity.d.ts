import { InventoryGroupItem } from './inventory-group-item.entity';
import { InventorySelectionProduct } from './inventory-selection-product.entity';
export declare class InventorySelection {
    id: number;
    name: string;
    groupItemId: number;
    groupItem: InventoryGroupItem;
    sortOrder: number;
    products: InventorySelectionProduct[];
}
