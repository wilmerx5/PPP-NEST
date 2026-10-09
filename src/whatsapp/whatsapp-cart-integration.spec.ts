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
  it.each([
    'Quiero un churrasco sin ensalada y dos sobrebarrigas: una asada y otra en salsa.',
    'Un churrasco sin ensalada y 2 sobrebarrigas: 1 asada y 1 en salsa.',
  ])('distributes a grouped total across its named preparations: %s', async text => {
    const session = await apply(text, { addItems: [
      { productId: 17, quantity: 1, note: 'sin ensalada' },
      { productId: 13, quantity: 2, attributes: [{ attributeName: 'Seleccion', attributeValue: 'Asada' }] },
      { productId: 13, quantity: 2, attributes: [{ attributeName: 'Seleccion', attributeValue: 'En Salsa' }] },
    ] });
    expect(session.cart).toHaveLength(3);
    expect(session.cart.map(c => c.quantity)).toEqual([1, 1, 1]);
    expect(session.cart[0].note).toBe('sin ensalada');
    expect(session.cart.slice(1).map(c => c.attributes?.[0].attributeValue)).toEqual(['Asada', 'En Salsa']);
  });
  it('keeps uneven distributed quantities independent from the group total', async () => {
    const session = await apply('Tres sobrebarrigas: dos asadas y una en salsa.', { addItems: [
      { productId: 13, quantity: 3, attributes: [{ attributeName: 'Seleccion', attributeValue: 'Asada' }] },
      { productId: 13, quantity: 3, attributes: [{ attributeName: 'Seleccion', attributeValue: 'En Salsa' }] },
    ] });
    expect(session.cart.map(c => c.quantity)).toEqual([2, 1]);
  });
  it.each([
    'Tres churrascos, dos mojarras y un pollo frito con las arepas fritas',
    '3 churrascos y 2 mojarras y 1 pollo frito con arepas fritas',
    'Quiero tres churrascos, dos mojarras asadas y un pollo frito con arepas fritas',
    'Regálame 3 churrascos, 2 mojarras y un pollo frito con arepas fritas',
  ])('keeps independent 3/2/1 quantities despite a mistaken model quantity: %s', async text => {
    const session = await apply(text, { addItems: [
      { productId: 17, quantity: 3 }, { productId: 14, quantity: 3 },
      { productId: 1, quantity: 3, note: 'con las arepas fritas', attributes: [{ attributeName: 'Arepas', attributeValue: 'Fritas' }] },
    ] });
    expect(session.cart.map(c => [c.productId, c.quantity]).sort((a,b) => a[0]-b[0])).toEqual([[1,1],[14,2],[17,3]]);
    expect(session.cart.find(c => c.productId === 1)?.note).toBeUndefined();
    expect(session.cart.find(c => c.productId === 1)?.attributes).toEqual([{ attributeName: 'Arepas', attributeValue: 'Fritas' }]);
  });
  it('ignores the number of diners while honoring quantities beside written menu codes',async()=> {
    const session=await apply('Somos 3. Dame 2 del código 23 y 1 del código 60',{
      addItems:[{productId:23,quantity:2},{productId:60,quantity:1}],
    });
    expect(session.cart.map(c=>[c.productId,c.quantity]).sort((a,b)=>a[0]-b[0])).toEqual([[23,2],[60,1]]);
  });
  it('does not double a single dish order after a courtesy comma and repeated model calls',async()=> {
    const session=await apply('Bueno, regálame dos ejecutivos con pollo frito',{
      addItems:[{productId:22,quantity:2},{productId:22,quantity:1}],
    });
    expect(session.cart).toHaveLength(1);
    expect(session.cart[0].quantity).toBe(2);
  });
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
  it('reduces a soup order without interpreting the discarded units as the desired quantity',async()=> {
    const session=await apply('Deja solo un ajiaco, los otros dos no',{
      removeProductIds:[38],addItems:[{productId:38,quantity:1}],
    },[line(38,3)]);
    expect(session.cart.map(c=>[c.productId,c.quantity])).toEqual([[38,1]]);
  });
  it('replaces with the requested total rather than adding the total again',async()=> {
    const session=await apply('Que sean tres arroces con pollo en total, no tres más',{
      removeProductIds:[23],addItems:[{productId:23,quantity:3}],
    },[line(23)]);
    expect(session.cart.map(c=>[c.productId,c.quantity])).toEqual([[23,3]]);
  });
  it('takes the corrected quantity after rejecting an earlier quantity',async()=> {
    const session=await apply('No son 3 arroces con pollo, son 2',{
      removeProductIds:[23],addItems:[{productId:23,quantity:2}],
    },[line(23,3)]);
    expect(session.cart.map(c=>[c.productId,c.quantity])).toEqual([[23,2]]);
  });
  it('does not multiply each dish by the number of people',async()=> {
    const session=await apply('Somos dos: un arroz con pollo y una sobrebarriga en salsa',{
      addItems:[{productId:23,quantity:1},{productId:13,quantity:1,attributes:[{attributeName:'Seleccion',attributeValue:'En Salsa'}]}],
    });
    expect(session.cart.map(c=>[c.productId,c.quantity]).sort((a,b)=>a[0]-b[0])).toEqual([[13,1],[23,1]]);
  });
  it('keeps different executive soups on independent lines',async()=> {
    const session=await apply('Un ejecutivo frito con ajiaco y otro ejecutivo frito con menudencias',{
      addItems:[{productId:22,quantity:1,attributes:[{attributeName:'Sopa',attributeValue:'Ajiaco'}]},
        {productId:22,quantity:1,attributes:[{attributeName:'Sopa',attributeValue:'Menudencias'}]}],
    });
    expect(session.cart).toHaveLength(2);
    expect(session.cart.map(c=>c.quantity)).toEqual([1,1]);
    expect(session.cart.map(c=>c.attributes?.find(a=>a.attributeName==='Sopa')?.attributeValue).sort()).toEqual(['Ajiaco','Menudencias']);
  });
  it('keeps juice flavors and their unequal quantities independent',async()=> {
    const session=await apply('Dos jugos en agua de mango y un jugo en agua de lulo',{
      addItems:[{productId:50,quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]},
        {productId:50,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Lulo'}]}],
    });
    expect(session.cart.map(c=>[c.attributes?.[0].attributeValue,c.quantity])).toEqual([['Mango',2],['Lulo',1]]);
  });
  it('does not read cash denomination as ordered units',async()=> {
    const session=await apply('Un arroz con pollo, pago con un billete de 50 mil',{
      addItems:[{productId:23,quantity:50}],
    });
    expect(session.cart.map(c=>[c.productId,c.quantity])).toEqual([[23,1]]);
  });
  it('replaces a main dish while retaining its separately requested drink',async()=> {
    const session=await apply('En vez del arroz con pollo pon una pechuga a la plancha; deja la limonada',{
      removeProductIds:[23],addItems:[{productId:25,quantity:1}],
    },[line(23),line(37)]);
    expect(session.cart.map(c=>[c.productId,c.quantity]).sort((a,b)=>a[0]-b[0])).toEqual([[25,1],[37,1]]);
  });
});
