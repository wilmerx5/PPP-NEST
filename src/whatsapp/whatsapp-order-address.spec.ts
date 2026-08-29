import { composeWhatsappOrderAddress } from './whatsapp-order-address';
import type { WhatsappPaymentMethodConfig } from './whatsapp-payment-methods';

describe('composeWhatsappOrderAddress', () => {
  const methods: WhatsappPaymentMethodConfig[] = [
    {
      id: 'cash',
      label: 'Efectivo',
      enabled: true,
      flow: 'immediate',
      keywords: ['cash', 'efectivo'],
      optionText: '*efectivo*',
    },
  ];

  it('no mete pago como adicional: va en address con slash', () => {
    expect(
      composeWhatsappOrderAddress(
        {
          address: 'Bosques de Castilla',
          paymentMethod: 'cash',
        },
        methods,
      ),
    ).toBe('Bosques de Castilla / Efectivo');
  });

  it('incluye cambio y notas', () => {
    expect(
      composeWhatsappOrderAddress(
        {
          address: 'Tabaku T4',
          paymentMethod: 'cash',
          cashChangeFor: 'cambio de 50',
          customerNotes: 'portería',
        },
        methods,
      ),
    ).toBe('Tabaku T4 / Efectivo / cambio de 50 / portería');
  });

  it('sin extras de sesión deja la dirección igual', () => {
    expect(
      composeWhatsappOrderAddress({ address: 'Calle 10 #5-20' }, methods),
    ).toBe('Calle 10 #5-20');
  });
});
