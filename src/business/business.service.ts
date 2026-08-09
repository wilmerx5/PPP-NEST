import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { RestaurantSettings } from './entities/restaurant-settings.entity';
import { HolidayClosure } from './entities/holiday-closure.entity';
import {
  CreateHolidayClosureDto,
  UpdateRestaurantSettingsDto,
} from './dto/business.dto';
import {
  getZonedClock,
  isProductOnSchedule,
  isWithinWindow,
  type ProductScheduleLike,
  type ZonedClock,
} from './business-clock';

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
  upcomingClosures: Array<{
    id: number;
    closureDate: string;
    name: string;
    allDay: boolean;
    startTime?: string | null;
    endTime?: string | null;
  }>;
};

const DEFAULT_TZ = 'America/Bogota';
const SETTINGS_TTL_MS = 30_000;

@Injectable()
export class BusinessService {
  private settingsCache: { at: number; row: RestaurantSettings } | null = null;

  constructor(
    @InjectRepository(RestaurantSettings)
    private readonly settingsRepo: Repository<RestaurantSettings>,
    @InjectRepository(HolidayClosure)
    private readonly closuresRepo: Repository<HolidayClosure>,
  ) {}

  private fallbackSettings(): RestaurantSettings {
    const row = new RestaurantSettings();
    row.id = 1;
    row.timezone = DEFAULT_TZ;
    row.weeklyClosedDays = [];
    row.openTime = '11:00';
    row.closeTime = '22:00';
    return row;
  }

  private normalizeSettings(row: RestaurantSettings): RestaurantSettings {
    if (typeof row.weeklyClosedDays === 'string') {
      try {
        row.weeklyClosedDays = JSON.parse(row.weeklyClosedDays);
      } catch {
        row.weeklyClosedDays = [];
      }
    }
    if (!Array.isArray(row.weeklyClosedDays)) {
      row.weeklyClosedDays = [];
    }
    return row;
  }

  async getSettings(): Promise<RestaurantSettings> {
    if (this.settingsCache && Date.now() - this.settingsCache.at < SETTINGS_TTL_MS) {
      return this.settingsCache.row;
    }
    try {
      let row = await this.settingsRepo.findOne({ where: { id: 1 } });
      if (!row) {
        row = this.settingsRepo.create({
          id: 1,
          timezone: DEFAULT_TZ,
          weeklyClosedDays: [],
          openTime: '11:00',
          closeTime: '22:00',
        });
        try {
          row = await this.settingsRepo.save(row);
        } catch {
          const again = await this.settingsRepo.findOne({ where: { id: 1 } });
          row = again ?? row;
        }
      }
      row = this.normalizeSettings(row);
      this.settingsCache = { at: Date.now(), row };
      return row;
    } catch {
      return this.fallbackSettings();
    }
  }

  async updateSettings(dto: UpdateRestaurantSettingsDto): Promise<RestaurantSettings> {
    const row = await this.getSettings();
    if (dto.timezone !== undefined) {
      this.assertValidTimezone(dto.timezone);
      row.timezone = dto.timezone.trim();
    }
    if (dto.weeklyClosedDays !== undefined) {
      row.weeklyClosedDays = dto.weeklyClosedDays;
    }
    if (dto.openTime !== undefined) row.openTime = dto.openTime;
    if (dto.closeTime !== undefined) row.closeTime = dto.closeTime;
    const saved = await this.settingsRepo.save(row);
    this.settingsCache = { at: Date.now(), row: this.normalizeSettings(saved) };
    return saved;
  }

  async listClosures(from?: string, to?: string): Promise<HolidayClosure[]> {
    if (from && to) {
      return this.closuresRepo.find({
        where: { closureDate: Between(from, to) },
        order: { closureDate: 'ASC' },
      });
    }
    const today = (await this.getClock()).dateStr;
    return this.closuresRepo.find({
      where: { closureDate: MoreThanOrEqual(today) },
      order: { closureDate: 'ASC' },
    });
  }

  async createClosure(dto: CreateHolidayClosureDto): Promise<HolidayClosure> {
    const existing = await this.closuresRepo.findOne({
      where: { closureDate: dto.closureDate },
    });
    if (existing) {
      throw new ConflictException(`Ya hay un cierre el ${dto.closureDate}`);
    }
    const allDay = dto.allDay !== false;
    const entity = this.closuresRepo.create({
      closureDate: dto.closureDate,
      name: dto.name.trim(),
      allDay,
      startTime: allDay ? null : dto.startTime ?? null,
      endTime: allDay ? null : dto.endTime ?? null,
    });
    return this.closuresRepo.save(entity);
  }

  async deleteClosure(id: number): Promise<void> {
    const res = await this.closuresRepo.delete(id);
    if (!res.affected) {
      throw new NotFoundException(`Cierre ${id} no encontrado`);
    }
  }

  async getClock(): Promise<ZonedClock> {
    try {
      const settings = await this.getSettings();
      return getZonedClock(settings.timezone || DEFAULT_TZ);
    } catch {
      return getZonedClock(DEFAULT_TZ);
    }
  }

  async getStatus(): Promise<BusinessStatus> {
    const settings = await this.getSettings();
    const clock = getZonedClock(settings.timezone || DEFAULT_TZ);
    const closedDays = settings.weeklyClosedDays ?? [];
    let upcoming: HolidayClosure[] = [];
    try {
      upcoming = await this.closuresRepo.find({
        where: { closureDate: MoreThanOrEqual(clock.dateStr) },
        order: { closureDate: 'ASC' },
        take: 20,
      });
    } catch {
      upcoming = [];
    }

    const todayClosure = upcoming.find((c) => c.closureDate === clock.dateStr);
    let isOpen = true;
    let reason: BusinessStatus['reason'];
    let message = 'Abierto ahora';
    let subMessage: string | undefined;
    let holidayName: string | undefined;

    if (closedDays.includes(clock.dayOfWeek)) {
      isOpen = false;
      reason = 'weekly_closed';
      message = 'Cerrado hoy';
      subMessage = 'Este día el restaurante no recibe pedidos en línea.';
    } else if (todayClosure) {
      const holidayActive =
        todayClosure.allDay ||
        isWithinWindow(clock.minutes, todayClosure.startTime, todayClosure.endTime);
      if (holidayActive) {
        isOpen = false;
        reason = 'holiday';
        holidayName = todayClosure.name;
        message = `Cerrado — ${todayClosure.name}`;
        subMessage = todayClosure.allDay
          ? 'Festivo / día de cierre. No se pueden hacer pedidos en línea.'
          : `Cierre de ${todayClosure.startTime} a ${todayClosure.endTime}.`;
      }
    }

    if (isOpen && !isWithinWindow(clock.minutes, settings.openTime, settings.closeTime)) {
      isOpen = false;
      reason = 'outside_hours';
      message = 'Cerrado ahora';
      subMessage = `Horario: ${settings.openTime} – ${settings.closeTime}`;
    } else if (isOpen) {
      subMessage = `Cierra a las ${settings.closeTime}`;
    }

    return {
      timezone: settings.timezone,
      isOpen,
      reason,
      message,
      subMessage,
      holidayName,
      date: clock.dateStr,
      dayOfWeek: clock.dayOfWeek,
      weeklyClosedDays: closedDays,
      openTime: settings.openTime,
      closeTime: settings.closeTime,
      upcomingClosures: upcoming.map((c) => ({
        id: c.id,
        closureDate: c.closureDate,
        name: c.name,
        allDay: c.allDay,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
    };
  }

  async assertAcceptingOnlineOrders(): Promise<void> {
    const status = await this.getStatus();
    if (!status.isOpen) {
      throw new BadRequestException(
        status.holidayName
          ? `El restaurante está cerrado (${status.holidayName}). No se pueden tomar pedidos en línea.`
          : `${status.message}. ${status.subMessage ?? ''}`.trim(),
      );
    }
  }

  async isProductAvailableNow(
    hasSchedule: boolean,
    schedules: ProductScheduleLike[] | undefined,
  ): Promise<boolean> {
    const clock = await this.getClock();
    return isProductOnSchedule(hasSchedule, schedules, clock);
  }

  private assertValidTimezone(tz: string) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    } catch {
      throw new BadRequestException(`Zona horaria inválida: ${tz}`);
    }
  }
}
