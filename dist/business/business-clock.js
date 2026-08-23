"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHhMm = parseHhMm;
exports.getZonedClock = getZonedClock;
exports.isWithinWindow = isWithinWindow;
exports.isProductOnSchedule = isProductOnSchedule;
const date_fns_tz_1 = require("date-fns-tz");
function parseHhMm(hhmm) {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm.trim()))
        return null;
    const [h, m] = hhmm.trim().split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59)
        return null;
    return h * 60 + m;
}
function getZonedClock(timezone, now = new Date()) {
    const tz = timezone || 'America/Bogota';
    const dateStr = (0, date_fns_tz_1.formatInTimeZone)(now, tz, 'yyyy-MM-dd');
    const weekday = (0, date_fns_tz_1.formatInTimeZone)(now, tz, 'i');
    const iso = Number(weekday);
    const dayOfWeek = iso === 7 ? 0 : iso;
    const hour = Number((0, date_fns_tz_1.formatInTimeZone)(now, tz, 'H'));
    const minute = Number((0, date_fns_tz_1.formatInTimeZone)(now, tz, 'm'));
    return { timezone: tz, dateStr, dayOfWeek, minutes: hour * 60 + minute };
}
function isWithinWindow(minutes, start, end) {
    const startMin = parseHhMm(start);
    const endMin = parseHhMm(end);
    if (startMin == null || endMin == null)
        return true;
    if (endMin <= startMin) {
        return minutes >= startMin || minutes < endMin;
    }
    return minutes >= startMin && minutes < endMin;
}
function isProductOnSchedule(hasSchedule, schedules, clock) {
    if (!hasSchedule)
        return true;
    const rows = schedules ?? [];
    if (!rows.length)
        return false;
    return rows.some((row) => Number(row.dayOfWeek) === clock.dayOfWeek &&
        isWithinWindow(clock.minutes, row.startTime, row.endTime));
}
//# sourceMappingURL=business-clock.js.map