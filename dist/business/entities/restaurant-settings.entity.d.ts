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
    updatedAt: Date;
}
