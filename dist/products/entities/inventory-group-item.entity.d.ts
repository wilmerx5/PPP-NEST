import { InventoryGroup } from './inventory-group.entity';
import { InventorySelection } from './inventory-selection.entity';
import { Product } from './product.entity';
export declare class InventoryGroupItem {
    id: number;
    groupId: number;
    group: InventoryGroup;
    productId: number;
    product: Product;
    attributeName: string;
    attributeValue: string;
    baseUnits: number;
    alsoDeductProductId: number | null;
    alsoDeductAttributeName: string | null;
    alsoDeductAttributeValue: string | null;
    alsoDeductBaseUnits: number | null;
    selections: InventorySelection[];
}
