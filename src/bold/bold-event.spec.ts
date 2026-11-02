import { createHmac } from 'crypto';
import {
  nextBoldStatus,
  parseBoldEvent,
  verifyBoldSignature,
} from './bold-event';
const event = () => ({
  id: 'evt-1',
  type: 'SALE_APPROVED',
  data: {
    payment_id: 'pay-1',
    merchant_id: 'merchant',
    created_at: '2026-11-01T18:00:00-05:00',
    amount: { total: 35000, currency: 'COP' },
    payment_method: 'QR',
  },
});
describe('Bold trusted notifications', () => {
  it('verifies exact raw body using Base64 HMAC and rejects forged or empty test signatures', () => {
    const raw = Buffer.from(JSON.stringify(event()));
    const signature = createHmac('sha256', 'secret')
      .update(raw.toString('base64'))
      .digest('hex');
    expect(verifyBoldSignature(raw, signature, 'secret')).toBe(true);
    expect(
      verifyBoldSignature(
        Buffer.concat([raw, Buffer.from(' ')]),
        signature,
        'secret',
      ),
    ).toBe(false);
    expect(verifyBoldSignature(raw, signature, '')).toBe(false);
    for (const invalid of [undefined, '', 'abc', 'x'.repeat(64)])
      expect(verifyBoldSignature(raw, invalid, 'secret')).toBe(false);
  });
  it('records QR without inventing payer name or origin bank', () => {
    const parsed = parseBoldEvent(
      Buffer.from(JSON.stringify(event())),
      'merchant',
    );
    expect(parsed.amount).toBe('35000.00');
    expect(parsed.payerName).toBeNull();
    expect(parsed.paidAt.toISOString()).toBe('2026-11-01T23:00:00.000Z');
  });
  it('rejects foreign merchant, invalid amount, currency and timestamp', () => {
    expect(() =>
      parseBoldEvent(Buffer.from(JSON.stringify(event())), 'other'),
    ).toThrow();
    for (const amount of [-1, 0, '35000', 1.234, 1e15]) {
      const e: any = event();
      e.data.amount.total = amount;
      expect(() =>
        parseBoldEvent(Buffer.from(JSON.stringify(e)), 'merchant'),
      ).toThrow();
    }
    const e = event();
    e.data.amount.currency = 'USD';
    expect(() =>
      parseBoldEvent(Buffer.from(JSON.stringify(e)), 'merchant'),
    ).toThrow();
    e.data.amount.currency = 'COP';
    e.data.created_at = 'yesterday';
    expect(() =>
      parseBoldEvent(Buffer.from(JSON.stringify(e)), 'merchant'),
    ).toThrow();
  });
  it('does not revive voided payments or downgrade approval on a delayed rejection', () => {
    expect(nextBoldStatus('voided', 'SALE_APPROVED')).toBe('voided');
    expect(nextBoldStatus('approved', 'SALE_REJECTED')).toBe('approved');
    expect(nextBoldStatus('approved', 'VOID_APPROVED')).toBe('voided');
  });
});
