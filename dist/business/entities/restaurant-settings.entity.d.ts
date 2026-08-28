export type DayHours = {
    dayOfWeek: number;
    closed: boolean;
    openTime: string;
    closeTime: string;
};
export declare class RestaurantSettings {
    id: number;
    timezone: string;
    weeklyClosedDays: number[] | null;
    openTime: string;
    closeTime: string;
    weeklyHours: DayHours[] | null;
    webDeliveryDefaultFee: number;
    webDeliveryMaxKm: number | string | null;
    webDeliveryFeeTiers: unknown | null;
    factusItemTaxes: Array<{
        code: string;
        rate: number;
        isExcluded?: boolean;
    }> | null;
    factusPricesIncludeTax: boolean | null;
    updatedAt: Date;
}
