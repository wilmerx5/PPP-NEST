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

describe('Sobre no soportado de un álbum', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it.each([
    {type:'other',nextImage:2,expected:[]},
    {type:'other',nextImage:0,expected:['No entendí bien tu mensaje']},
    {type:'image',nextImage:2,expected:['No entendí bien tu mensaje']},
  ])('tipo $type, siguiente foto $nextImage', async ({type,nextImage,expected}) => {
    const service = Object.create(WhatsappOrchestratorService.prototype) as any;
    service.imageBurstSeq = new Map([['test',2]]);
    service.latestImageTicketByWaId = new Map([['test',nextImage]]);
    service.outboundHoldByWaId = new Map([['test',['No entendí bien tu mensaje']]]);
    service.conversationService = {reloadConversation:async()=>({state:'building_cart'}),getSession:()=>({cart:[]})};
    service.settingsService = {getEffectiveConfig:async()=>({})};
    service.deliveryFeeFor = () => 0;
    const processing = service.collapseBurstReplies('test',{messageType:type,raw:{imageBurstTicket:1,resolvedOrderImage:false}},{id:1});
    await jest.advanceTimersByTimeAsync(2000);
    await processing;
    expect(service.outboundHoldByWaId.get('test')).toEqual(expected);
  });
});

describe('La respuesta final de una foto no depende del siguiente texto',()=>{
 it.each([false,true])('liberación inmediata de media=%s ante un texto aún agrupándose',async releaseImmediately=>{
  const service=Object.create(WhatsappOrchestratorService.prototype) as any;
  service.outboundHoldByWaId=new Map([['test',['Carrito de la foto\n¿Algo más?']]]);
  service.outboundCarryByWaId=new Map();
  service.inboundCoalesceByWaId=new Map([['test',{pending:[{text:'hola'}]}]]);
  service.logger={log:jest.fn()};service.sendReplyNow=jest.fn().mockResolvedValue(undefined);
  await service.flushOrDiscardOutboundHold('test',{id:1},'test',releaseImmediately);
  if(releaseImmediately){
   expect(service.sendReplyNow).toHaveBeenCalledWith({id:1},'test','Carrito de la foto\n¿Algo más?');
   expect(service.outboundCarryByWaId.has('test')).toBe(false);
  }else{
   expect(service.sendReplyNow).not.toHaveBeenCalled();expect(service.outboundCarryByWaId.get('test')).toEqual(['Carrito de la foto\n¿Algo más?']);
  }
 });
});
