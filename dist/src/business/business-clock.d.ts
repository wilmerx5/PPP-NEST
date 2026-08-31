export type ZonedClock = {
    timezone: string;
    dateStr: string;
    dayOfWeek: number;
    minutes: number;
};
export declare function parseHhMm(hhmm?: string | null): number | null;
export declare function getZonedClock(timezone: string, now?: Date): ZonedClock;
export declare function isWithinWindow(minutes: number, start?: string | null, end?: string | null): boolean;
export type ProductScheduleLike = {
    dayOfWeek: number;
    startTime?: string | null;
    endTime?: string | null;
};
export declare function isProductOnSchedule(hasSchedule: boolean, schedules: ProductScheduleLike[] | undefined, clock: ZonedClock): boolean;
