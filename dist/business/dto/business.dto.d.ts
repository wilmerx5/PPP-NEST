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
}
export declare class CreateHolidayClosureDto {
    closureDate: string;
    name: string;
    allDay?: boolean;
    startTime?: string;
    endTime?: string;
}
