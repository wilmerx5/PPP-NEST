import { Repository } from 'typeorm';
import { RestaurantSettings, type DayHours } from './entities/restaurant-settings.entity';
import { HolidayClosure } from './entities/holiday-closure.entity';
import { CreateHolidayClosureDto, UpdateRestaurantSettingsDto } from './dto/business.dto';
import { type ProductScheduleLike, type ZonedClock } from './business-clock';
export type BusinessStatus = {
    timezone: string;
    isOpen: boolean;
    reason?: 'weekly_closed' | 'holiday' | 'outside_hours';
    message: string;
    subMessage?: string;
    holidayName?: string;
    date: string;
    dayOfWeek: number;
    weeklyClosedDays: number[];
    openTime: string;
    closeTime: string;
    weeklyHours: DayHours[];
    upcomingClosures: Array<{
        id: number;
        closureDate: string;
        name: string;
        allDay: boolean;
        startTime?: string | null;
        endTime?: string | null;
    }>;
};
export declare class BusinessService {
    private readonly settingsRepo;
    private readonly closuresRepo;
    private settingsCache;
    constructor(settingsRepo: Repository<RestaurantSettings>, closuresRepo: Repository<HolidayClosure>);
    private fallbackSettings;
    private parseJsonField;
    private buildWeeklyHours;
    private normalizeSettings;
    getSettings(): Promise<RestaurantSettings>;
    updateSettings(dto: UpdateRestaurantSettingsDto): Promise<RestaurantSettings>;
    listClosures(from?: string, to?: string): Promise<HolidayClosure[]>;
    createClosure(dto: CreateHolidayClosureDto): Promise<HolidayClosure>;
    deleteClosure(id: number): Promise<void>;
    getClock(): Promise<ZonedClock>;
    getStatus(): Promise<BusinessStatus>;
    assertAcceptingOnlineOrders(): Promise<void>;
    isProductAvailableNow(hasSchedule: boolean, schedules: ProductScheduleLike[] | undefined): Promise<boolean>;
    private assertValidTimezone;
}
