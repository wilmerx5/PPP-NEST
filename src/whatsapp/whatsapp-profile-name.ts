import { isUsableWhatsappCustomerName } from './whatsapp-session-intents';

/** Conservative suggestion for delivery, never proof of identity. */
export function whatsappProfileRecipient(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (!isUsableWhatsappCustomerName(name)) return null;
  const words = name.split(' ');
  if (words.length < 2 || words.length > 6) return null;
  if (!words.every(word => /^\p{L}[\p{L}\p{M}'’-]*$/u.test(word))) return null;
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(tienda|restaurante|pedidos?|ventas|negocio|empresa|domicilios|servicios|cliente|usuario|admin)\b/.test(normalized)) return null;
  return name;
}
