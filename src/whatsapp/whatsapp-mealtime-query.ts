/** Separate a plain eating occasion from a Spanish availability question. */
export function mealtimeAvailabilityQuery(text: string): string | null {
 const q=(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[¿?¡!,\.]/g,' ').replace(/\s+/g,' ').trim()
  .replace(/^(?:(?:hola|buenas|buenos dias|buenas tardes|buenas noches|veci|vecino|vecina|oye)\s+)*/, '');
 const match=q.match(/^(?:tienes|tienen|tiene|tines|hay|venden|manejan)\s+(.+?)\s+para\s+(?:almorzar|(?:el\s+)?almuerzo|cenar|(?:la\s+)?cena|desayunar|(?:el\s+)?desayuno)(?:\s+hoy)?(?:\s+porfa|\s+por favor)?$/);
 if(!match)return null;
 const subject=match[1];
 if(subject.length<3 || subject.length>70 || /\b(?:si|pero|sino|cuando|manana|agrega|quita|cambia|quiero|domicilio|horario|mesa|mesas)\b/.test(subject))return null;
 return subject;
}
