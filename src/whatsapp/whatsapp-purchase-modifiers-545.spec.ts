import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const call = (name: string, args: unknown) => ({ id: `call-${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const answer = (content: string | null, calls?: unknown[]) => ({ ok: true, json: async () => ({ choices: [{ message: { content, tool_calls: calls } }] }) }) as Response;
const menu = [
  { id: 54501, code: 25, name: 'Pechuga a La Plancha', price: 30000, availableNow: true, description: 'Pechuga acompañada de papa francesa, arroz y ensalada.', attributes: [] },
  { id: 54502, code: 11, name: 'Tofu a La Plancha', price: 25000, availableNow: true, description: 'Tofu acompañado de papa francesa, arroz y ensalada.', attributes: [] },
  { id: 54503, code: 9, name: 'Porción De Papa Francesa', price: 8000, availableNow: true, attributes: [] },
  { id: 54504, code: 8, name: 'Porción De Papa Salada', price: 7000, availableNow: true, attributes: [] },
];
function setup() {
  const h = harness(menu, true);
  h.conv.customerName = null;
  h.conv.sessionData = { cart: [], orderType: 'delivery' };
  h.service.settingsService.semanticRoutingEnabled = () => true;
  h.service.conversationService.saveSemanticSession = jest.fn(async (_conv, expected, next, state) => {
    if (h.conv.state !== expected.state || JSON.stringify(h.conv.sessionData) !== JSON.stringify(expected.session)) return false;
    h.conv.sessionData = structuredClone(next); h.conv.state = state; return true;
  });
  h.service.agentService = new WhatsappAgentService({ getEffectiveConfig: async () => ({ openaiApiKey: 'synthetic',
    openaiModel: 'gpt-4o-mini', systemPrompt: '', aiTemperature: 0.2, localContext: {}, paymentMethods: DEFAULT_PAYMENT_METHODS }) } as never,
    new WhatsappCatalogService({} as never));
  return h;
}
beforeEach(() => jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Unexpected network in free regression')));
afterEach(() => jest.restoreAllMocks());

for (const product of menu.slice(0, 2)) for (const separator of ['  ', '\n']) {
  it(`repairs an accompaniment assigned to unrelated SKUs before adding ${product.name}/${JSON.stringify(separator)}`, async () => {
    const h = setup(); const purchase = `2 ${product.name} por favor`;
    const modifier = 'En vez de papa francesas, papa salada'; const text = purchase + separator + modifier;
    const network = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [
        { text: purchase, role: 'purchase', productIds: [product.id] },
        { text: modifier, role: 'edit', productIds: [54503, 54504] },
      ] })]))
      .mockResolvedValueOnce(answer(null, [call('interpret_message', { segments: [{ text, role: 'purchase', productIds: [product.id] }] })]))
      .mockResolvedValueOnce(answer(null, [call('add_item', { productId: product.id, quantity: 2,
        note: 'En vez de papa francesa, papa salada', sourceText: text })]))
      .mockResolvedValueOnce(answer('Listo'));
    const reply = await h.sendQueued(text);
    expect(network).toHaveBeenCalledTimes(4);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: product.id, quantity: 2,
      note: expect.stringMatching(/papa salada/i) })]);
    expect(reply).not.toMatch(/aclaras qué quieres|no entend/i);
    await h.sendQueued('No señor');
    expect(h.conv.state).toBe('awaiting_name');
    expect(h.conv.sessionData.cart[0].quantity).toBe(2);
  });
}

it('does not authorize edits on an absent cart line after its bounded repair', async () => {
  const h = setup(); const text = 'Cambia la papa por salada';
  const invalid = answer(null, [call('interpret_message', { segments: [{ text, role: 'edit', productIds: [54503, 54504] }] })]);
  const network = jest.spyOn(global, 'fetch').mockResolvedValueOnce(invalid).mockResolvedValueOnce(invalid);
  const reply = await h.sendQueued(text);
  expect(network).toHaveBeenCalledTimes(2);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(reply).toMatch(/aclaras/i);
});
