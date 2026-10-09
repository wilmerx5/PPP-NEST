import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';

const products = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));
const catalog = new WhatsappCatalogService({} as never);
const agent = new WhatsappAgentService({ getEffectiveConfig: async () => ({openaiApiKey:'dummy'}) } as never, catalog);
const combo = {productId:97,name:products.find(p=>p.id===97).name,quantity:2,note:'sin ensalada',attributes:[
  {attributeName:'Pollo',attributeValue:'Frito'}, {attributeName:'Bebida',attributeValue:'Manzana'},
]};
async function apply(text: string, actions: any, cart: any[] = []) {
  const service = Object.create(WhatsappOrchestratorService.prototype) as any;
  service.catalogService = catalog;
  const guarded = new WhatsappActionGuardService(catalog).sanitize({actions,products,businessOpen:true,allowMercadoPago:false});
  return (await service.applyActions({}, {cart,orderType:'pickup'}, guarded.actions, products, {}, text)).session;
}
describe('Observed live AI regressions', () => {
  it.each(['Soy alérgico a los lácteos, ¿me garantizas un plato sin leche?',
    'Mi hijo tiene alergia al maní. Un arroz con pollo',
    'No soy alérgico, pero mi hijo tiene alergia a la leche', 'Soy celíaco'])
  ('routes explicit allergies to kitchen verification without model or cart changes: %s',async text=> {
    const fetchMock=jest.spyOn(global,'fetch');const cart=[combo];
    try {
      const result=await agent.runTurn({userMessage:text,cart,products,brandName:'PPP',recentMessages:[],
        sessionSummary:'',businessRulesBlock:''});
      expect(result.actions).toEqual({requestHuman:true});expect(result.reply).toMatch(/verificar.*cocina/);
      expect(result.reply).not.toMatch(/100% libre|garantizo que/i);expect(result.error).toBeUndefined();
      expect(cart).toEqual([combo]);expect(fetchMock).not.toHaveBeenCalled();
    } finally {fetchMock.mockRestore();}
  });
  it.each(['No soy alérgico, un arroz con pollo sin queso','Un arroz con pollo sin queso'])
  ('does not classify ordinary preferences or a negated allergy as an allergy: %s',async text=> {
    const configured=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:null,localContext:{}})} as never,catalog);
    const result=await configured.runTurn({userMessage:text,cart:[],products,brandName:'PPP',recentMessages:[],
      sessionSummary:'',businessRulesBlock:''});
    expect(result.actions.requestHuman).toBeUndefined();expect(result.error).toBe('no_openai_key');
  });
  it('does not replay an applied cart tool when the next inference times out',async()=> {
    const response=(message:any)=>new Response(JSON.stringify({choices:[{message}]}));
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValueOnce(response({role:'assistant',content:null,tool_calls:[{
      id:'test-add',type:'function',function:{name:'add_item',arguments:'{"productId":23}'},
    }]})).mockRejectedValueOnce(new DOMException('lost reply','TimeoutError'))
      .mockResolvedValueOnce(response({role:'assistant',content:'Listo, un arroz con pollo.'}));
    try {
      const result=await agent.runTurn({userMessage:'Un arroz con pollo',cart:[],products,brandName:'PPP',
        recentMessages:[],sessionSummary:'',businessRulesBlock:''});
      expect(result.error).toBeUndefined();expect(result.toolCalls).toEqual(['add_item']);
      expect(result.actions.addItems?.map(item=>[item.productId,item.quantity])).toEqual([[23,1]]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[2][1]!.body).toBe(fetchMock.mock.calls[1][1]!.body);
    } finally {fetchMock.mockRestore();}
  });
  const longOrder='Me regalas una sopa de mondongo por favor un cuarto de pollo broaster pierna pernil y unas costillas';
  it('points a rejected soup SKU to the missing soup rather than an unrelated chicken',()=> {
    const actions:any={addItems:[{productId:6},{productId:60}]};
    const result=JSON.parse((agent as any).executeTool('add_item',{productId:40},{products,
      byId:new Map(products.map(p=>[p.id,p])),actions,cart:[],userMessage:longOrder,setNeedsAttr:()=>undefined}));
    expect(result.error).toBe('different_dish_not_requested');
    expect(result.requestedProduct.id).toBe(45);
    expect(result.pendingRequestedProducts.map(p=>p.id)).toEqual([45]);
    expect(actions.addItems.map(p=>p.productId)).toEqual([6,60]);
  });
  it.each([true,false])('checks a partially applied multi-order before confirming it (model recovers: %s)',async recovers=> {
    const response=(message:any)=>({ok:true,json:async()=>({choices:[{message}]})}) as Response;
    const calls=(ids:number[])=>({role:'assistant',content:null,tool_calls:ids.map(id=>({
      id:'test-'+id,type:'function',function:{name:'add_item',arguments:JSON.stringify({productId:id})},
    }))});
    const fetchMock=jest.spyOn(global,'fetch')
      .mockResolvedValueOnce(response(calls([40,6,60])))
      .mockResolvedValueOnce(response({role:'assistant',content:'He agregado mondongo, pollo y costillas.'}));
    if(recovers)fetchMock.mockResolvedValueOnce(response(calls([45])))
      .mockResolvedValueOnce(response({role:'assistant',content:'Listo, sopa de mondongo, cuarto broaster y costillas.'}));
    else fetchMock.mockResolvedValueOnce(response({role:'assistant',content:'Listo, están todos agregados.'}));
    try {
      const result=await agent.runTurn({userMessage:longOrder,products,cart:[],brandName:'PPP',
        recentMessages:[],sessionSummary:'',businessRulesBlock:''});
      const correction=JSON.parse(fetchMock.mock.calls[2][1]!.body as string).messages;
      expect(correction.at(-1).content).toContain('Sopa De Mondongo');
      expect(correction.at(-1).content).toContain('NO se agregaron');
      expect(result.actions.addItems?.map(p=>p.productId).sort((a,b)=>a-b)).toEqual(recovers?[6,45,60]:[6,60]);
      expect(result.error).toBe(recovers?undefined:'incomplete_multi_order');
      expect(result.actions.addItems?.filter(p=>p.productId===6)).toHaveLength(1);
      if(!recovers)expect(result.reply).not.toMatch(/están todos|he agregado/i);
    } finally {fetchMock.mockRestore();}
  });
  it.each(['cuarto-presa-arepas','arroz-medio-broaster','ejecutivo-elecciones','ejecutivo-no-sku-extra',
    'ejecutivo-eleccion-parcial-y-nota','arepas-aparte-no-porcion-extra','chat-real-combo-atributo-y-empaque'])
  ('does not treat included choices or composed-dish components as missing purchases: %s',async id=> {
    const cases=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-beta-hard-conversations.json'),'utf8'));
    const scenario=cases.find(c=>c.id===id);const productId=Number(Object.keys(scenario.items)[0]);
    const response=(message:any)=>({ok:true,json:async()=>({choices:[{message}]})}) as Response;
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValueOnce(response({role:'assistant',content:null,tool_calls:[{
      id:'test-add',type:'function',function:{name:'add_item',arguments:JSON.stringify({productId})},
    }]})).mockResolvedValueOnce(response({role:'assistant',content:'Listo, agregado.'}));
    try {
      const result=await agent.runTurn({userMessage:scenario.messages[0],products,cart:[],brandName:'PPP',
        recentMessages:[],sessionSummary:'',businessRulesBlock:''});
      expect(result.error).toBeUndefined();
      expect(result.actions.addItems?.map(p=>p.productId)).toEqual([productId]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {fetchMock.mockRestore();}
  });
  it('changes two options without dropping the combo, quantity or note', async () => {
    const text = 'Mejor el pollo broaster y la bebida Pepsi';
    const result = await agent.runTurn({userMessage:text,cart:[combo],products,brandName:'PPP',sessionSummary:'',recentMessages:[],businessRulesBlock:''});
    expect(result.actions.updateAttributes).toHaveLength(2);
    expect(result.actions.addItems).toBeUndefined();
    const session = await apply(text, result.actions, [combo]);
    expect(session.cart).toHaveLength(1);
    expect(session.cart[0]).toMatchObject({productId:97,quantity:2,note:'sin ensalada'});
    expect(session.cart[0].attributes).toEqual(expect.arrayContaining([
      {attributeName:'Pollo',attributeValue:'Broaster'}, {attributeName:'Bebida',attributeValue:'Pepsi'},
    ]));
  });
  it('uses catalog-defined options for another dish as well', async () => {
    const result = await agent.runTurn({userMessage:'Mejor las arepas fritas',cart:[{productId:1,name:'1 Pollo Frito',attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]}],products,brandName:'PPP',sessionSummary:'',recentMessages:[],businessRulesBlock:''});
    expect(result.actions.updateAttributes).toEqual([{productId:1,cartLineIndex:0,attributeName:'Arepas',attributeValue:'Fritas'}]);
  });
  it('resolves a soup quantity once when the model duplicates that line in a multi-dish order', async () => {
    const session = await apply('Un ejecutivo frito y aparte dos sopas pequeñas de menudencias', {
      addItems:[{productId:22,quantity:1},{productId:40,attributes:[{attributeName:'Sopa',attributeValue:'Menudencias'}]},
        {productId:40,attributes:[{attributeName:'Sopa',attributeValue:'Menudencias'}]}],
    });
    expect(session.cart.map(c=>[c.productId,c.quantity]).sort((a,b)=>a[0]-b[0])).toEqual([[22,1],[40,2]]);
  });
  it('keeps independently requested identical dishes', async () => {
    const session = await apply('Un arroz con pollo y otro arroz con pollo', {addItems:[{productId:23,quantity:1},{productId:23,quantity:1}]});
    expect(session.cart.map(c=>[c.productId,c.quantity])).toEqual([[23,2]]);
  });
  it.each([[{productId:23,quantity:2},{productId:23,quantity:1}], [{productId:23,quantity:3}]])(
    'sums independently written quantities once regardless of how the model groups its calls', async (...addItems) => {
      const session = await apply('Dos arroces con pollo y otro arroz con pollo', {addItems});
      expect(session.cart.map(c=>[c.productId,c.quantity])).toEqual([[23,3]]);
    });
  it('preserves an omitted second kitchen preference on its own dish', () => {
    const actions: any = {};
    const result = JSON.parse((agent as any).executeTool('add_item',{productId:23,note:'sin ensalada'}, {
      products,byId:new Map(products.map(p=>[p.id,p])),actions,
      userMessage:'un pollo frito sin arepas y un arroz con pollo sin ensalada y más yuca',setNeedsAttr:()=>undefined,
    }));
    expect(result.ok).toBe(true);
    expect(actions.addItems[0].note).toBe('sin ensalada, más yuca');
    expect(actions.addItems[0].note).not.toMatch(/arepas/);
  });
  it('keeps a requested substitution through an incorrect follow-up tool edit', () => {
    const actions: any = {};
    const ctx = {products,byId:new Map(products.map(p=>[p.id,p])),actions,cart:[],
      userMessage:'Un arroz con pollo, cambia las papas por yuca pero no agregues una porción adicional',setNeedsAttr:()=>undefined};
    const call = (name:string,args:any) => JSON.parse((agent as any).executeTool(name,args,ctx));
    expect(call('add_item',{productId:23,note:'sin ensalada',attributes:[{attributeName:'Arepas',attributeValue:'Sin arepas'}]}).ok).toBe(true);
    const cart = call('get_cart',{});
    expect(call('update_item',{productId:23,cartLineIndex:cart.lines[0].cartLineIndex,note:'sin ensalada, sin papa francesa'}).ok).toBe(true);
    expect(actions.addItems).toHaveLength(1);
    expect(actions.addItems[0].note).toMatch(/cambio por yuca/i);
    expect(actions.addItems[0].note).not.toMatch(/ensalada|arepas|no agregues/i);
    expect(call('add_item',{productId:7}).error).toBe('substitution_not_separate_item');
    expect(call('search_menu',{query:'porción de yuca frita'}).mode).toBe('swap_recorded');
    expect(actions.addItems).toHaveLength(1);
  });
  it('does not add whole chickens after a misspelled request for quarters', () => {
    const actions: any = {};
    const ctx={products,byId:new Map(products.map(p=>[p.id,p])),actions,cart:[],
      userMessage:'me rgala 2 cuartos broster pierna pernil porfa',setNeedsAttr:()=>undefined};
    const call=(productId:number) => JSON.parse((agent as any).executeTool('add_item',
      {productId,quantity:2,attributes:[{attributeName:'Presa',attributeValue:'Pierna Pernil'}]},ctx));
    expect(call(6).ok).toBe(true);
    expect(call(4).error).toBe('different_presentation_not_requested');
    expect(actions.addItems.map(x=>x.productId)).toEqual([6]);
  });
  it('allows independently requested sizes of the same family', () => {
    const actions: any = {};
    const ctx={products,byId:new Map(products.map(p=>[p.id,p])),actions,cart:[],
      userMessage:'Dos cuartos de pollo broaster y un pollo broaster entero',setNeedsAttr:()=>undefined};
    expect(JSON.parse((agent as any).executeTool('add_item',{productId:6,quantity:2},ctx)).ok).toBe(true);
    expect(JSON.parse((agent as any).executeTool('add_item',{productId:4,quantity:1},ctx)).ok).toBe(true);
    expect(actions.addItems.map(x=>x.productId)).toEqual([6,4]);
  });
  it('retains a packaging sentence for the catalog attribute of its combo',()=> {
    const actions: any={};const ctx={products,byId:new Map(products.map(p=>[p.id,p])),actions,cart:[],
      userMessage:'Un combo de pollo frito con Coca Cola y arepas fritas. Las arepas en bolsa aparte',setNeedsAttr:()=>undefined};
    expect(JSON.parse((agent as any).executeTool('add_item',{productId:99,attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]},ctx)).ok).toBe(true);
    expect(actions.addItems[0].note).toMatch(/aparte/);
    expect(actions.addItems[0].attributes).toEqual(expect.arrayContaining([{attributeName:'Arepas',attributeValue:'Fritas'},
      {attributeName:'Bebida',attributeValue:'Coca Cola'}]));
  });
});
