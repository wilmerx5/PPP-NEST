import { WhatsappMetaService } from './whatsapp-meta.service';
describe('Staging outbound isolation',()=> {
  const keys=['PPP_STAGING','WHATSAPP_STAGING_OUTBOUND_ALLOW','STAGING_WHATSAPP_PHONE_NUMBER_ID','STAGING_WHATSAPP_RECIPIENTS'];
  const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  let originalFetch:typeof fetch;let fetcher:jest.Mock;
  const settings={getEffectiveConfig:async()=>({accessToken:'synthetic',phoneNumberId:'12345'})};
  const meta=new WhatsappMetaService(settings as never);
  beforeEach(()=>{keys.forEach(key=>delete process.env[key]);originalFetch=globalThis.fetch;
    fetcher=jest.fn().mockResolvedValue(new Response('{}'));globalThis.fetch=fetcher;
    process.env.PPP_STAGING='true';});
  afterEach(()=>{globalThis.fetch=originalFetch;for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}});
  const enable=()=>Object.assign(process.env,{WHATSAPP_STAGING_OUTBOUND_ALLOW:'true',STAGING_WHATSAPP_PHONE_NUMBER_ID:'12345',STAGING_WHATSAPP_RECIPIENTS:'573001234567'});
  it('blocks text, media and upload by default before any external request',async()=> {
    await expect(meta.sendText('573001234567','test')).rejects.toThrow('outbound blocked');
    await expect(meta.sendMediaMessage({toWaId:'573001234567',mediaId:'synthetic',kind:'image'})).rejects.toThrow('outbound blocked');
    await expect(meta.uploadMedia({buffer:Buffer.from('synthetic'),mimeType:'text/plain',filename:'test.txt'})).rejects.toThrow('outbound blocked');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('blocks credentials for a different channel',async()=> {
    enable();process.env.STAGING_WHATSAPP_PHONE_NUMBER_ID='54321';
    await expect(meta.sendText('573001234567','test')).rejects.toThrow('outbound blocked');expect(fetcher).not.toHaveBeenCalled();
  });
  it('blocks unlisted recipients even on the test channel',async()=> {
    enable();await expect(meta.sendText('573009999999','test')).rejects.toThrow('outbound blocked');expect(fetcher).not.toHaveBeenCalled();
  });
  it('requires an explicit recipient list',async()=> {
    enable();process.env.STAGING_WHATSAPP_RECIPIENTS='';
    await expect(meta.sendText('573001234567','test')).rejects.toThrow('outbound blocked');expect(fetcher).not.toHaveBeenCalled();
  });
  it('allows only the declared test channel and normalized recipient',async()=> {
    enable();await meta.sendText('+57 300 123 4567','test');expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain('/12345/messages');expect(JSON.parse(fetcher.mock.calls[0][1].body).to).toBe('573001234567');
  });
  it('preserves normal behavior outside the staging profile',async()=> {
    delete process.env.PPP_STAGING;await meta.sendText('573009999999','test');expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
