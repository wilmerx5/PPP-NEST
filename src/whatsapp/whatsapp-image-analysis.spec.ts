import { WhatsappAiService } from './whatsapp-ai.service';

/** Provider responses are fixtures; no model, Meta or network calls. */
describe('Image analysis provider contract — offline', () => {
  const input={buffer:Buffer.from('synthetic-image'),mimeType:'image/png',menuSummary:'Bowl Mediterraneo #9851'};
  const originalFetch=global.fetch;
  afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
  it.each(['gpt-5-mini','gpt-4.1-2025-04-14'])('reads the same structured order under %s',async model=>{
    const service=new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:'mock-key',openaiModel:model})} as never);
    const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({kind:'order',textForBot:'Dos bowls mediterraneos'})}}]})});global.fetch=fetchMock;
    expect(await service.analyzeOrderImage(input)).toMatchObject({kind:'order',textForBot:'Dos bowls mediterraneos'});
    const request=JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.model).toBe(model);expect(request.messages[1].content[1].image_url.detail).toBe('high');
    expect(request[model.startsWith('gpt-5')?'max_completion_tokens':'max_tokens']).toBe(700);
  });
  it('empty provider completion reports model and finish reason without image or credentials',async()=>{
    const service=new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:'mock-key',openaiModel:'gpt-5-mini'})} as never);
    const warning=jest.spyOn((service as any).logger,'warn').mockImplementation(()=>undefined);
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:''}}]})});
    expect(await service.analyzeOrderImage(input)).toMatchObject({kind:'unclear',textForBot:''});
    expect(warning).toHaveBeenCalledWith('Vision empty response: model=gpt-5-mini finish=length');
    expect(warning.mock.calls.flat().join(' ')).not.toMatch(/mock-key|synthetic-image|Bowl/);
  });
  it('missing API key asks for text without attempting a request',async()=>{
    const service=new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:''})} as never);const fetchMock=jest.fn();global.fetch=fetchMock;
    expect(await service.analyzeOrderImage(input)).toMatchObject({kind:'unclear',textForBot:''});expect(fetchMock).not.toHaveBeenCalled();
  });
});
