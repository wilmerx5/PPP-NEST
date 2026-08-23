"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const restaurant_settings_entity_1 = require("./entities/restaurant-settings.entity");
const holiday_closure_entity_1 = require("./entities/holiday-closure.entity");
const business_clock_1 = require("./business-clock");
const DEFAULT_TZ = 'America/Bogota';
const SETTINGS_TTL_MS = 30_000;
let BusinessService = class BusinessService {
    settingsRepo;
    closuresRepo;
    settingsCache = null;
    constructor(settingsRepo, closuresRepo) {
        this.settingsRepo = settingsRepo;
        this.closuresRepo = closuresRepo;
    }
    fallbackSettings() {
        const row = new restaurant_settings_entity_1.RestaurantSettings();
        row.id = 1;
        row.timezone = DEFAULT_TZ;
        row.weeklyClosedDays = [];
        row.openTime = '11:00';
        row.closeTime = '22:00';
        row.weeklyHours = this.buildWeeklyHours([], '11:00', '22:00', null);
        return row;
    }
    parseJsonField(value, fallback) {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            }
            catch {
                return fallback;
            }
        }
        return (value ?? fallback);
    }
    buildWeeklyHours(closedDays, openTime, closeTime, stored) {
        const byDay = new Map();
        if (Array.isArray(stored)) {
            for (const h of stored) {
                const d = Number(h?.dayOfWeek);
                if (d < 0 || d > 6)
                    continue;
                byDay.set(d, {
                    dayOfWeek: d,
                    closed: !!h.closed,
                    openTime: h.openTime || openTime,
                    closeTime: h.closeTime || closeTime,
                });
            }
        }
        return [0, 1, 2, 3, 4, 5, 6].map((d) => byDay.get(d) ?? {
            dayOfWeek: d,
            closed: closedDays.includes(d),
            openTime,
            closeTime,
        });
    }
    normalizeSettings(row) {
        row.weeklyClosedDays = this.parseJsonField(row.weeklyClosedDays, []);
        if (!Array.isArray(row.weeklyClosedDays))
            row.weeklyClosedDays = [];
        row.weeklyHours = this.parseJsonField(row.weeklyHours, null);
        row.weeklyHours = this.buildWeeklyHours(row.weeklyClosedDays, row.openTime || '11:00', row.closeTime || '22:00', row.weeklyHours);
        row.weeklyClosedDays = row.weeklyHours.filter((h) => h.closed).map((h) => h.dayOfWeek);
        return row;
    }
    async getSettings() {
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
                    weeklyHours: null,
                });
                try {
                    row = await this.settingsRepo.save(row);
                }
                catch {
                    const again = await this.settingsRepo.findOne({ where: { id: 1 } });
                    row = again ?? row;
                }
            }
            row = this.normalizeSettings(row);
            this.settingsCache = { at: Date.now(), row };
            return row;
        }
        catch {
            return this.fallbackSettings();
        }
    }
    async updateSettings(dto) {
        const row = await this.getSettings();
        if (dto.timezone !== undefined) {
            this.assertValidTimezone(dto.timezone);
            row.timezone = dto.timezone.trim();
        }
        if (dto.weeklyClosedDays !== undefined) {
            row.weeklyClosedDays = dto.weeklyClosedDays;
        }
        if (dto.openTime !== undefined)
            row.openTime = dto.openTime;
        if (dto.closeTime !== undefined)
            row.closeTime = dto.closeTime;
        if (dto.weeklyHours !== undefined) {
            const hours = this.buildWeeklyHours(row.weeklyClosedDays ?? [], row.openTime || '11:00', row.closeTime || '22:00', dto.weeklyHours.map((h) => ({
                dayOfWeek: h.dayOfWeek,
                closed: !!h.closed,
                openTime: h.openTime || row.openTime || '11:00',
                closeTime: h.closeTime || row.closeTime || '22:00',
            })));
            row.weeklyHours = hours;
            row.weeklyClosedDays = hours.filter((h) => h.closed).map((h) => h.dayOfWeek);
            const sample = hours.find((h) => !h.closed);
            if (sample) {
                row.openTime = sample.openTime;
                row.closeTime = sample.closeTime;
            }
        }
        const saved = await this.settingsRepo.save(row);
        this.settingsCache = { at: Date.now(), row: this.normalizeSettings(saved) };
        return saved;
    }
    async listClosures(from, to) {
        if (from && to) {
            return this.closuresRepo.find({
                where: { closureDate: (0, typeorm_2.Between)(from, to) },
                order: { closureDate: 'ASC' },
            });
        }
        const today = (await this.getClock()).dateStr;
        return this.closuresRepo.find({
            where: { closureDate: (0, typeorm_2.MoreThanOrEqual)(today) },
            order: { closureDate: 'ASC' },
        });
    }
    async createClosure(dto) {
        const existing = await this.closuresRepo.findOne({
            where: { closureDate: dto.closureDate },
        });
        if (existing) {
            throw new common_1.ConflictException(`Ya hay un cierre el ${dto.closureDate}`);
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
    async deleteClosure(id) {
        const res = await this.closuresRepo.delete(id);
        if (!res.affected) {
            throw new common_1.NotFoundException(`Cierre ${id} no encontrado`);
        }
    }
    async getClock() {
        try {
            const settings = await this.getSettings();
            return (0, business_clock_1.getZonedClock)(settings.timezone || DEFAULT_TZ);
        }
        catch {
            return (0, business_clock_1.getZonedClock)(DEFAULT_TZ);
        }
    }
    async getStatus() {
        const settings = await this.getSettings();
        const clock = (0, business_clock_1.getZonedClock)(settings.timezone || DEFAULT_TZ);
        const weeklyHours = this.buildWeeklyHours(settings.weeklyClosedDays ?? [], settings.openTime || '11:00', settings.closeTime || '22:00', settings.weeklyHours);
        const todayHours = weeklyHours.find((h) => h.dayOfWeek === clock.dayOfWeek) ?? weeklyHours[0];
        const closedDays = weeklyHours.filter((h) => h.closed).map((h) => h.dayOfWeek);
        let upcoming = [];
        try {
            upcoming = await this.closuresRepo.find({
                where: { closureDate: (0, typeorm_2.MoreThanOrEqual)(clock.dateStr) },
                order: { closureDate: 'ASC' },
                take: 20,
            });
        }
        catch {
            upcoming = [];
        }
        const todayClosure = upcoming.find((c) => c.closureDate === clock.dateStr);
        let isOpen = true;
        let reason;
        let message = 'Abierto ahora';
        let subMessage;
        let holidayName;
        if (todayHours.closed) {
            isOpen = false;
            reason = 'weekly_closed';
            message = 'Cerrado hoy';
            subMessage = 'Este día el restaurante no recibe pedidos en línea.';
        }
        else if (todayClosure) {
            const holidayActive = todayClosure.allDay ||
                (0, business_clock_1.isWithinWindow)(clock.minutes, todayClosure.startTime, todayClosure.endTime);
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
        if (isOpen &&
            !(0, business_clock_1.isWithinWindow)(clock.minutes, todayHours.openTime, todayHours.closeTime)) {
            isOpen = false;
            reason = 'outside_hours';
            message = 'Cerrado ahora';
            subMessage = `Horario: ${todayHours.openTime} – ${todayHours.closeTime}`;
        }
        else if (isOpen) {
            subMessage = `Cierra a las ${todayHours.closeTime}`;
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
            openTime: todayHours.openTime,
            closeTime: todayHours.closeTime,
            weeklyHours,
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
    async assertAcceptingOnlineOrders() {
        const status = await this.getStatus();
        if (!status.isOpen) {
            throw new common_1.BadRequestException(status.holidayName
                ? `El restaurante está cerrado (${status.holidayName}). No se pueden tomar pedidos en línea.`
                : `${status.message}. ${status.subMessage ?? ''}`.trim());
        }
    }
    async isProductAvailableNow(hasSchedule, schedules) {
        const clock = await this.getClock();
        return (0, business_clock_1.isProductOnSchedule)(hasSchedule, schedules, clock);
    }
    assertValidTimezone(tz) {
        try {
            Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
        }
        catch {
            throw new common_1.BadRequestException(`Zona horaria inválida: ${tz}`);
        }
    }
};
exports.BusinessService = BusinessService;
exports.BusinessService = BusinessService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(restaurant_settings_entity_1.RestaurantSettings)),
    __param(1, (0, typeorm_1.InjectRepository)(holiday_closure_entity_1.HolidayClosure)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], BusinessService);
//# sourceMappingURL=business.service.js.map