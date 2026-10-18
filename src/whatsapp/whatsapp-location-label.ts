/** Parsing a pin never needs inference or a network request. */
export function validDeliveryCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat==='number' && typeof lng==='number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180;
}
export function googleMapsPin(text: string): {lat:number;lng:number}|null {
  if (!/^https:\/\/\S+$/i.test(text.trim())) return null;
  try {
    const url=new URL(text.trim());
    if (!['maps.google.com','www.google.com','google.com'].includes(url.hostname) || !/^\/maps(?:\/|$)/.test(url.pathname) && url.hostname!=='maps.google.com') return null;
    const match=(url.searchParams.get('q')||url.searchParams.get('query')||'').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if(!match)return null;const lat=Number(match[1]),lng=Number(match[2]);return validDeliveryCoordinates(lat,lng)?{lat,lng}:null;
  } catch {return null;}
}
/** Customer-only label. Stored address and exact logistics pin remain unchanged. */
export function customerLocationLabel(address: string): string {
  const parts=address.split(' — ');
  const coordinate=(part:string)=>/^📍\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(part.trim());
  if(!parts.some(coordinate))return address;
  const labels=parts.filter(part=>!coordinate(part) && !/^https:\/\/maps\.google\.com\/\?q=/.test(part));
  return labels.join(' — ').trim()||'Ubicación compartida';
}
