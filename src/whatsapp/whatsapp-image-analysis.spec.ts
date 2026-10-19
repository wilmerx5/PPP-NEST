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

describe('Image extraction completeness and latency — offline',()=>{
  const originalFetch=global.fetch;
  const input={buffer:Buffer.from('mock-image'),mimeType:'image/png',menuSummary:'Synthetic menu'};
  const make=(model='gpt-4.1-2025-04-14')=>new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:'mock-key',openaiModel:model})} as never);
  const reply=(data:unknown,finish='stop')=>jest.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:finish,message:{content:JSON.stringify(data)}}]})});
  afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
  it('keeps every selected product after character 500',async()=>{
    const text=Array.from({length:18},(_,i)=>`Dos bowls variante ${i+1} sin cebolla y con salsa aparte`).join('\n');
    global.fetch=reply({kind:'order',textForBot:text});expect((await make().analyzeOrderImage(input)).textForBot).toBe(text);
  });
  it('does not execute a partial order when the provider hits its token limit',async()=>{
    global.fetch=reply({kind:'order',textForBot:'Un bowl mediterraneo'},'length');
    expect(await make().analyzeOrderImage(input)).toMatchObject({kind:'unclear',textForBot:''});
  });
  it('empty image never calls the provider',async()=>{
    const fetchMock=reply({kind:'order',textForBot:'Un bowl'});global.fetch=fetchMock;
    expect(await make().analyzeOrderImage({...input,buffer:Buffer.alloc(0)})).toMatchObject({kind:'unclear',textForBot:''});expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['gpt-5','gpt-5-mini','gpt-5-nano'])('uses minimal extraction reasoning and the existing cap for %s',async model=>{
    const fetchMock=reply({kind:'order',textForBot:'Dos bowls'});global.fetch=fetchMock;await make(model).analyzeOrderImage(input);
    const body=JSON.parse(fetchMock.mock.calls[0][1].body);expect(body.reasoning_effort).toBe('minimal');expect(body.max_completion_tokens).toBe(700);
  });
  it.each(['gpt-4.1-2025-04-14','gpt-5.1'])('does not send unsupported minimal reasoning to %s',async model=>{
    const fetchMock=reply({kind:'order',textForBot:'Dos bowls'});global.fetch=fetchMock;await make(model).analyzeOrderImage(input);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reasoning_effort).toBeUndefined();
  });
  it('a stalled image request has a deadline and preserves a safe result',async()=>{
    const service=make();jest.spyOn((service as any).logger,'error').mockImplementation(()=>undefined);
    const fetchMock=jest.fn().mockRejectedValue(new Error('fixture aborted'));global.fetch=fetchMock;
    expect(await service.analyzeOrderImage(input)).toMatchObject({kind:'unclear',textForBot:''});
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe('Independent vision model selection',()=>{
 const fetchBefore=global.fetch;const modelBefore=process.env.WHATSAPP_VISION_MODEL;
 afterEach(()=>{global.fetch=fetchBefore;if(modelBefore===undefined)delete process.env.WHATSAPP_VISION_MODEL;else process.env.WHATSAPP_VISION_MODEL=modelBefore;});
 it('uses Luna with no reasoning, JSON and the explicit existing cap, leaving other workloads alone',async()=>{
  process.env.WHATSAPP_VISION_MODEL='gpt-6-luna';
  const mock=jest.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({kind:'order',textForBot:'Dos ramen de miso'})}}]})});global.fetch=mock;
  const service=new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:'offline',openaiModel:'gpt-4.1-2025-04-14'})} as never);
  expect(await service.analyzeOrderImage({buffer:Buffer.from('fixture'),mimeType:'image/png',menuSummary:'Ramen de miso'})).toMatchObject({kind:'order',textForBot:'Dos ramen de miso'});
  const body=JSON.parse(mock.mock.calls[0][1].body);expect(body).toMatchObject({model:'gpt-6-luna',reasoning_effort:'none',max_completion_tokens:700,response_format:{type:'json_object'}});
  expect(body).not.toHaveProperty('max_tokens');expect(body).not.toHaveProperty('temperature');
 });
});

describe('Address image provider contract — offline',()=>{
 const previousFetch=global.fetch;
 afterEach(()=>{global.fetch=previousFetch;});
 it.each([false,true])('preserves a distinct address result including internal access, retry=%s',async ocrRetry=>{
  const text='Calle 10 #81A-20; Conjunto Los Olivos torre B apartamento 304B';
  const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({kind:'address',textForBot:text,visibleText:text})}}]})});global.fetch=fetchMock;
  const service=new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:'offline',openaiModel:'gpt-6-luna'})} as never);
  expect(await service.analyzeOrderImage({buffer:Buffer.from('fixture'),mimeType:'image/png',menuSummary:'Ramen',ocrRetry})).toMatchObject({kind:'address',textForBot:text});
  const prompt=JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content;expect(prompt).toContain('kind=address');expect(prompt).toMatch(/coordenadas/);expect(prompt).toMatch(/varios destinos/);
 });
});
