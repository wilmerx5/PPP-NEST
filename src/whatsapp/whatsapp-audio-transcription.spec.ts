import { WhatsappAiService } from './whatsapp-ai.service';

describe('Audio transcription format and failures — offline',()=>{
  const originalFetch=global.fetch;
  const make=()=>new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:'mock-key'})} as never);
  afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
  it.each([
    ['audio/ogg; codecs=opus','ogg'],['audio/mpeg','mp3'],['audio/mp4','m4a'],['audio/flac','flac'],['audio/webm','webm'],['audio/wav','wav'],['audio/x-m4a','m4a'],['audio/mpga','mpga'],
  ])('keeps format and exact Spanish transcript for %s',async(mime,ext)=>{
    const transcript='Me hace el favor, dos bowls con harto ají, sin cebolla. Para la calle 7 #20-30.';
    const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({text:transcript})});global.fetch=fetchMock;
    expect(await make().transcribeAudio(Buffer.from('mock-audio'),mime)).toBe(transcript);
    const form=fetchMock.mock.calls[0][1].body as FormData;expect((form.get('file') as File).name).toBe(`audio.${ext}`);
    expect(form.get('language')).toBe('es');expect(form.get('model')).toBe('whisper-1');
  });
  it.each([null,{}, {text:null},{text:42}])('invalid provider payload never invents a transcript: %j',async payload=>{
    const service=make();jest.spyOn((service as any).logger,'error').mockImplementation(()=>undefined);
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>payload});
    expect(await service.transcribeAudio(Buffer.from('mock-audio'),'audio/ogg')).toBeNull();
  });
  it('empty audio avoids paid request',async()=>{
    const fetchMock=jest.fn();global.fetch=fetchMock;
    expect(await make().transcribeAudio(Buffer.alloc(0),'audio/ogg')).toBeNull();expect(fetchMock).not.toHaveBeenCalled();
  });
  it('silence or empty text does not become an order',async()=>{
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({text:'   '})});
    expect(await make().transcribeAudio(Buffer.from('mock-audio'),'audio/ogg')).toBeNull();
  });
  it('stalled transcription has a deadline and returns no invented text',async()=>{
    const service=make();jest.spyOn((service as any).logger,'error').mockImplementation(()=>undefined);
    const fetchMock=jest.fn().mockRejectedValue(new Error('fixture aborted'));global.fetch=fetchMock;
    expect(await service.transcribeAudio(Buffer.from('mock-audio'),'audio/ogg')).toBeNull();expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe('Audio vocabulary and model controls — offline',()=>{
 const originalFetch=global.fetch;const originalModel=process.env.WHATSAPP_AUDIO_MODEL;
 beforeEach(()=>{delete process.env.WHATSAPP_AUDIO_MODEL;});
 afterEach(()=>{global.fetch=originalFetch;if(originalModel===undefined)delete process.env.WHATSAPP_AUDIO_MODEL;else process.env.WHATSAPP_AUDIO_MODEL=originalModel;jest.restoreAllMocks();});
 const make=()=>new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:'fixture-key'})} as never);
 it('sends bounded catalog spellings without prices or instructions and preserves exact words',async()=>{
   const transcript='Dos combos de alitas, Pepsi, sin salsa. Para la calle 9.';
   const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({text:transcript})});global.fetch=fetchMock;
   expect(await make().transcribeAudio(Buffer.from('fixture'),'audio/ogg',['Alitas Broaster','Pepsi','Quinoa','16000',...Array.from({length:200},(_,i)=>'Nombre Extenso de Producto '+i)])).toBe(transcript);
   const form=fetchMock.mock.calls[0][1].body as FormData;const prompt=String(form.get('prompt'));
   expect(prompt).toContain('Alitas Broaster');expect(prompt).toContain('Pepsi');expect(prompt).not.toMatch(/16000/);expect(Buffer.byteLength(prompt,'utf8')).toBeLessThanOrEqual(200);expect(form.get('response_format')).toBe('json');
   expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it.each(['gpt-4o-mini-transcribe','gpt-4o-transcribe'])('candidate %s is explicit and never retries silently',async model=>{
   process.env.WHATSAPP_AUDIO_MODEL=model;const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({text:'Un bowl'})});global.fetch=fetchMock;
   await make().transcribeAudio(Buffer.from('fixture'),'audio/ogg');expect((fetchMock.mock.calls[0][1].body as FormData).get('model')).toBe(model);expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('unknown model avoids a paid request',async()=>{process.env.WHATSAPP_AUDIO_MODEL='typo-model';const fetchMock=jest.fn();global.fetch=fetchMock;jest.spyOn((make() as any).logger,'error').mockImplementation(()=>undefined);expect(await make().transcribeAudio(Buffer.from('fixture'),'audio/ogg')).toBeNull();expect(fetchMock).not.toHaveBeenCalled();});
 it('oversized audio avoids paid request',async()=>{const fetchMock=jest.fn();global.fetch=fetchMock;expect(await make().transcribeAudio(Buffer.alloc(25_000_001),'audio/ogg')).toBeNull();expect(fetchMock).not.toHaveBeenCalled();});
});
