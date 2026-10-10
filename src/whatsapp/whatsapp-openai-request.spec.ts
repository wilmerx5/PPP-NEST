import { requestWhatsappInference } from './whatsapp-openai-request';
const rejected = (code: string, status=429, after?:string) => new Response(JSON.stringify({error:{code}}),
  {status,headers:after===undefined?{}:{'retry-after':after}});
describe('Bounded inference retries',()=> {
  it('respects Retry-After and retries the identical inference body only',async()=> {
    const fetcher=jest.fn().mockResolvedValueOnce(rejected('rate_limit_exceeded',429,'0.2')).mockResolvedValue(new Response('{}'));
    const wait=jest.fn().mockResolvedValue(undefined);
    const body=JSON.stringify({messages:[{role:'tool',content:'already added'}]});
    expect((await requestWhatsappInference(body,'synthetic',{fetcher,wait,random:()=>0})).ok).toBe(true);
    expect(wait).toHaveBeenCalledWith(200);expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(c=>c[1].body)).toEqual([body,body]);
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it.each(['insufficient_quota','credit_balance_exhausted','unknown'])('does not retry %s',async code=> {
    const response=rejected(code);const fetcher=jest.fn().mockResolvedValue(response);
    expect(await requestWhatsappInference('{}','synthetic',{fetcher})).toBe(response);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(await response.json()).toEqual({error:{code}});
  });
  it('stops after two retries and preserves the final provider error',async()=> {
    const fetcher=jest.fn().mockImplementation(()=>Promise.resolve(rejected('slow_down')));
    const wait=jest.fn().mockResolvedValue(undefined);
    const response=await requestWhatsappInference('{}','synthetic',{fetcher,wait,random:()=>0});
    expect(response.status).toBe(429);expect(fetcher).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map(c=>c[0])).toEqual([250,500]);
  });
  it('defers long server delays instead of retrying earlier',async()=> {
    const response=rejected('rate_limit_exceeded',429,'30');const fetcher=jest.fn().mockResolvedValue(response);
    const wait=jest.fn();expect(await requestWhatsappInference('{}','synthetic',{fetcher,wait})).toBe(response);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(wait).not.toHaveBeenCalled();
  });
  it('does not retry an unclassified error',async()=> {
    const fetcher=jest.fn().mockRejectedValue(new Error('timeout'));
    await expect(requestWhatsappInference('{}','synthetic',{fetcher})).rejects.toThrow('timeout');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retries a classified inference timeout with the identical unapplied proposal',async()=> {
    const fetcher=jest.fn().mockRejectedValueOnce(new DOMException('lost response','TimeoutError'))
      .mockResolvedValue(new Response('{}'));
    const wait=jest.fn().mockResolvedValue(undefined);const body='{"messages":[]}';
    expect((await requestWhatsappInference(body,'synthetic',{fetcher,wait,random:()=>0})).ok).toBe(true);
    expect(fetcher.mock.calls.map(c=>c[1].body)).toEqual([body,body]);expect(wait).toHaveBeenCalledWith(250);
  });
  it('does not retry an explicit cancellation',async()=> {
    const fetcher=jest.fn().mockRejectedValue(new DOMException('cancelled','AbortError'));
    await expect(requestWhatsappInference('{}','synthetic',{fetcher})).rejects.toMatchObject({name:'AbortError'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('never starts another attempt after the overall deadline',async()=> {
    let now=0;const clock=jest.spyOn(Date,'now').mockImplementation(()=>now);
    const wait=jest.fn();const fetcher=jest.fn().mockImplementation(async()=>{
      now=20000;throw new DOMException('expired','TimeoutError');
    });
    try {
      await expect(requestWhatsappInference('{}','synthetic',{fetcher,wait,timeoutMs:20000})).rejects.toMatchObject({name:'TimeoutError'});
      expect(fetcher).toHaveBeenCalledTimes(1);expect(wait).not.toHaveBeenCalled();
    } finally {clock.mockRestore();}
  });
  it('limits timeouts to the same three-attempt budget as HTTP retries',async()=> {
    const fetcher=jest.fn().mockRejectedValue(new DOMException('slow','TimeoutError'));
    const wait=jest.fn().mockResolvedValue(undefined);
    await expect(requestWhatsappInference('{}','synthetic',{fetcher,wait,random:()=>0})).rejects.toMatchObject({name:'TimeoutError'});
    expect(fetcher).toHaveBeenCalledTimes(3);expect(wait.mock.calls.map(c=>c[0])).toEqual([250,500]);
  });
  it('holds the entire response body before exposing it to cart tools',async()=> {
    const partial=new Response('{');const incomplete=new Response('{');
    jest.spyOn(incomplete,'arrayBuffer').mockRejectedValue(new DOMException('partial JSON','TimeoutError'));
    jest.spyOn(partial,'clone').mockReturnValue(incomplete);
    const fetcher=jest.fn().mockResolvedValueOnce(partial).mockResolvedValue(new Response('{"complete":true}'));
    const result=await requestWhatsappInference('{}','synthetic',{fetcher,wait:async()=>undefined,random:()=>0});
    expect(await result.json()).toEqual({complete:true});expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retries a classified overload response',async()=> {
    const fetcher=jest.fn().mockResolvedValueOnce(rejected('server_is_overloaded',503)).mockResolvedValue(new Response('{}'));
    expect((await requestWhatsappInference('{}','synthetic',{fetcher,wait:async()=>undefined,random:()=>0})).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
