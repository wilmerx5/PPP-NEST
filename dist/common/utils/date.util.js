"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_TIMEZONE = void 0;
exports.toBogotaTime = toBogotaTime;
exports.fromBogotaTime = fromBogotaTime;
exports.formatToBogotaISO = formatToBogotaISO;
exports.formatBogotaDate = formatBogotaDate;
exports.getBogotaDateRange = getBogotaDateRange;
exports.getBogotaDayRange = getBogotaDayRange;
exports.formatBogotaRelative = formatBogotaRelative;
exports.transformDatesToBogota = transformDatesToBogota;
const date_fns_tz_1 = require("date-fns-tz");
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
exports.APP_TIMEZONE = 'America/Bogota';
function toBogotaTime(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return (0, date_fns_tz_1.toZonedTime)(dateObj, exports.APP_TIMEZONE);
}
function fromBogotaTime(date) {
    return (0, date_fns_tz_1.fromZonedTime)(date, exports.APP_TIMEZONE);
}
function formatToBogotaISO(date) {
    if (!date)
        return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return (0, date_fns_tz_1.formatInTimeZone)(dateObj, exports.APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
}
function formatBogotaDate(date, formatStr = 'PPp') {
    if (!date)
        return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return (0, date_fns_tz_1.formatInTimeZone)(dateObj, exports.APP_TIMEZONE, formatStr, { locale: locale_1.es });
}
function getBogotaDateRange(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const startBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`;
    const endBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999-05:00`;
    return {
        start: new Date(startBogotaString),
        end: new Date(endBogotaString),
    };
}
function getBogotaDayRange() {
    const now = new Date();
    const nowInBogota = (0, date_fns_tz_1.toZonedTime)(now, exports.APP_TIMEZONE);
    const startOfDayBogota = new Date(nowInBogota);
    startOfDayBogota.setHours(0, 0, 0, 0);
    const endOfDayBogota = new Date(nowInBogota);
    endOfDayBogota.setHours(23, 59, 59, 999);
    return {
        start: fromBogotaTime(startOfDayBogota),
        end: fromBogotaTime(endOfDayBogota),
    };
}
function formatBogotaRelative(date) {
    if (!date)
        return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const bogotaDate = toBogotaTime(dateObj);
    return (0, date_fns_1.formatDistanceToNow)(bogotaDate, { addSuffix: true, locale: locale_1.es });
}
function transformDatesToBogota(obj, dateFields) {
    const result = { ...obj };
    for (const field of dateFields) {
        if (result[field]) {
            result[field] = formatToBogotaISO(result[field]);
        }
    }
    return result;
}
//# sourceMappingURL=date.util.js.map