import { WhatsappAiService } from './whatsapp-ai.service';

describe('Audio transcription format and failures — offline',()=>{
  const originalFetch=global.fetch;
  const make=()=>new WhatsappAiService({getEffectiveConfig:async()=>({openaiApiKey:'mock-key'})} as never);
  afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
  it.each([
    ['audio/ogg; codecs=opus','ogg'],['audio/mpeg','mp3'],['audio/mp4','m4a'],['audio/flac','flac'],['audio/webm','webm'],
  ])('keeps format and exact Spanish transcript for %s',async(mime,ext)=>{
    const transcript='Me hace el favor, dos bowls con harto ají, sin cebolla. Para la calle 7 #20-30.';
    const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({text:transcript})});global.fetch=fetchMock;
    expect(await make().transcribeAudio(Buffer.from('mock-audio'),mime)).toBe(transcript);
    const form=fetchMock.mock.calls[0][1].body as FormData;expect((form.get('file') as File).name).toBe(`audio.${ext}`);
    expect(form.get('language')).toBe('es');expect(form.get('model')).toBe('whisper-1');
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
