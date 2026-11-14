import { harness } from './whatsapp-accuracy.test-support';
const menu = [
  {
    id: 5371,
    code: 11,
    name: '1/2 Pollo Broaster',
    description: 'Medio pollo broaster, acompañado de papas saladas y arepas.',
    price: 26000,
    availableNow: true,
    hasAttributes: false,
    attributes: [],
  },
  {
    id: 5372,
    code: 12,
    name: '1/2 Pollo Frito',
    description: 'Medio pollo frito, acompañado de papas saladas y arepas.',
    price: 25000,
    availableNow: true,
    hasAttributes: false,
    attributes: [],
  },
];
function setup(products = menu) {
  const h = harness(products, true);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.findTodayOrdersByPhone = jest
    .fn()
    .mockResolvedValue([]);
  return h;
}
test('composition alternatives identify full preparations and the absent request', async () => {
  const h = setup();
  await h.sendQueued(
    'Buenas tardes, hazme un favor, sí, mira, es para medio broster y medio asado, ¿y ese con qué vendría?',
  );
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.replies.at(-1)).toMatch(/no tenemos.*medio pollo asado/i);
  expect(h.replies.at(-1)).toContain('1/2 Pollo Broaster');
  expect(h.replies.at(-1)).toContain('1/2 Pollo Frito');
  expect(h.replies.at(-1)).not.toContain('*Con medio pollo*');
  expect(h.conv.sessionData.pendingMatch?.candidates.map((p) => p.id)).toEqual(
    expect.arrayContaining([5371, 5372]),
  );
});
test('a restaurant offering asado retains it as an available preparation', async () => {
  const h = setup([
    ...menu,
    {
      ...menu[0],
      id: 5373,
      code: 13,
      name: '1/2 Pollo Asado',
      description: 'Medio pollo asado con arroz.',
    },
  ]);
  await h.sendQueued('medio broaster y medio asado con qué viene?');
  expect(h.replies.at(-1)).not.toMatch(/no tenemos.*asado/i);
  expect(h.conv.sessionData.cart).toEqual([]);
});
for (const feedback of [
  'mal programado ese chatbot',
  'ese bot está mal programado',
  'mal programado este bot',
])
  test(`criticism after a real cancellation keeps the recorded empty-cart result ${feedback}`, async () => {
    const h = setup();
    await h.sendQueued('quiero medio pollo broaster');
    await h.sendQueued('cancela el pedido');
    expect(h.conv.sessionData.cart).toEqual([]);
    h.agent.runTurn.mockClear();
    h.agent.runTurn.mockResolvedValue({
      reply: 'No debí decir que cancelé sin hacerlo.',
      actions: {},
      toolCalls: [],
    });
    await h.sendQueued(feedback);
    expect(h.replies.at(-1)).toMatch(/carrito.*vacío/i);
    expect(h.replies.at(-1)).not.toMatch(/sin hacerlo|no deb[ií]/i);
    expect(h.agent.runTurn).not.toHaveBeenCalled();
  });
