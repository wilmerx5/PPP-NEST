import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { requestWhatsappInference } from './whatsapp-openai-request';
jest.mock('./whatsapp-openai-request',()=>({requestWhatsappInference:jest.fn()}));
jest.mock('./whatsapp-agent-model',()=>({resolveWhatsappAgentRoute:(configured:string)=>({model:configured,reason:'primary'})}));
// Desired budget contract, not a measurement of live model quality or invoice.
for(const model of ['gpt-4o-mini','gpt-6.1-sol']) for(const [i,name] of ['Bowl De Tofu','Pizza Vegetariana'].entries()) for(const length of [419,420,421]) {
 it(`complete answer should not require a cosmetic retry ${model}/${i}/${length}`,async()=>{
  const prefix=`${name}: incluye verduras; cuesta $20.000. `;
  const answer=prefix+'Detalles de ingredientes disponibles. '.repeat(20).slice(0,length-prefix.length);
  const request=jest.mocked(requestWhatsappInference);request.mockReset();
  request.mockResolvedValue({ok:true,json:async()=>model.startsWith('gpt-6')?{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:answer}]}]}:{choices:[{message:{content:answer}}]}} as Response);
  const service=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'mock-only',openaiModel:model,localContext:{}})} as never,new WhatsappCatalogService({} as never));
  const result=await service.runTurn({userMessage:'Qué opciones tienes para almorzar?',sessionSummary:'carrito vacío',recentMessages:[],businessRulesBlock:'reglas',brandName:'Ficticio',products:[{id:99101,code:91,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]}]});
  expect(result.actions).toEqual({});
  expect(result.reply).toBe(answer.trim());
  expect(result.reply).toContain(name);
  expect(result.reply).toContain('$20.000');
  expect(request).toHaveBeenCalledTimes(1);
 });
}

for (const model of ['gpt-4o-mini', 'gpt-6.1-sol']) {
  const response = (text: string, add = false) => ({
    ok: true,
    json: async () => model.startsWith('gpt-6')
      ? { status: 'completed', output: add
        ? [{ type: 'function_call', call_id: 'add-bowl', name: 'add_item', arguments: '{"productId":99101}' }]
        : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] }
      : { choices: [{ message: add
        ? { content: null, tool_calls: [{ id: 'add-bowl', type: 'function', function: { name: 'add_item', arguments: '{"productId":99101}' } }] }
        : { content: text } }] },
  }) as Response;
  const service = () => new WhatsappAgentService({ getEffectiveConfig: async () => ({
    openaiApiKey: 'mock-only', openaiModel: model, localContext: {},
  }) } as never, new WhatsappCatalogService({} as never));
  const input = {
    userMessage: 'Quiero un Bowl De Tofu', cart: [], sessionSummary: '', recentMessages: [],
    businessRulesBlock: '', brandName: 'Ficticio',
    products: [{ id: 99101, code: 91, name: 'Bowl De Tofu', price: 20000,
      availableNow: true, hasAttributes: false, attributes: [] }],
  };
  it(`preserves the end of a long completed purchase without replaying tools ${model}`, async () => {
    const answer = 'Listo, agregué Bowl De Tofu. ' + 'Detalle del pedido. '.repeat(30)
      + 'Total $20.000; domicilio pendiente. ¿Algo más?';
    const request = jest.mocked(requestWhatsappInference); request.mockReset();
    request.mockResolvedValueOnce(response('', true)).mockResolvedValue(response(answer));
    const result = await service().runTurn(input);
    expect(result.error).toBeUndefined();
    expect(result.reply).toBe(answer);
    expect(result.actions.addItems?.map(item => [item.productId, item.quantity])).toEqual([[99101, 1]]);
    expect(result.toolCalls).toEqual(['add_item']);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it(`still recovers a long purchase claim with no applied action ${model}`, async () => {
    const answer = 'Listo, agregué Bowl De Tofu. ' + 'Detalle del pedido. '.repeat(30)
      + 'Total $20.000; domicilio pendiente. ¿Algo más?';
    const request = jest.mocked(requestWhatsappInference); request.mockReset();
    request.mockResolvedValueOnce(response(answer)).mockResolvedValueOnce(response('', true))
      .mockResolvedValue(response(answer));
    const result = await service().runTurn(input);
    expect(result.error).toBeUndefined();
    expect(result.reply).toBe(answer);
    expect(result.actions.addItems?.map(item => [item.productId, item.quantity])).toEqual([[99101, 1]]);
    expect(result.toolCalls).toEqual(['add_item']);
    expect(request).toHaveBeenCalledTimes(3);
  });
}
