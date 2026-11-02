import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyBoldSignature(
  raw: Buffer,
  signature: string | undefined,
  secret: string,
) {
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret)
    .update(raw.toString('base64'))
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
function required(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new BadRequestException('Evento Bold inválido');
  return value.trim();
}
export function parseBoldEvent(raw: Buffer, merchant: string) {
  let e: any;
  try {
    e = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new BadRequestException('JSON inválido');
  }
  if (!e || typeof e !== 'object')
    throw new BadRequestException('Evento inválido');
  const type = required(e.type, 30);
  if (
    ![
      'SALE_APPROVED',
      'SALE_REJECTED',
      'VOID_APPROVED',
      'VOID_REJECTED',
    ].includes(type)
  )
    throw new BadRequestException('Tipo Bold no soportado');
  const d = e.data;
  if (!d || required(d.merchant_id, 100) !== merchant)
    throw new UnauthorizedException('Comercio Bold incorrecto');
  const amount = d.amount?.total;
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 999999999999.99 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001 ||
    d.amount?.currency !== 'COP'
  )
    throw new BadRequestException('Monto o moneda inválidos');
  const created = required(d.created_at, 50);
  const paidAt = new Date(created);
  if (
    !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(created) ||
    !Number.isFinite(paidAt.getTime())
  )
    throw new BadRequestException('Fecha inválida');
  const optional = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
  return {
    eventId: required(e.id, 100),
    type,
    paymentId: required(d.payment_id, 100),
    merchantId: merchant,
    amount: amount.toFixed(2),
    currency: 'COP',
    paidAt,
    method: required(d.payment_method, 40),
    payerEmail: optional(d.payer_email, 255),
    payerName: optional(d.card?.cardholder_name, 160),
  };
}
export function nextBoldStatus(
  current: string | undefined,
  type: string,
): 'approved' | 'rejected' | 'voided' {
  if (current === 'voided' || type === 'VOID_APPROVED') return 'voided';
  if (current === 'approved' || type === 'SALE_APPROVED') return 'approved';
  return 'rejected';
}
