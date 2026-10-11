export type ScheduleRequest = {
  date?: string;
  time?: string;
  clarification?: string;
};

const DAY = '(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)';
const DATE = `(?:pasado ma[nñ]ana|ma[nñ]ana|hoy|(?:el\\s+)?(?:d[ií]a\\s+)?${DAY}|(?:el\\s+)?\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{4})?)`;
const TIME = '(?:medio\\s*d[ií]a|\\d{1,2}(?::\\d{1,2})?(?:\\s*[ap]\\.?\\s*m\\.?)?)';

/** Recognizes a whole scheduling turn; never strips dates out of product/address names. */
export function parseScheduleRequest(text: string): ScheduleRequest | null {
  if (/[?¿\n]/.test(text)) return null;
  let body = text.trim().replace(/\s+(?:por favor|porfa|gracias)[.!]*$/i, '').replace(/[.!]+$/, '');
  body = body.replace(/^mejor[,\s]+/i, '')
    .replace(/^(?:(?:los|las|lo|la)\s+)?quiero\s+/i, '')
    .replace(/^(?:ser[ií]an?|es|son)\s+/i, '')
    .replace(/^(?:cambia|cambiar)\s+(?:la\s+)?(?:fecha|hora|entrega)\s+/i, '')
    .replace(/^(?:para|a)\s+/i, '').trim();
  // A bare cooking fraction is not a date; an explicit scheduling cue disambiguates it.
  if (/^3\s*\/\s*4$/.test(body) && !/\b(?:para|fecha|d[ií]a)\b/i.test(text)) return null;
  const combined = body.match(new RegExp(`^(${DATE})(?:\\s+(?:a\\s+las?|a|al)\\s+(${TIME}))?$`, 'i'));
  let date = combined?.[1]?.replace(/^(?:el\s+)?(?:d[ií]a\s+)?/i, '').trim();
  let time = combined?.[2];
  if (!combined) {
    const pureTime = body.match(new RegExp(`^(?:(las?|al|el)\\s+)?(${TIME})$`, 'i'));
    if (!pureTime || (!pureTime[1] && !/:|[ap]\.?\s*m|medio/i.test(pureTime[2]))) return null;
    time = pureTime[2];
  }
  if (date && /^\d/.test(date)) {
    const [day,month,year] = date.split(/[/-]/).map(Number);
    const maxDay = month === 2 ? (!year || year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
      : [4,6,9,11].includes(month) ? 30 : 31;
    if (month < 1 || month > 12 || day < 1 || day > maxDay || year !== undefined && (year < 1900 || year > 2200)) {
      return {clarification:'Esa fecha no es válida. ¿Qué día y mes necesitas? El pedido sigue igual.'};
    }
  }
  if (time) {
    if (/^medio/i.test(time)) time = 'medio día';
    else {
      const clock = time.match(/^(\d{1,2})(?::(\d{1,2}))?(?:\s*([ap])\.?\s*m\.?)?$/i)!;
      const hour = Number(clock[1]), minute = Number(clock[2] || 0), period = clock[3]?.toLowerCase();
      if (minute > 59 || hour > (period ? 12 : 23) || period && hour < 1) {
        return {clarification:'Esa hora no es válida. ¿A qué hora lo necesitas? El pedido sigue igual.'};
      }
      if (!period && !clock[2] && hour <= 12) {
        return {clarification:`¿A las ${hour} de la mañana o de la tarde/noche? El pedido sigue igual.`};
      }
      time = period ? `${hour}${clock[2] ? ':' + clock[2].padStart(2,'0') : ''} ${period}m`
        : `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
    }
  }
  return {date,time};
}

/** Replace requested date/time while keeping unrelated customer notes and the other component. */
export function upsertScheduleNotes(notes: string | undefined, request: ScheduleRequest): string {
  let previousDate: string | undefined, previousTime: string | undefined;
  const other = (notes || '').split(/\s*;\s*|\r?\n/).filter(Boolean).filter(note => {
    const date = note.match(/^Fecha solicitada:\s*(.+)$/i);
    const time = note.match(/^Horario solicitado:\s*(.+)$/i);
    if (date) { previousDate = date[1]; return false; }
    if (time) {
      const parsed = parseScheduleRequest(time[1]);
      previousDate ||= parsed?.date;
      previousTime = parsed?.time || time[1];
      return false;
    }
    return true;
  });
  const date = request.date || previousDate, time = request.time || previousTime;
  if (date) other.push(`Fecha solicitada: ${date}`);
  if (time) other.push(`Horario solicitado: ${time}`);
  return other.join('; ');
}
