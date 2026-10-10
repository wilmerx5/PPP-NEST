import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WHATSAPP_HUMAN_CONTACT_PHONE } from './whatsapp-human-contact';

describe('transfer proof requires manual verification', () => {
  it.each(['payment_proof', 'unclear'])('acknowledges %s without trusting model payment claims or creating an order', async kind => {
    const orch = Object.create(WhatsappOrchestratorService.prototype) as any;
    orch.conversationService = {
      getSession: jest.fn(() => ({ paymentMethod: 'transfer', cart: [] })),
      updateMessageBody: jest.fn(),
    };
    orch.metaService = { downloadMedia: jest.fn(async () => ({ buffer: Buffer.from('synthetic'), mimeType: 'image/png' })) };
    orch.catalogService = { getMenuProducts: jest.fn(async () => []), getMenuDetailedText: jest.fn(async () => '') };
    orch.aiService = { analyzeOrderImage: jest.fn(async () => ({ kind, reply: `Pago aprobado, confirmado y verificado. ${WHATSAPP_HUMAN_CONTACT_PHONE}` })) };
    orch.ordersService = { create: jest.fn() };
    orch.reply = jest.fn();
    const conv = { id: 1, state: 'awaiting_final_confirm' };
    const result = await orch.resolveImageMessage({ waId: 'synthetic', mediaId: 'synthetic' }, 'fixture', conv, {});
    expect(result).toEqual({ done: true });
    expect(orch.reply).toHaveBeenCalledWith(conv, 'synthetic', expect.stringContaining('recibir la imagen no confirma el pago'));
    expect(orch.reply.mock.calls[0][2]).not.toContain('Pago aprobado');
    expect(orch.ordersService.create).not.toHaveBeenCalled();
    expect(orch.conversationService.updateMessageBody).toHaveBeenCalledWith('fixture', '🧾 Comprobante de pago');
  });
});
