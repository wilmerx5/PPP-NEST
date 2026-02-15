export declare const APP_TIMEZONE = "America/Bogota";
export declare function toBogotaTime(date: Date | string): Date;
export declare function fromBogotaTime(date: Date): Date;
export declare function formatToBogotaISO(date: Date | string | null | undefined): string | null;
export declare function formatBogotaDate(date: Date | string | null | undefined, formatStr?: string): string | null;
export declare function getBogotaDateRange(dateStr: string): {
    start: Date;
    end: Date;
};
export declare function getBogotaDayRange(): {
    start: Date;
    end: Date;
};
export declare function formatBogotaRelative(date: Date | string | null | undefined): string | null;
export declare function transformDatesToBogota<T extends Record<string, any>>(obj: T, dateFields: (keyof T)[]): T;
