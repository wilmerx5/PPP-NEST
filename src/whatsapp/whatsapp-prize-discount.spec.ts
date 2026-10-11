import { whatsappPrizeDiscount } from './whatsapp-points.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';

function session(code = 'ABCD2345EFGH'): WhatsappSessionData {
  return { cart: [
    { productId: 17, code: 17, name: 'Otro', quantity: 1, unitPrice: 38000 },
    { productId: 5, code: 5, name: 'Medio', quantity: 3, unitPrice: 25000 },
    { productId: 2, code: 2, name: 'Otro medio', quantity: 1, unitPrice: 24000 },
  ], orderType: 'pickup', pendingRedemptionCode: code };
}
describe('Descuento de un premio validado', () => {
  it('descuenta una sola unidad de la primera línea elegible sin tocar cantidades ni precios', () => {
    const input = session();
    const before = structuredClone(input);
    expect(whatsappPrizeDiscount(input)).toBe(25000);
    expect(input).toEqual(before);
  });
  it('no descuenta sin código', () => expect(whatsappPrizeDiscount(session(''))).toBe(0));
  it('no descuenta otro plato aunque haya código', () => {
    const input = session(); input.cart = input.cart.slice(0, 1);
    expect(whatsappPrizeDiscount(input)).toBe(0);
  });
  it.each(['2000-01-01', 'invalid-date'])('no cotiza descuento con caducidad %s', expires => {
    const input = session(); input.pendingRedemptionExpiresAt = expires;
    expect(whatsappPrizeDiscount(input)).toBe(0);
  });
});
