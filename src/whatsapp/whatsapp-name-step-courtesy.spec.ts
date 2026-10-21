import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

type Menu = { id: string; dish: string; side: string };

const menus: Menu[] = [
  { id: 'grill', dish: 'Hamburguesa Con Queso', side: 'Jugo De Lulo' },
  { id: 'regional', dish: 'Bandeja Paisa', side: 'Empanada De Carne' },
  { id: 'pizzeria', dish: 'Pizza Hawaiana', side: 'Malteada De Fresa' },
];

const notNames = [
  'Ok gracia',
  'Dale, muchas gracias',
  'Listo, muchas gracias',
  'Gracias\nMuy amable',
  'Ah dale gracia',
  'Vale te encargo',
  'Ok\nQuedo pendiente',
  'Nada que llega',
  'Ok ya reci',
  'Te encargo por fis que llegue caliente',
  'Pregunta le pago al mensajero o te puedo pagar aquí',
  'Y me puedes enviar salsas',
  'Por favor bien caliente y con salsas',
  'A nombre de',
  'Muchas graciqs',
  'Te recomiendo por fa',
];

const realNames = ['Lucía Fernanda Rojas', 'José del Carmen Díaz', 'María de los Ángeles', 'Gracia Montoya', 'Luz Marina'];

type Rig = ReturnType<typeof harness> & { created: jest.Mock };

function rig(m: Menu, agent: boolean): Rig {
  const menu = [
    { id: 1, code: 401, name: m.dish, price: 25000, availableNow: true, hasAttributes: false, attributes: [] },
    { id: 2, code: 402, name: m.side, price: 6000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const h = harness(menu as never, agent);
  h.cfg.paymentMethods = DEFAULT_PAYMENT_METHODS.map(method => ({ ...method, enabled: method.flow !== 'mercadopago' }));
  const created = jest.fn().mockResolvedValue({ id: 1, dailyOrderNumber: 1 });
  const orders = (h.service as unknown as { ordersService: Record<string, unknown> }).ordersService;
  orders.create = created;
  orders.findTodayOrdersByPhone = async () => [];
  h.conv.customerName = null as never;
  h.conv.sessionData.cart = [{ productId: 1, code: 401, name: m.dish, unitPrice: 25000, quantity: 1, attributes: [] }];
  Object.assign(h.conv.sessionData, {
    orderType: 'delivery', fulfillmentChosen: true, address: 'Calle 10 #20-30', addressConfirmed: true,
    phoneConfirmed: true, contactPhone: h.conv.phoneE164, notesCollected: true, deliveryFeeCalculated: 2000,
  });
  h.conv.state = 'awaiting_name';
  return Object.assign(h, { created });
}

const flat = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

function expectNameStillMissing(h: Rig, said: string, agent: boolean) {
  expect(flat(String(h.conv.customerName || ''))).not.toBe(flat(said));
  expect(h.conv.customerName || null).toBeNull();
  expect(h.conv.state).toBe('awaiting_name');
  expect(h.created).not.toHaveBeenCalled();
  expect(h.conv.sessionData.cart.map(line => [line.name, line.quantity])).toHaveLength(1);
  if (!agent) expect(h.replies.at(-1) || '').toMatch(/nombre/i);
}

describe.each(menus)('name step ignores conversational replies ($id)', (m) => {
  describe.each([false, true])('agent %s', (agent) => {
    it.each(notNames)('%j is not taken as the customer name', async (said) => {
      const h = rig(m, agent);
      await h.sendQueued(said);
      expectNameStillMissing(h, said, agent);
    });

    it('a dish of the menu is not taken as the customer name', async () => {
      const h = rig(m, agent);
      await h.sendQueued(m.side.toLowerCase());
      expectNameStillMissing(h, m.side, agent);
    });

    it.each(realNames)('%j is kept as the customer name', async (name) => {
      const h = rig(m, agent);
      await h.sendQueued(name);
      expect(h.conv.customerName).toBe(name);
      expect(h.conv.state).not.toBe('awaiting_name');
      expect(h.created).not.toHaveBeenCalled();
    });

    it('a courtesy reply first and the real name after keeps only the real name', async () => {
      const h = rig(m, agent);
      await h.sendQueued('Dale, muchas gracias');
      expectNameStillMissing(h, 'Dale, muchas gracias', agent);
      await h.sendQueued('Sofía Herrera');
      expect(h.conv.customerName).toBe('Sofía Herrera');
      expect(h.conv.state).not.toBe('awaiting_name');
    });
  });
});
