export declare class WebDeliveryFeeTierDto {
    maxKm: number;
    fee: number;
}
export declare class DayHoursDto {
    dayOfWeek: number;
    closed: boolean;
    openTime?: string;
    closeTime?: string;
}
export declare class UpdateRestaurantSettingsDto {
    timezone?: string;
    weeklyClosedDays?: number[];
    openTime?: string;
    closeTime?: string;
    weeklyHours?: DayHoursDto[];
    webDeliveryDefaultFee?: number;
    webDeliveryMaxKm?: number;
    webDeliveryFeeTiers?: WebDeliveryFeeTierDto[];
}
export declare class CreateHolidayClosureDto {
    closureDate: string;
    name: string;
    allDay?: boolean;
    startTime?: string;
    endTime?: string;
}
