import { WhatsappMetaService } from './whatsapp-meta.service';

describe('Media download completeness and deadline — offline',()=>{
  const originalFetch=global.fetch;
  const make=()=>new WhatsappMetaService({getEffectiveConfig:async()=>({accessToken:'mock-token'})} as never);
  afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
  it('metadata and binary share a deadline and preserve MIME and bytes',async()=>{
    const bytes=new Uint8Array([1,2,3]);
    const fetchMock=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({url:'https://media.example.invalid/mock',mime_type:'audio/ogg; codecs=opus'})}).mockResolvedValueOnce({ok:true,arrayBuffer:async()=>bytes.buffer});global.fetch=fetchMock;
    expect(await make().downloadMedia('mock-media')).toEqual({buffer:Buffer.from(bytes),mimeType:'audio/ogg; codecs=opus'});
    const signal=fetchMock.mock.calls[0][1].signal;expect(signal).toBeInstanceOf(AbortSignal);expect(fetchMock.mock.calls[1][1].signal).toBe(signal);
  });
  it('empty download is rejected before transcription or vision',async()=>{
    global.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({url:'https://media.example.invalid/mock'})}).mockResolvedValueOnce({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});
    await expect(make().downloadMedia('mock-empty')).rejects.toThrow(/vacío/i);
  });
  it('missing download URL never performs a second request',async()=>{
    const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({})});global.fetch=fetchMock;
    await expect(make().downloadMedia('mock-url')).rejects.toThrow(/sin URL/i);expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
