import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';

describe('Resumen de fotos: conserva errores y comprobantes', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it.each([
    { resolved: false, state: 'building_cart', reply: 'No pude leer tu foto', expected: 'No pude leer tu foto' },
    { resolved: false, state: 'building_cart', reply: 'Comprobante recibido', expected: 'Comprobante recibido' },
    { resolved: true, state: 'awaiting_payment', reply: '¿Cómo pagas?', expected: '¿Cómo pagas?' },
    { resolved: true, state: 'building_cart', reply: 'Listo pollo', expected: 'Carrito completo\n\n¿Algo más?' },
  ])('estado $state, respuesta $reply', async ({ resolved, state, reply, expected }) => {
    const service = Object.create(WhatsappOrchestratorService.prototype) as any;
    service.imageBurstSeq = new Map([['test', 1]]);
    service.outboundHoldByWaId = new Map([['test', [reply]]]);
    service.conversationService = {
      reloadConversation: async () => ({ state }),
      getSession: () => ({ cart: [{}] }),
    };
    service.settingsService = { getEffectiveConfig: async () => ({}) };
    service.deliveryFeeFor = () => 0;
    service.formatCartOnly = () => 'Carrito completo';
    service.formatContinueShoppingPrompt = () => '¿Algo más?';
    const processing = service.collapseBurstReplies('test', { raw: {
      imageBurstTicket: 1, resolvedOrderImage: resolved,
    } }, { id: 1 });
    await jest.advanceTimersByTimeAsync(2000);
    await processing;
    expect(service.outboundHoldByWaId.get('test')).toEqual([expected]);
  });
});
