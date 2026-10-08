import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';

describe('WhatsApp beta — inbound turn lifecycle integration', () => {
  const makeHarness = () => {
    const service = Object.create(WhatsappOrchestratorService.prototype) as any;
    service.outboundHoldByWaId = new Map();
    service.outboundCarryByWaId = new Map();
    service.inboundCoalesceByWaId = new Map();
    service.claimedInboundIdsByWaId = new Map();
    service.metaService = { sendText: jest.fn().mockResolvedValue(undefined) };
    service.conversationService = {
      findOrCreateConversation: jest.fn().mockResolvedValue({ id: 17 }),
      logMessage: jest.fn().mockResolvedValue({ id: 'reply' }),
      touchOutbound: jest.fn().mockResolvedValue(undefined),
      setInboundProcessingOutcome: jest.fn().mockResolvedValue(undefined),
    };
    service.handleIncomingUnlocked = jest.fn(async () => {
      service.claimedInboundIdsByWaId.set('customer', ['wamid.a', 'wamid.b']);
      service.outboundHoldByWaId.set('customer', ['Resumen de pedido']);
    });
    const msg = {
      waId: 'customer', phoneE164: '+573000000000', messageId: 'wamid.a',
      messageType: 'text', text: 'dos ajiacos', timestamp: 1, raw: {},
    };
    return { service, msg };
  };

  it('solo marca completed después de enviar la respuesta del turno', async () => {
    const { service, msg } = makeHarness();
    const events: string[] = [];
    service.metaService.sendText.mockImplementation(async () => { events.push('sent'); });
    service.conversationService.setInboundProcessingOutcome.mockImplementation(async () => {
      events.push('completed');
    });
    await service.runInboundUnlockedWithOutboundHold('customer', msg);
    expect(events).toEqual(['sent', 'completed']);
    expect(service.conversationService.setInboundProcessingOutcome).toHaveBeenCalledWith(
      ['wamid.a', 'wamid.b'], 'completed',
    );
    expect(service.outboundHoldByWaId.size).toBe(0);
  });

  it('fallo de Meta deja failed, sin afirmar que se respondió', async () => {
    const { service, msg } = makeHarness();
    service.metaService.sendText.mockRejectedValue(new Error('Meta unavailable'));
    await expect(service.runInboundUnlockedWithOutboundHold('customer', msg)).rejects.toThrow('Meta unavailable');
    expect(service.conversationService.setInboundProcessingOutcome).toHaveBeenCalledWith(
      ['wamid.a', 'wamid.b'], 'failed',
    );
    expect(service.outboundHoldByWaId.size).toBe(0);
  });

  it('error procesando el pedido no envía respuestas parciales y marca failed', async () => {
    const { service, msg } = makeHarness();
    service.handleIncomingUnlocked.mockImplementation(async () => {
      service.claimedInboundIdsByWaId.set('customer', ['wamid.a']);
      service.outboundHoldByWaId.set('customer', ['respuesta parcial']);
      throw new Error('order rejected');
    });
    await expect(service.runInboundUnlockedWithOutboundHold('customer', msg)).rejects.toThrow('order rejected');
    expect(service.metaService.sendText).not.toHaveBeenCalled();
    expect(service.conversationService.setInboundProcessingOutcome).toHaveBeenCalledWith(
      ['wamid.a'], 'failed',
    );
  });
});
