import { formatInTimeZone } from 'date-fns-tz';

export type ZonedClock = {
  timezone: string;
  dateStr: string;
  dayOfWeek: number;
  minutes: number;
};

export function parseHhMm(hhmm?: string | null): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) return null;
  const [h, m] = hhmm.trim().split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function getZonedClock(timezone: string, now = new Date()): ZonedClock {
  const tz = timezone || 'America/Bogota';
  const dateStr = formatInTimeZone(now, tz, 'yyyy-MM-dd');
  const weekday = formatInTimeZone(now, tz, 'i'); // 1=Mon … 7=Sun
  const iso = Number(weekday);
  const dayOfWeek = iso === 7 ? 0 : iso;
  const hour = Number(formatInTimeZone(now, tz, 'H'));
  const minute = Number(formatInTimeZone(now, tz, 'm'));
  return { timezone: tz, dateStr, dayOfWeek, minutes: hour * 60 + minute };
}

export function isWithinWindow(
  minutes: number,
  start?: string | null,
  end?: string | null,
): boolean {
  const startMin = parseHhMm(start);
  const endMin = parseHhMm(end);
  if (startMin == null || endMin == null) return true;
  if (endMin <= startMin) {
    return minutes >= startMin || minutes < endMin;
  }
  return minutes >= startMin && minutes < endMin;
}

export type ProductScheduleLike = {
  dayOfWeek: number;
  startTime?: string | null;
  endTime?: string | null;
};

export function isProductOnSchedule(
  hasSchedule: boolean,
  schedules: ProductScheduleLike[] | undefined,
  clock: ZonedClock,
): boolean {
  if (!hasSchedule) return true;
  const rows = schedules ?? [];
  if (!rows.length) return false;
  return rows.some(
    (row) =>
      Number(row.dayOfWeek) === clock.dayOfWeek &&
      isWithinWindow(clock.minutes, row.startTime, row.endTime),
  );
}
