import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import type { AiOrderAction } from './types/whatsapp-session.types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseQtyDishCorrection } from './whatsapp-session-intents';

// Real catalog adapter and supplied menu; isolate only model/DB/transports.
const products = JSON.parse(readFileSync(join(__dirname, '../../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));
const catalog = new WhatsappCatalogService({} as never);
const agent = new WhatsappAgentService({} as never, catalog);
function add(text: string, id: number, attributes?: Array<{attributeName: string; attributeValue: string}>) {
  const actions: AiOrderAction = {};
  const output = (agent as any).executeTool('add_item', {productId: id, quantity: 1, attributes}, {
    products, byId: new Map(products.map(p => [p.id, p])), actions, userMessage: text,
    cart: [], setNeedsAttr: () => {}, setLookupOrder: () => {}, setLookupDeliveryTime: () => {},
  });
  return { actions, result: JSON.parse(output) };
}

describe('Agent language boundaries with PPP menu', () => {
  it.each([
    ['Una sobrebarriga en salsa para llevar', 13],
    ['Regálame una sobrebarriga en salsa, paso a recoger', 13],
    ['1 Coca Cola de litro y medio Zero', 95],
    ['Una Coca Cola Zero de 1.5 litros', 95],
    ['Una sopa de mondongo grande sin cilantro', 45],
    ['Un ajiaco grande sin cilantro porfa', 38],
  ])('accepts fulfillment/size words without inventing a missing dish: %s', (text, id) => {
    const { result, actions } = add(String(text), Number(id));
    expect(result.ok).toBe(true);
    expect(actions.addItems?.[0]?.productId).toBe(id);
  });

  it('uses declared defaults for an executive with no explicit selection', () => {
    const {actions, result} = add('Quiero un ejecutivo con pollo frito', 22);
    expect(result.ok).toBe(true);
    expect(actions.addItems?.[0]?.attributes).toEqual([
      {attributeName:'Presa',attributeValue:'Pierna Pernil'},
      {attributeName:'Sopa',attributeValue:'Ajiaco'},
      {attributeName:'Bebida',attributeValue:'Colombiana'},
    ]);
  });

  it('keeps unsupported ingredients rejected', () => {
    const { result, actions } = add('Arroz con pollo con camarones', 23);
    expect(result.ok).toBe(false);
    expect(actions.addItems).toBeUndefined();
  });

  it('allows an explicitly requested separate soup beside an executive', () => {
    const {result} = add('Un ejecutivo frito con sopa de ajiaco y además una sopa de menudencias aparte', 20);
    expect(result.ok).toBe(true);
  });

  it('does not override one dish with another dish cooking style', () => {
    const {actions} = add('Una trucha asada y una mojarra frita', 14, [
      {attributeName:'Seleccion', attributeValue:'Frita'},
    ]);
    expect(actions.addItems?.[0]?.attributes).toEqual([
      {attributeName:'Seleccion',attributeValue:'Frita'},
    ]);
  });

  it('does not override the host arepas with the separately ordered portion', () => {
    const {actions} = add('Un pollo frito con arepas blancas y una porción adicional de arepas fritas', 1, [
      {attributeName:'Arepas',attributeValue:'Blancas'},
    ]);
    expect(actions.addItems?.[0]?.attributes).toEqual([
      {attributeName:'Arepas',attributeValue:'Blancas'},
    ]);
  });

  it.each(['1 cuarto broaster pierna pernil y arepas fritas',
    'Un cuarto frito con pierna pernil y arepas blancas',
    '3 pollos fritos con arepas blancas y 2 limonadas naturales'])('blocks included arepas without requiring the word pollo: %s', text => {
    expect(add(text, 11).result.ok).toBe(false);
  });

  it('selects the separate arepa portion own preparation', () => {
    const {actions, result} = add('Un pollo frito con arepas blancas y una porción adicional de arepas fritas', 11);
    expect(result.ok).toBe(true);
    expect(actions.addItems?.[0]?.attributes).toEqual([{attributeName:'Arepas',attributeValue:'Fritas'}]);
  });

  it.each(['2 sopas de ajiaco, 3 sopas de menudencias, una costilla de cerdo y dos arroces con pollo',
    'un pollo frito sin arepas y un arroz con pollo sin ensalada y más yuca'])('validates a dish without words from the other dishes: %s', text => {
    const ids = text.startsWith('2') ? [38,20,60,23] : [1,23];
    for (const id of ids) expect(add(text,id).result.ok).toBe(true);
  });

  it('does not list meals as drinks because they include a beverage', () => {
    const drinks = catalog.menuDrinkProducts(products);
    expect(drinks.some(p => p.id === 22 || p.id === 97)).toBe(false);
    expect(drinks.some(p => p.id === 50)).toBe(true);
  });

  it.each(['jugo en agua de mango', '2 jugos en agua de mango'])('recognizes juice without requiring the adjective natural: %s', text => {
    const drink = catalog.resolveStandaloneDrinkOrder(text, products);
    expect(drink?.product.id).toBe(50);
    expect(drink?.attributes).toEqual([{attributeName:'Sabor',attributeValue:'Mango'}]);
  });

  it('multi-order juice is not substituted by bottled water', () => {
    const resolved = catalog.resolveMultiProductOrder('1 mojarra frita, 2 jugos en agua de mango y 1 arroz paisa',products);
    expect(resolved?.confident.map(c=>c.product.id).sort((a,b)=>a-b)).toEqual([14,35,50]);
  });

  it('preserves milk from the customer message when the model abbreviates a juice search', () => {
    const result = JSON.parse((agent as any).executeTool('search_menu', {query:'jugo natural de lulo'}, {
      products, userMessage:'2 jugos naturales en leche de lulo', actions:{}, cart:[],
    }));
    expect(result.mode).toBe('drink_order');
    expect(result.product.productId ?? result.product.id).toBe(51);
    expect(result.attributes).toEqual([{attributeName:'Sabor',attributeValue:'Lulo'}]);
  });

  it('rejects an unrequested rice presentation beside four requested families', () => {
    expect(add('2 sopas de ajiaco, 3 sopas de menudencias, una costilla de cerdo y dos arroces con pollo',36).result.ok).toBe(false);
  });

  it('rejects an extra beverage already included in a combo', () => {
    const {result,actions} = add('Un combo frito sin arepas con Pepsi',28);
    expect(result.error).toBe('included_attribute_not_extra');
    expect(actions.addItems).toBeUndefined();
  });

  it.each(['Porfa manda bastante ají','Sin ensalada por favor'])('records a short kitchen note without promising an unapplied change: %s', async text => {
    const configured = new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'test',localContext:{}})} as never,catalog);
    const result = await configured.runTurn({userMessage:text,products,cart:[{productId:23,name:'Arroz Con Pollo'}],
      recentMessages:[],sessionSummary:'test',businessRulesBlock:'test',brandName:'test'});
    expect(result.actions.setCustomerNotes).toBe(text);
    expect(result.actions.addItems).toBeUndefined();
  });

  it('recognizes the plural arroces and keeps its own quantity', () => {
    expect(catalog.searchByNameScored('dos arroces con pollo',products,2)[0].p.id).toBe(23);
    expect(catalog.extractQuantityFromSegment('dos arroces con pollo')).toBe(2);
  });
  it('resolves four explicit dish families without inventing ambiguity from a plural', () => {
    const resolved=catalog.resolveMultiProductOrder('Necesito 2 sopas de ajiaco, 3 sopas de menudencias, una costilla de cerdo y dos arroces con pollo',products);
    expect(resolved?.ambiguous).toEqual([]);
    expect(resolved?.confident.map(m=>m.product.id).sort((a,b)=>a-b)).toEqual([20,23,38,60]);
  });
  it.each(['mango','lulo'])('keeps each juice search scoped to its requested flavor: %s', flavor => {
    const result=JSON.parse((agent as any).executeTool('search_menu',{query:`jugo en agua de ${flavor}`},{
      products,userMessage:'Un jugo en agua de mango y otro jugo en agua de lulo',actions:{},cart:[],
    }));
    expect(result.mode).toBe('drink_order');
    expect(result.attributes[0].attributeValue.toLowerCase()).toBe(flavor);
  });
  it('retries a model claim that a search added products until an actual add action exists',async()=> {
    const response=(message:any)=>({ok:true,json:async()=>({choices:[{message}]})}) as Response;
    const call=(name:string,args:unknown)=>({role:'assistant',content:null,tool_calls:[{
      id:'test-'+name,type:'function',function:{name,arguments:JSON.stringify(args)},
    }]});
    const fetchMock=jest.spyOn(global,'fetch')
      .mockResolvedValueOnce(response(call('search_menu',{query:'arroz con pollo'})))
      .mockResolvedValueOnce(response({role:'assistant',content:'He agregado un arroz con pollo.'}))
      .mockResolvedValueOnce(response(call('add_item',{productId:23,quantity:1})))
      .mockResolvedValueOnce(response({role:'assistant',content:'Listo, un arroz con pollo.'}));
    try {
      const configured=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'test',localContext:{}})} as never,catalog);
      const result=await configured.runTurn({userMessage:'Quiero un arroz con pollo',products,cart:[],recentMessages:[],
        sessionSummary:'test',businessRulesBlock:'test',brandName:'test'});
      expect(result.actions.addItems).toEqual([{productId:23,quantity:1,note:undefined,attributes:undefined}]);
      expect(result.error).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {fetchMock.mockRestore();}
  });

  it('parses a correction with and without de, excluding the total', () => {
    expect(parseQtyDishCorrection('No son pollos, son 4 sopas: 2 ajiaco y 2 de menudencias')).toEqual([
      {qty:2,dish:'ajiaco'},{qty:2,dish:'menudencias'},
    ]);
    expect(parseQtyDishCorrection('No son 5 sopas: 2 ajiaco y 2 de menudencias')).toBeNull();
  });

  it('corrects soups while preserving an explicitly retained existing drink', async () => {
    const configured = new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'test',localContext:{}})} as never,catalog);
    const result = await configured.runTurn({
      userMessage:'No son pollos, son 4 sopas: 2 ajiaco y 2 de menudencias; deja la limonada',
      products,cart:[{productId:1,name:'1 Pollo Frito'},{productId:37,name:'Limonada Natural'}],
      recentMessages:[],sessionSummary:'test',businessRulesBlock:'test',brandName:'test',
    });
    expect(result.actions.clearCart).toBeUndefined();
    expect(result.actions.removeProductIds).toEqual([1]);
    expect(result.actions.addItems).toEqual([{productId:38,quantity:2},{productId:20,quantity:2}]);
  });
});
