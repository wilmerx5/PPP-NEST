import {
  boldExpiry,
  boldOnlineRequest,
  safeQrImage,
} from './bold-online-client';
describe('Bold online response validation', () => {
  afterEach(() => jest.restoreAllMocks());
  it('handles nanosecond expiry without truncating to the wrong unit', () => {
    const millis = Date.now() + 600000;
    expect(boldExpiry(String(BigInt(millis) * 1000000n)).getTime()).toBe(
      millis,
    );
    expect(boldExpiry(String(millis)).getTime()).toBe(millis);
    expect(() => boldExpiry(String(Date.now() - 1))).toThrow();
  });
  it('only renders PNG data and rejects arbitrary URLs and oversized payloads', () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
    expect(safeQrImage(png)).toBe(`data:image/png;base64,${png}`);
    expect(() => safeQrImage('https://unknown.example/qr')).toThrow();
    expect(() => safeQrImage('A'.repeat(500001))).toThrow();
  });
  it('does not disclose upstream secrets or payer data when Bold rejects access', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          errors: [
            { code: 'NOT_ENABLED', message: 'secret and payer details' },
          ],
        }),
      } as Response);
    await expect(
      boldOnlineRequest('real-key', '/v1/payment/pse/banks'),
    ).rejects.toThrow('habilitación');
    try {
      await boldOnlineRequest('real-key', '/v1/payment/pse/banks');
    } catch (e) {
      expect(String(e)).not.toContain('secret and payer details');
      expect(String(e)).not.toContain('real-key');
    }
  });
});
