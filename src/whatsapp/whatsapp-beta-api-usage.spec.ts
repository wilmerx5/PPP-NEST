import { BetaApiUsage } from '../../scripts/whatsapp-beta-api-usage';

describe('Synthetic rehearsal token accounting',()=>{
  it('sums every completion and prices cached input only once',()=>{
    const usage=new BetaApiUsage();usage.requests=2;
    for(let i=0;i<2;i++)usage.record(200,{usage:{prompt_tokens:10000,completion_tokens:1000,prompt_tokens_details:{cached_tokens:6000}}});
    const result=usage.summary('gpt-4o-mini');
    expect(result.promptTokens).toBe(20000);expect(result.cachedPromptTokens).toBe(12000);
    expect(result.completionTokens).toBe(2000);expect(result.estimatedReportedCostUsd).toBeCloseTo(0.0033,8);
    expect(result.usageComplete).toBe(true);
  });
  it('reports missing usage separately and preserves previous measured tokens',()=>{
    const usage=new BetaApiUsage();usage.record(200,{usage:{prompt_tokens:100,completion_tokens:20}});
    usage.record(200,{});usage.record(200,{usage:{prompt_tokens:10,completion_tokens:1,prompt_tokens_details:{cached_tokens:20}}});
    expect(usage.summary('gpt-4o-mini')).toMatchObject({successfulResponses:3,responsesWithUsage:1,usageComplete:false,promptTokens:100,completionTokens:20});
  });
  it('counts provider failures without inventing billed token amounts',()=>{
    const usage=new BetaApiUsage();usage.record(429,{error:{code:'credit_balance_exhausted'}});
    usage.record(429);usage.record(500);
    expect(usage.summary('gpt-4o-mini')).toMatchObject({successfulResponses:0,responsesWithUsage:0,httpErrors:{429:2,500:1},promptTokens:0});
  });
  it('does not apply GPT-4o mini prices to another model',()=>{
    const usage=new BetaApiUsage();usage.record(200,{usage:{prompt_tokens:1000,completion_tokens:100}});
    expect(usage.summary('other-model').estimatedReportedCostUsd).toBeNull();
  });
});
