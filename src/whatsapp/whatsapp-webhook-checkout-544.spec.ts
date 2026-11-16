import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import { request } from 'node:http';
import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappMetaService } from './whatsapp-meta.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappRateLimitService } from './whatsapp-rate-limit.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';

for (const name of ['Combo De Pollo Mixto', 'Combo De Tofu']) {
  it(`signed HTTP bursts preserve delivery and beverage together ${name}`, async () => {
    const menu = [{ id: 54401, code: 89, name, price: 57000, availableNow: true, hasAttributes: true,
      attributes: [{ attributeName: 'Bebida', options: ['Colombiana', '7up', 'Ginger'] }] }];
    const h = harness(menu, true);
    h.conv.customerName=null!;
    h.conv.waId = '573000000001';
    h.conv.sessionData = { orderType: 'delivery', cart: [{ productId: 54401, code: 89, name, unitPrice: 57000, quantity: 1,
      attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }] }] };
    h.service.settingsService.semanticRoutingEnabled = () => true;
    h.service.conversationService.getRecentMessageTexts = jest.fn().mockResolvedValue([]);
    h.service.conversationService.saveSemanticSession = jest.fn(async (_conv, expected, next, state, customerName) => {
      if (h.conv.state !== expected.state || JSON.stringify(h.conv.sessionData) !== JSON.stringify(expected.session)) return false;
      h.conv.sessionData = structuredClone(next); h.conv.state = state;
      if (customerName) h.conv.customerName = customerName;
      return true;
    });
    const seen = new Set<string>();
    const claim = h.service.conversationService.claimInboundMessage;
    h.service.conversationService.claimInboundMessage = async data => {
      if (seen.has(data.waMessageId)) return null;
      seen.add(data.waMessageId);
      return claim(data);
    };
    h.service.conversationService.findByWaMessageId = jest.fn(async id => seen.has(id) ? { id } : null);
    h.service.ordersService.create = jest.fn();
    h.service.agentService = new WhatsappAgentService({ getEffectiveConfig: async () => ({ ...h.cfg,
      openaiApiKey: 'synthetic-key', openaiModel: 'gpt-4o-mini', systemPrompt: '' }) } as never, new WhatsappCatalogService({} as never));
    const call = (name: string, args: unknown) => ({ id: `call-${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
    const response = (calls?: unknown[]) => new Response(JSON.stringify({ choices: [{ message: { content: calls ? null : 'Listo', tool_calls: calls } }] }), { status: 200 });
    const address = 'Conjunto altavista Torre 4 1105';
    const inference = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Unconfigured external request'))
      .mockResolvedValueOnce(response([call('interpret_message', { segments: [
        { text: 'Por fa', role: 'conversation', productIds: [] }, { text: address, role: 'checkout', productIds: [] },
        { text: 'Con 7up', role: 'edit', productIds: [54401] },
      ] })]))
      .mockResolvedValueOnce(response([
        call('set_address', { sourceText: address, address }),
        call('set_attribute', { sourceText: 'Con 7up', productId: 54401, cartLineIndex: 0, attributeName: 'Bebida', attributeValue: '7up' }),
      ]))
      .mockResolvedValueOnce(response());
    const secret = 'synthetic-local-app-secret';
    const settings = { getEffectiveConfig: async () => ({ ...h.cfg, appSecret: secret }) };
    const meta = new WhatsappMetaService(settings as never);
    const sendText = jest.spyOn(meta, 'sendText').mockRejectedValue(new Error('Outgoing Meta is blocked'));
    const module = await Test.createTestingModule({ controllers: [WhatsappWebhookController], providers: [
      { provide: WhatsappSettingsService, useValue: settings }, { provide: WhatsappMetaService, useValue: meta },
      { provide: WhatsappOrchestratorService, useValue: h.service },
      { provide: WhatsappRateLimitService, useValue: { allow: () => true } },
      { provide: WhatsappConversationService, useValue: h.service.conversationService },
    ] }).compile();
    const app = module.createNestApplication({ rawBody: true, logger: false });
    app.setGlobalPrefix('api');
    try {
      await app.listen(0, '127.0.0.1');
      const url = await app.getUrl();
      const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { messages:
        ['Por fa', address, 'Con 7up'].map((text, index) => ({ from: h.conv.waId, id: `http-${index}`,
          type: 'text', text: { body: text }, timestamp: String(Math.floor(Date.now() / 1000)) })),
      } }] }] });
      const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
      const post = (signature: string) => new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const req = request(`${url}/api/whatsapp/webhook`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature },
        }, res => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(data) }));
        });
        req.on('error', reject); req.end(body);
      });
      expect((await post(`sha256=${'0'.repeat(64)}`)).status).toBe(401);
      expect(inference).not.toHaveBeenCalled();
      expect(await post(signature)).toEqual({ status: 200, body: { ok: true } });
      expect(inference).toHaveBeenCalledTimes(3);
      expect(h.service.conversationService.getRecentMessageTexts).toHaveBeenCalledWith(1, 14, '1');
      expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({ productId: 54401, quantity: 1,
        attributes: [{ attributeName: 'Bebida', attributeValue: '7up' }] })]);
      expect(h.conv.sessionData.address).toContain('altavista');
      expect(h.conv.state).toBe('awaiting_name');
      expect(h.replies.join('\n')).not.toMatch(/aclaras qué quieres|no entendí/i);
      const snapshot = structuredClone(h.conv.sessionData);
      const replies = h.replies.length;
      expect((await post(signature)).status).toBe(200);
      expect(h.conv.sessionData).toEqual(snapshot);
      expect(h.replies).toHaveLength(replies);
      expect(inference).toHaveBeenCalledTimes(3);
      expect(sendText).not.toHaveBeenCalled();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    } finally { await app.close(); jest.restoreAllMocks(); }
  }, 15000);
}
