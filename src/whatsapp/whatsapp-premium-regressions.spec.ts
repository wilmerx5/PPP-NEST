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
});
