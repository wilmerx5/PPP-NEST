import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { AiOrderAction, WhatsappSessionData } from './types/whatsapp-session.types';
const products = JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-beta-menu.json'),'utf8'));
const catalog = new WhatsappCatalogService({} as never);
function line(id: number, qty = 1) {
  const p = products.find(p=>p.id===id);
  return {productId:id,name:p.name,code:p.code,unitPrice:p.price,quantity:qty,attributes:[]};
}
async function apply(text: string, actions: AiOrderAction, initial: WhatsappSessionData['cart'] = []) {
  const service = Object.create(WhatsappOrchestratorService.prototype) as any;
  service.catalogService = catalog;
  const session: WhatsappSessionData = {cart:initial,orderType:'pickup'};
  // Real applyActions, quantity resolution, defaults, cart keys and limits.
  const guarded = new WhatsappActionGuardService(catalog).sanitize({actions:structuredClone(actions),products,businessOpen:true,allowMercadoPago:false});
  return (await service.applyActions({},session,guarded.actions,products,{},text)).session as WhatsappSessionData;
}
describe('Agent actions applied by the real orchestrator (no DB or transports)',()=> {
  it('does not treat the total four soups as four ajiacos',async()=> {
    const session=await apply('No son pollos, son 4 sopas: 2 ajiaco y 2 de menudencias',{
      clearCart:true,addItems:[{productId:38,quantity:2},{productId:20,quantity:2}],
    },[line(1,2)]);
    expect(session.cart.map(c=>[c.productId,c.quantity]).sort((a,b)=>a[0]-b[0])).toEqual([[20,2],[38,2]]);
  });
  it('preserves explicit executive soup and beverage through ActionGuard',async()=> {
    const session=await apply('Un ejecutivo broaster ala pechuga con mondongo y Coca Cola',{
      addItems:[{productId:18,quantity:1,attributes:[
        {attributeName:'Presa',attributeValue:'Ala, pechuga'},
        {attributeName:'Sopa',attributeValue:'Mondongo'},
        {attributeName:'Bebida',attributeValue:'Coca Cola'},
      ]}],
    });
    expect(session.cart[0]?.attributes).toEqual([
      {attributeName:'Presa',attributeValue:'Ala, pechuga'},
      {attributeName:'Sopa',attributeValue:'Mondongo'},
      {attributeName:'Bebida',attributeValue:'Coca Cola'},
    ]);
  });
  it('keeps two ordered main dishes when one has a kitchen substitution',async()=> {
    const session=await apply('un pollo frito sin arepas y un arroz con pollo sin ensalada y más yuca',{
      addItems:[{productId:1,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Sin arepas'}]},
        {productId:23,quantity:1,note:'sin ensalada y más yuca'}],
    });
    expect(session.cart.map(c=>c.productId).sort((a,b)=>a-b)).toEqual([1,23]);
    expect(session.cart.find(c=>c.productId===23)?.note).toMatch(/sin ensalada.*yuca/);
  });
  it('keeps each separately ordered arepa preparation',async()=> {
    const session=await apply('Un pollo frito con arepas blancas y una porción adicional de arepas fritas',{
      addItems:[{productId:1,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
        {productId:11,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]}],
    });
    expect(session.cart.find(c=>c.productId===1)?.attributes?.[0].attributeValue).toBe('Blancas');
    expect(session.cart.find(c=>c.productId===11)?.attributes?.[0].attributeValue).toBe('Fritas');
  });
  it('replaces an existing SKU quantity without removing the newly added line',async()=> {
    const session=await apply('No son 3, son 2 ajiacos, deja la limonada',{
      removeProductIds:[38],addItems:[{productId:38,quantity:2}],
    },[line(38,3),line(37)]);
    expect(session.cart.map(c=>[c.productId,c.quantity]).sort((a,b)=>a[0]-b[0])).toEqual([[37,1],[38,2]]);
  });
  it('keeps different variants of the same SKU as separate lines',async()=> {
    const session=await apply('Un pollo frito con arepas blancas y otro pollo frito con arepas fritas',{
      addItems:[{productId:1,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
        {productId:1,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]}],
    });
    expect(session.cart).toHaveLength(2);
    expect(session.cart.map(c=>c.attributes?.[0].attributeValue).sort()).toEqual(['Blancas','Fritas']);
  });
  it('keeps per-dish kitchen notes separate',async()=> {
    const session=await apply('Una mojarra asada sin ensalada y un arroz con pollo sin cilantro',{
      addItems:[{productId:14,quantity:1,note:'sin ensalada',attributes:[{attributeName:'Seleccion',attributeValue:'Asada'}]},
        {productId:23,quantity:1,note:'sin cilantro'}],
    });
    expect(session.cart.find(c=>c.productId===14)?.note).toBe('sin ensalada');
    expect(session.cart.find(c=>c.productId===23)?.note).toBe('sin cilantro');
  });
  it('keeps independent quantities when the same SKU has two preparations',async()=> {
    const session=await apply('Dos pollos fritos con arepas blancas y un pollo frito con arepas fritas',{
      addItems:[{productId:1,quantity:2,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
        {productId:1,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]}],
    });
    expect(session.cart.find(c=>c.attributes?.[0].attributeValue==='Blancas')?.quantity).toBe(2);
    expect(session.cart.find(c=>c.attributes?.[0].attributeValue==='Fritas')?.quantity).toBe(1);
  });
  it('uses quantities written beside each menu code',async()=> {
    const session=await apply('2 #20, 2 #38 y 1 #23 porfa',{
      addItems:[{productId:20,quantity:2},{productId:38,quantity:2},{productId:23,quantity:1}],
    });
    expect(session.cart.map(c=>[c.productId,c.quantity]).sort((a,b)=>a[0]-b[0])).toEqual([[20,2],[23,1],[38,2]]);
  });
  it('uses word quantities for plural soup and rice names',async()=> {
    const session=await apply('Dos ajiacos y tres arroces con pollo',{
      addItems:[{productId:38,quantity:2},{productId:23,quantity:3}],
    });
    expect(session.cart.map(c=>[c.productId,c.quantity]).sort((a,b)=>a[0]-b[0])).toEqual([[23,3],[38,2]]);
  });
  it('does not multiply a single requested quantity by repeated identical model calls',async()=> {
    const session=await apply('2 arroces con pollo',{
      addItems:[{productId:23,quantity:1},{productId:23,quantity:1}],
    });
    expect(session.cart).toHaveLength(1);
    expect(session.cart[0].quantity).toBe(2);
  });
});
