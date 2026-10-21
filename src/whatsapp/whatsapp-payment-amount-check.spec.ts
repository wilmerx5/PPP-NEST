import { harness } from './whatsapp-accuracy.test-support';
import { parsePaymentAmountQuestion } from './whatsapp-session-intents';

type Product = { id: number; code: number; name: string; price: number; categoryName: string; availableNow: boolean; hasAttributes: boolean; attributes: never[] };
type Menu = { id: string; dish: Product; trap: Product; order: string; thousands: string };

const product = (id: number, name: string, price: number, categoryName: string): Product =>
  ({ id, code: id, name, price, categoryName, availableNow: true, hasAttributes: false, attributes: [] });

// The trap product costs exactly the order total with the fixed delivery fee (2.000).
const menus: Menu[] = [
  { id: 'chicken combos', dish: product(510, 'Combo Pollo Apanado', 55000, 'Combos'),
    trap: product(511, 'Combo Pollo Mixto', 57000, 'Combos'), order: 'un combo pollo apanado', thousands: '57' },
  { id: 'pizzas', dish: product(520, 'Pizza Mediana Hawaiana', 38000, 'Pizzas'),
    trap: product(521, 'Pizza Familiar Pepperoni', 40000, 'Pizzas'), order: 'una pizza mediana hawaiana', thousands: '40' },
  { id: 'sushi', dish: product(530, 'Roll Acevichado', 24000, 'Rolls'),
    trap: product(531, 'Combo Roll Tempura', 26000, 'Rolls'), order: 'un roll acevichado', thousands: '26' },
];

const money = (value: number) => `$${value.toLocaleString('es-CO').replace(/,/g, '.')}`;

describe('parsePaymentAmountQuestion', () => {
  it.each([
    ['Te transformo 57.000?', { amount: 57000, transfer: true }],
    ['te transfiero 57,000', { amount: 57000, transfer: true }],
    ['te consigno 57 mil por nequi?', { amount: 57000, transfer: true }],
    ['son $57.000?', { amount: 57000, transfer: false }],
    ['entonces serían 57000 con el domicilio?', { amount: 57000, transfer: false }],
    ['¿Te paso 60.000?', { amount: 60000, transfer: false }],
  ])('«%s» is an amount-to-pay question', (text, expected) => {
    expect(parsePaymentAmountQuestion(text)).toEqual(expected);
  });

  it.each(['pago con 100.000', '57.000', 'son 57.000', 'el de 57.000 trae bebida?', 'calle 57 # 10-20?', 'quiero 2 combos', 'te transfiero ya'])(
    '«%s» is not an amount-to-pay question', text => {
      expect(parsePaymentAmountQuestion(text)).toBeNull();
    });
});

describe.each(menus)('$id: amount-to-pay questions during checkout', m => {
  describe.each([false, true])('agent %s', agent => {
    const total = m.dish.price + 2000;
    const start = async (claim = `Listo, agregué *${m.trap.name}* ✅`) => {
      const h = harness([m.dish, m.trap] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      // Both models make the real-chat mistake: the amount matches another product's price.
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: claim, actions: { addItems: [{ productId: m.trap.id, quantity: 1 }] } });
      h.agent.runTurn.mockResolvedValue({ reply: claim, actions: { addItems: [{ productId: m.trap.id, quantity: 1 }] }, toolCalls: [] });
      await h.sendQueued('para un domicilio');
      await h.sendQueued(m.order);
      await h.sendQueued('calle 45 # 12-10');
      await h.sendQueued('así está bien gracias');
      expect(h.conv.state).toBe('awaiting_payment');
      expect(h.conv.sessionData.orderType).toBe('delivery');
      return h;
    };
    const onlyDish = (h: ReturnType<typeof harness>) => expect(h.cartRows()).toEqual([expect.objectContaining({ id: m.dish.id, qty: 1 })]);

    it.each([
      (t: number) => `Te transformo ${money(t).slice(1)}?`,
      (t: number) => `te transfiero ${money(t).slice(1)}`,
      () => `te consigno ${m.thousands} mil por nequi?`,
      (t: number) => `son ${money(t)}?`,
    ])('a question with the exact total confirms it and adds nothing (%#)', async build => {
      const h = await start();
      const reply = String(await h.sendQueued(build(total)));
      onlyDish(h);
      expect(reply).toContain(`Sí, el total es *${money(total)}*`);
      expect(reply).toContain(`pedido ${money(m.dish.price)} + domicilio $2.000`);
      expect(reply).not.toMatch(/agregu/i);
      expect(reply).not.toContain(m.trap.name);
      expect(h.conv.state).toBe('awaiting_payment');
    });

    it('a transfer with the exact total explains how to choose transfer', async () => {
      const h = await start();
      const reply = String(await h.sendQueued(`te transfiero ${money(total).slice(1)}`));
      expect(reply).toContain('escribe *transferencia*');
      expect(h.conv.sessionData.paymentMethod).toBeFalsy();
    });

    it('a different amount is corrected with the real total', async () => {
      const h = await start();
      const wrong = total + 5000;
      const reply = String(await h.sendQueued(`te transfiero ${money(wrong).slice(1)}?`));
      onlyDish(h);
      expect(reply).toContain(`El total del pedido es *${money(total)}*`);
      expect(reply).toContain(`no ${money(wrong)}`);
    });

    it('a cash denomination for change is not answered as an amount check', async () => {
      const h = await start();
      const reply = String(await h.sendQueued('pago con 100.000'));
      expect(reply).not.toContain('Sí, el total es');
      expect(reply).not.toContain('El total del pedido es *');
    });

    it('a bare amount without a question is not answered as an amount check', async () => {
      const h = await start();
      const reply = String(await h.sendQueued(money(total).slice(1)));
      expect(reply).not.toContain('Sí, el total es');
      onlyDish(h);
    });

    it('an off-topic question never repeats a model reply that claims an addition', async () => {
      const h = await start();
      const reply = String(await h.sendQueued('que es eso de la luna?'));
      onlyDish(h);
      expect(reply).not.toMatch(/agregu/i);
      expect(reply).not.toContain(m.trap.name);
    });

    it('an off-topic question still keeps a harmless model reply', async () => {
      const h = await start('Eso no lo sé, pero sigo con tu pedido.');
      const reply = String(await h.sendQueued('que es eso de la luna?'));
      onlyDish(h);
      expect(reply).not.toMatch(/agregu/i);
    });

    it('with an empty cart the amount question is not answered as a total', async () => {
      const h = harness([m.dish, m.trap] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Qué se te antoja?', actions: {} });
      h.agent.runTurn.mockResolvedValue({ reply: '¿Qué se te antoja?', actions: {}, toolCalls: [] });
      const reply = String(await h.sendQueued(`son ${money(total)}?`));
      expect(reply).not.toContain('Sí, el total es');
      expect(reply).not.toContain('El total del pedido es *');
    });

    it('for pickup the total has no delivery fee', async () => {
      const h = harness([m.dish, m.trap] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      h.agent.runTurn.mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {}, toolCalls: [] });
      await h.sendQueued('para recoger');
      await h.sendQueued(m.order);
      const reply = String(await h.sendQueued(`son ${money(m.dish.price)}?`));
      expect(reply).toContain(`Sí, el total es *${money(m.dish.price)}*.`);
      expect(reply).not.toContain('domicilio');
    });
  });
});
