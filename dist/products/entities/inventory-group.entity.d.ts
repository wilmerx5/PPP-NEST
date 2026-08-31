import { InventoryGroupItem } from './inventory-group-item.entity';
export declare class InventoryGroup {
    id: number;
    name: string;
    stock: number;
    items: InventoryGroupItem[];
}
