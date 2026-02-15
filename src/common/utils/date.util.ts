import { format, formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format as formatDate, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Timezone configuration for the application.
 * All dates are stored in UTC in the database and converted to Bogotá timezone
 * when displayed to users.
 */
export const APP_TIMEZONE = 'America/Bogota';

/**
 * Converts a UTC Date to Bogotá timezone.
 * Use this when reading dates from the database before sending to frontend.
 * 
 * @param date - Date object (assumed to be in UTC from database)
 * @returns Date object in Bogotá timezone
 */
export function toBogotaTime(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Convert from UTC to Bogotá timezone
  return toZonedTime(dateObj, APP_TIMEZONE);
}

/**
 * Converts a Bogotá time Date to UTC.
 * Use this when you need to query the database with Bogotá time ranges.
 * 
 * @param date - Date object in Bogotá timezone
 * @returns Date object in UTC
 */
export function fromBogotaTime(date: Date): Date {
  // Convert from Bogotá timezone to UTC
  return fromZonedTime(date, APP_TIMEZONE);
}

/**
 * Formats a date to ISO string in Bogotá timezone.
 * This ensures the frontend receives dates already in the correct timezone.
 * Uses formatInTimeZone to preserve the Bogotá timezone offset in the ISO string.
 * 
 * @param date - Date object (UTC from database)
 * @returns ISO string with Bogotá timezone offset (e.g., "2026-01-21T01:20:21.919-05:00")
 */
export function formatToBogotaISO(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Use formatInTimeZone to format in Bogotá timezone with offset
  // Format: yyyy-MM-dd'T'HH:mm:ss.SSSXXX (includes timezone offset)
  // This preserves the Bogotá timezone offset so frontend can parse it correctly
  return formatInTimeZone(dateObj, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
}

/**
 * Formats a date for display in Spanish (Colombia locale).
 * Returns date and time in Bogotá timezone.
 * 
 * @param date - Date object (UTC from database)
 * @param formatStr - Format string (default: 'PPp' = date + time)
 * @returns Formatted string in Spanish
 */
export function formatBogotaDate(
  date: Date | string | null | undefined,
  formatStr: string = 'PPp'
): string | null {
  if (!date) return null;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, APP_TIMEZONE, formatStr, { locale: es });
}

/**
 * Gets the UTC date range for a given Bogotá date string (YYYY-MM-DD).
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Object with start (00:00:00) and end (23:59:59.999) in UTC
 */
export function getBogotaDateRange(dateStr: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const startBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`;
  const endBogotaString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999-05:00`;
  return {
    start: new Date(startBogotaString),
    end: new Date(endBogotaString),
  };
}

/**
 * Gets the start and end of today in Bogotá timezone, converted to UTC.
 * Useful for querying daily records (orders, etc.).
 *
 * @returns Object with start and end of today in UTC
 */
export function getBogotaDayRange(): { start: Date; end: Date } {
  const now = new Date();
  const nowInBogota = toZonedTime(now, APP_TIMEZONE);
  
  // Get start of day in Bogotá
  const startOfDayBogota = new Date(nowInBogota);
  startOfDayBogota.setHours(0, 0, 0, 0);
  
  // Get end of day in Bogotá
  const endOfDayBogota = new Date(nowInBogota);
  endOfDayBogota.setHours(23, 59, 59, 999);
  
  // Convert back to UTC for database queries
  return {
    start: fromBogotaTime(startOfDayBogota),
    end: fromBogotaTime(endOfDayBogota),
  };
}

/**
 * Formats a date for relative display (e.g., "hace 2 horas").
 * 
 * @param date - Date object (UTC from database)
 * @returns Relative time string in Spanish
 */
export function formatBogotaRelative(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const bogotaDate = toBogotaTime(dateObj);
  return formatDistanceToNow(bogotaDate, { addSuffix: true, locale: es });
}

/**
 * Transforms an object's date fields from UTC to Bogotá timezone ISO strings.
 * Useful for transforming API responses.
 * 
 * @param obj - Object with date fields
 * @param dateFields - Array of field names that contain dates
 * @returns Object with date fields converted to Bogotá timezone ISO strings
 */
export function transformDatesToBogota<T extends Record<string, any>>(
  obj: T,
  dateFields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of dateFields) {
    if (result[field]) {
      result[field] = formatToBogotaISO(result[field] as Date | string) as T[keyof T];
    }
  }
  return result;
}
