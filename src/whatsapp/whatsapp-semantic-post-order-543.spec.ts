import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';

for (const name of ['Arroz Chino', 'Bowl Andino']) for (const state of ['completed', 'closed']) {
  for (const form of ['address', 'reference', 'correction', 'conditional', 'question', 'negated']) {
    it(`confirmed-order context and new semantic purchase ${name}/${state}/${form}`, async () => {
      const menu = [{ id: 54310, code: 10, name, price: 19000, availableNow: true, hasAttributes: false, attributes: [] }];
      const h = harness(menu, true);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 469, dailyOrderNumber: 469 });
      h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
      h.service.conversationService.reopenForNewOrder = jest.fn(async () => {
        await h.service.conversationService.resetOrderSession(h.conv, 'building_cart', { ignorePriorHistory: true });
        return h.conv;
      });
      Object.assign(h.conv.sessionData, { orderType: 'pickup', fulfillmentChosen: true, phoneConfirmed: true,
        contactPhone: h.conv.phoneE164, notesCollected: true });
      await h.sendQueued(`Un ${name}`);
      await h.sendQueued('nada mas');
      await h.sendQueued('contraentrega');
      await h.sendQueued('confirmar');
      expect(h.conv.state).toBe('completed');
      const originalOrder = structuredClone(h.service.ordersService.create.mock.calls[0][0]);
      h.conv.state = state;
      const before = structuredClone(h.conv.sessionData);
      h.service.settingsService.semanticRoutingEnabled = () => true;
      h.service.conversationService.saveSemanticSession = jest.fn(async (_conv, expected, next, nextState) => {
        if (h.conv.state !== expected.state || JSON.stringify(h.conv.sessionData) !== JSON.stringify(expected.session)) return false;
        h.conv.sessionData = structuredClone(next); h.conv.state = nextState; return true;
      });
      h.service.agentService = new WhatsappAgentService({ getEffectiveConfig: async () => ({ ...h.cfg,
        openaiApiKey: 'offline-fixture', openaiModel: 'gpt-4o-mini', systemPrompt: 'Usa el catálogo.', aiTemperature: 0.2 }) } as never,
        h.service.catalogService);
      const agent = jest.spyOn(h.service.agentService, 'runTurn');
      let round = 0;
      jest.spyOn(global, 'fetch').mockImplementation(async () => {
        const input = agent.mock.calls.at(-1)![0] as { userMessage: string };
        expect(input.userMessage).not.toMatch(/Calle|Carrera|direcci[oó]n|Torre/i);
        const calls = round++ === 0 ? [{ name: 'interpret_message', args: { segments: [
          { text: input.userMessage, role: 'purchase', productIds: [54310] },
        ] } }] : round === 2 ? [{ name: 'add_item', args: { productId: 54310, quantity: 2, sourceText: input.userMessage } }] : [];
        return new Response(JSON.stringify({ choices: [{ message: { content: calls.length ? '' : 'Listo',
          ...(calls.length ? { tool_calls: calls.map((call, index) => ({ id: `543-post-${round}-${index}`, type: 'function',
            function: { name: call.name, arguments: JSON.stringify(call.args) } })) } : {}),
        } }] }), { status: 200 });
      });
      const phrase = {
        address: `Cambia la dirección a Calle 7b #78c-79; y aparte quiero dos ${name}`,
        reference: `La dirección correcta es Calle 10B #81F-20, y para otro pedido quiero dos ${name}`,
        correction: `Corrige mi pedido, era un ${name}; además quiero dos ${name}`,
        conditional: `Cambia la dirección a Calle 7b #78c-79; si se puede aparte quiero dos ${name}`,
        question: `La dirección correcta es Calle 10B #81F-20; ¿puedo pedir dos ${name} aparte?`,
        negated: 'Cambia la dirección a Carrera 80 #6-12; todavía no quiero otro pedido',
      }[form]!;
      const reply = await h.sendQueued(phrase);
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create.mock.calls[0][0]).toEqual(originalOrder);
      expect(reply).not.toMatch(/direcci[oó]n (?:actualizada|cambiada)|ya modifiqu[eé]/i);
      if (['address', 'reference', 'correction'].includes(form)) {
        expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 54310, quantity: 2 })]);
        expect(h.conv.sessionData.address || '').not.toMatch(/78c|81f|80.*6-12/i);
        expect(agent).toHaveBeenCalledTimes(1);
      } else {
        expect(h.conv.state).toBe(state);
        expect(h.conv.sessionData).toEqual(before);
        expect(agent).not.toHaveBeenCalled();
      }
    });
  }
}
afterEach(() => jest.restoreAllMocks());
