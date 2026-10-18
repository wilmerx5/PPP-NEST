import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveCartLineIndex } from './whatsapp-cart-edits';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import type { AiOrderAction } from './types/whatsapp-session.types';
const products = JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-beta-menu.json'),'utf8'));
const catalog = new WhatsappCatalogService({} as never);
const agent = new WhatsappAgentService({} as never,catalog) as any;
const line = (id: number, quantity = 1, value?: string, note?: string) => {
  const product=products.find(p=>p.id===id);
  return {productId:id,code:product.code,name:product.name,unitPrice:product.price,quantity,note,
    attributes:catalog.fillDefaultAttributes(product,value ? [{attributeName:product.attributes[0].attributeName,attributeValue:value}] : [])};
};
function tool(name: string,args: object,cart: any[],userMessage = '') {
  const actions: AiOrderAction = {};
  const result=JSON.parse(agent.executeTool(name,args,{actions,cart,userMessage,products,
    byId:new Map(products.map(p=>[p.id,p])),setNeedsAttr:()=>{}}));
  return {actions,result};
}
async function apply(actions: AiOrderAction,cart: any[]) {
  const service=Object.create(WhatsappOrchestratorService.prototype) as any;
  service.catalogService=catalog;
  const guarded=new WhatsappActionGuardService(catalog).sanitize({actions,products,cart,businessOpen:true,allowMercadoPago:false});
  return (await service.applyActions({}, {cart,orderType:'pickup'}, guarded.actions,products,{})).session.cart;
}
function turnTools(cart:any[],userMessage='') {
  const actions:AiOrderAction={};
  const ctx={actions,cart,userMessage,products,byId:new Map(products.map(p=>[p.id,p])),setNeedsAttr:()=>{}};
  return {actions,call:(name:string,args:object={})=>JSON.parse(agent.executeTool(name,args,ctx))};
}
describe('Cart edits preserve the other variants and use stable indexes',()=>{
  it('refuses an ambiguous SKU instead of changing the last line',()=>{
    const cart=[line(50,2,'Mango'),line(50,1,'Lulo')];
    expect(resolveCartLineIndex(cart,50)).toBe(-1);
    const output=tool('set_attribute',{productId:50,attributeName:'Sabor',attributeValue:'Guanabana'},cart);
    expect(output.result.ok).toBe(false);expect(output.actions).toEqual({});
  });
  it.each([-1,1.5,99,'0'])('rejects invalid index %s',index=>{
    expect(tool('remove_item',{productId:50,cartLineIndex:index},[line(50)]).result.ok).toBe(false);
  });
  it('refuses an index owned by a different SKU',()=>{
    expect(tool('remove_item',{productId:50,cartLineIndex:1},[line(50),line(23)]).result.ok).toBe(false);
  });
  it('removes mango while preserving lulo quantity',async()=>{
    const cart=[line(50,2,'Mango'),line(50,1,'Lulo')];
    const edited=await apply(tool('remove_item',{productId:50,cartLineIndex:0},cart).actions,cart);
    expect(edited).toEqual([cart[1]]);
  });
  it('changes the first flavor without changing the second',async()=>{
    const cart=[line(50,2,'Mango'),line(50,1,'Lulo')];
    const edited=await apply(tool('set_attribute',{productId:50,cartLineIndex:0,attributeName:'Sabor',attributeValue:'Guanabana'},cart).actions,cart);
    expect(edited[0].quantity).toBe(2);expect(edited[0].attributes[0].attributeValue).toBe('Guanabana');
    expect(edited[1]).toEqual(cart[1]);expect(cart[0].attributes[0].attributeValue).toBe('Mango');
  });
  it('merges identical variants after a flavor change preserving all units',async()=>{
    const cart=[line(50,2,'Mango'),line(50,1,'Lulo')];
    const edited=await apply(tool('set_attribute',{productId:50,cartLineIndex:1,attributeName:'Sabor',attributeValue:'Mango'},cart).actions,cart);
    expect(edited).toHaveLength(1);expect(edited[0].quantity).toBe(3);
  });
  it('keeps indices stable when removing an earlier line and editing another',async()=>{
    const cart=[line(50,2,'Mango'),line(50,1,'Lulo'),line(23,4)];
    const edited=await apply({removeCartLines:[{productId:50,cartLineIndex:0}],
      updateCartLines:[{productId:23,cartLineIndex:2,quantity:2,note:'sin ensalada'}]},cart);
    expect(edited.map(c=>[c.productId,c.quantity,c.note])).toEqual([[50,1,undefined],[23,2,'sin ensalada']]);
  });
  it('adds a note only to the selected rice line',async()=>{
    const cart=[line(23,1,undefined,'sin ensalada'),line(23)];
    const edited=await apply(tool('update_item',{productId:23,cartLineIndex:0,note:'sin ensalada, sin cilantro'},cart).actions,cart);
    expect(edited[0].note).toBe('sin ensalada, sin cilantro');expect(edited[1].note).toBeUndefined();
  });
  it('clears the second note preserving the first line',async()=>{
    const cart=[line(23,1,undefined,'sin ensalada'),line(23,1,undefined,'sin cilantro')];
    const edited=await apply(tool('update_item',{productId:23,cartLineIndex:1,note:''},cart).actions,cart);
    expect(edited[0]).toEqual(cart[0]);expect(edited[1].note).toBeUndefined();
  });
  it('changes quantity absolutely while retaining options and note',async()=>{
    const cart=[line(50,4,'Lulo','sin hielo'),line(23)];
    const edited=await apply(tool('update_item',{productId:50,quantity:2},cart).actions,cart);
    expect(edited[0]).toEqual({...cart[0],quantity:2});expect(edited[1]).toEqual(cart[1]);
  });
  it('returns no action for a choice already selected',()=>{
    const output=tool('set_attribute',{productId:50,attributeName:'Sabor',attributeValue:'Lulo'},[line(50,1,'Lulo')]);
    expect(output.result.unchanged).toBe(true);expect(output.actions).toEqual({});
  });
  it('rejects a milk base invented as part of an existing flavor',()=>{
    const output=tool('set_attribute',{productId:50,attributeName:'Sabor',attributeValue:'Lulo en Leche'},[line(50,1,'Lulo')]);
    expect(output.result.ok).toBe(false);expect(output.actions).toEqual({});
  });
  it('does not remove the original line when replacement validation fails',()=>{
    const output=tool('replace_item',{productId:50,newProductId:9999},[line(50,1,'Lulo')]);
    expect(output.result.ok).toBe(false);expect(output.actions).toEqual({});
  });
  it('rejects the plain chicken SKU when the customer requested executives',()=>{
    const output=tool('add_item',{productId:1,quantity:2},[],'Bueno, regálame dos ejecutivos con pollo frito');
    expect(output.result.ok).toBe(false);expect(output.actions).toEqual({});
  });
  it('lets a replacement receive its own note in the same turn',async()=>{
    const cart=[line(25),line(37,2)];
    const turn=turnTools(cart,'Cambia la pechuga a la plancha por un churrasco sin ensalada. Deja las dos limonadas');
    const replacement=turn.call('replace_item',{productId:25,cartLineIndex:0,newProductId:17});
    expect(replacement.ok).toBe(true);
    expect(turn.call('get_cart').lines.map(l=>l.productId)).toEqual([37,17]);
    expect(turn.call('update_item',{productId:17,cartLineIndex:replacement.newLine.cartLineIndex,note:'sin ensalada'}).ok).toBe(true);
    const edited=await apply(turn.actions,cart);
    expect(edited.find(l=>l.productId===17).note).toBe('sin ensalada');
    expect(edited.find(l=>l.productId===37)).toEqual(cart[1]);
  });
  it('accepts a replacement note directly and retains it through guard and application',async()=>{
    const cart=[line(25,2,undefined,'sin cilantro')];const turn=turnTools(cart,'Cambia la pechuga por churrasco sin ensalada');
    expect(turn.call('replace_item',{productId:25,newProductId:17,note:'sin cilantro, sin ensalada'}).ok).toBe(true);
    const edited=await apply(turn.actions,cart);
    expect(edited).toHaveLength(1);expect(edited[0].quantity).toBe(2);expect(edited[0].note).toBe('sin cilantro, sin ensalada');
  });
  it('edits a newly queued item rather than adding a duplicate',async()=>{
    const turn=turnTools([],'Un arroz con pollo sin ensalada');
    expect(turn.call('add_item',{productId:23}).ok).toBe(true);
    const added=turn.call('get_cart').lines[0];
    expect(turn.call('update_item',{productId:23,cartLineIndex:added.cartLineIndex,quantity:2,note:'sin ensalada'}).ok).toBe(true);
    const edited=await apply(turn.actions,[]);
    expect(edited).toHaveLength(1);expect(edited[0].quantity).toBe(2);expect(edited[0].note).toBe('sin ensalada');
  });
  it('changes attributes on a newly queued item',async()=>{
    const turn=turnTools([],'Un jugo en agua de mango');turn.call('add_item',{productId:50});
    const added=turn.call('get_cart').lines[0];
    expect(turn.call('set_attribute',{productId:50,cartLineIndex:added.cartLineIndex,attributeName:'Sabor',attributeValue:'Lulo'}).ok).toBe(true);
    expect((await apply(turn.actions,[]))[0].attributes[0].attributeValue).toBe('Lulo');
  });
  it('keeps new line identifiers stable after removing another queued item',async()=>{
    const turn=turnTools([],'Un arroz con pollo y una limonada');
    turn.call('add_item',{productId:23});turn.call('add_item',{productId:37});
    const [rice,drink]=turn.call('get_cart').lines;
    turn.call('remove_item',{productId:23,cartLineIndex:rice.cartLineIndex});
    expect(turn.call('get_cart').lines[0].cartLineIndex).toBe(drink.cartLineIndex);
    expect(turn.call('update_item',{productId:37,cartLineIndex:drink.cartLineIndex,quantity:2}).ok).toBe(true);
    const edited=await apply(turn.actions,[]);expect(edited).toHaveLength(1);expect(edited[0].productId).toBe(37);expect(edited[0].quantity).toBe(2);
  });
  it('shows queued changes and allows reverting an attribute to its original choice',async()=>{
    const cart=[line(50,1,'Mango')];const turn=turnTools(cart);
    turn.call('set_attribute',{productId:50,attributeName:'Sabor',attributeValue:'Lulo'});
    expect(turn.call('get_cart').lines[0].attributes[0].attributeValue).toBe('Lulo');
    turn.call('set_attribute',{productId:50,attributeName:'Sabor',attributeValue:'Mango'});
    expect((await apply(turn.actions,cart))[0].attributes[0].attributeValue).toBe('Mango');
  });

  it.each([
    [{maxUnitsPerItem:3},'max_units_item'],
    [{maxTotalUnits:3},'max_total_units'],
    [{maxOrderAmount:90000},'max_amount'],
  ])('does not bypass configured limits through a quantity edit: %j',async(cfg,kind)=>{
    const service=Object.create(WhatsappOrchestratorService.prototype) as any;service.catalogService=catalog;
    const session={cart:[line(23,2)],orderType:'pickup'};
    const output=await service.applyActions({},session,{updateCartLines:[{productId:23,cartLineIndex:0,quantity:4}]},products,cfg);
    expect(output.limitBlocked.kind).toBe(kind);expect(output.session).toEqual(session);expect(session.cart[0].quantity).toBe(2);
  });
  it('allows reducing quantity without discarding notes or options',async()=>{
    const service=Object.create(WhatsappOrchestratorService.prototype) as any;service.catalogService=catalog;
    const session={cart:[line(50,4,'Lulo','sin hielo')],orderType:'pickup'};
    const output=await service.applyActions({},session,{updateCartLines:[{productId:50,cartLineIndex:0,quantity:2}]},products,{maxUnitsPerItem:3});
    expect(output.limitBlocked).toBeUndefined();expect(output.session.cart[0]).toEqual({...session.cart[0],quantity:2});
  });
  it('does not silently lose units when identical variants merge above thirty',async()=>{
    const cart=[line(50,16,'Mango'),line(50,16,'Lulo')];
    const edited=await apply(tool('set_attribute',{productId:50,cartLineIndex:1,attributeName:'Sabor',attributeValue:'Mango'},cart).actions,cart);
    expect(edited).toHaveLength(1);expect(edited[0].quantity).toBe(32);
  });

  it('treats each exact cooking option as an attribute when the model put it in note',async()=>{
    const turn=turnTools([],'Una trucha asada y otra trucha frita');
    turn.call('add_item',{productId:12,quantity:1,note:'Asada'});
    turn.call('add_item',{productId:12,quantity:1,note:'Frita'});
    const edited=await apply(turn.actions,[]);
    expect(edited).toHaveLength(2);
    expect(edited.map(l=>l.attributes[0].attributeValue).sort()).toEqual(['Asada','Frita']);
    expect(edited.every(l=>!l.note)).toBe(true);
  });

  it('refuses removing a flavor the customer explicitly asked to preserve',async()=>{
    const cart=[line(50,2,'Mango'),line(50,1,'Lulo')];
    const turn=turnTools(cart,'Quita los dos jugos de mango, deja solamente el de lulo');
    expect(turn.call('remove_item',{productId:50,cartLineIndex:0}).ok).toBe(true);
    expect(turn.call('remove_item',{productId:50,cartLineIndex:1}).error).toBe('customer_requested_preserve_line');
    expect(await apply(turn.actions,cart)).toEqual([cart[1]]);
  });
  it('rejects a bottled-drink SKU whose catalog options exclude the requested brand',()=>{
    const turn=turnTools([],'Quita el jugo de mango y agrega una gaseosa de 400 ml Pepsi');
    expect(turn.call('add_item',{productId:34}).error).toBe('requested_option_not_in_this_sku');
    expect(turn.actions).toEqual({});
  });
  it('changes a same-SKU replacement as attributes without removing other variants',async()=>{
    const cart=[line(12,1,'Asada'),line(12,1,'Frita')];const turn=turnTools(cart,'La trucha asada cámbiala a apanada. La frita déjala frita');
    expect(turn.call('replace_item',{productId:12,cartLineIndex:0,newProductId:12,attributes:[{attributeName:'Seleccion',attributeValue:'Apanada'}]}).ok).toBe(true);
    const edited=await apply(turn.actions,cart);
    expect(edited[0].attributes[0].attributeValue).toBe('Apanada');expect(edited[1]).toEqual(cart[1]);
    expect(turn.actions.addItems).toBeUndefined();expect(turn.actions.removeCartLines).toBeUndefined();
  });
  it('allows removing a cart product that was retired from the current catalog',async()=>{
    const cart=[{productId:9999,name:'Producto retirado',unitPrice:10000,quantity:1},line(23)];const turn=turnTools(cart,'Quita el producto retirado');
    expect(turn.call('remove_item',{productId:9999,cartLineIndex:0}).ok).toBe(true);
    expect(await apply(turn.actions,cart)).toEqual([cart[1]]);
  });

  it('removes rice while preserving the explicitly named meat and drink',async()=>{
    const cart=[line(23,2),line(17),line(37)];const turn=turnTools(cart,'Quita los dos arroces con pollo; deja el churrasco y la limonada');
    expect(turn.call('remove_item',{productId:23,cartLineIndex:0}).ok).toBe(true);
    expect(turn.call('remove_item',{productId:17,cartLineIndex:1}).error).toBe('customer_requested_preserve_line');
    expect(turn.call('remove_item',{productId:37,cartLineIndex:2}).error).toBe('customer_requested_preserve_line');
    expect(await apply(turn.actions,cart)).toEqual(cart.slice(1));
  });
  it('does not treat conserving rice as conserving generic bottled drinks',()=>{
    const turn=turnTools([line(23),line(28),line(42)],'Quita las dos gaseosas y deja el arroz');
    expect(turn.call('remove_item',{productId:28,cartLineIndex:1}).ok).toBe(true);
    expect(turn.call('remove_item',{productId:42,cartLineIndex:2}).ok).toBe(true);
  });
  it('adds a typo in the catalog alongside an absolute correction to a different dish',async()=>{
    const turn=turnTools([line(17)],'Me faltó la milanesa de pollo y eran dos churrascos, no uno');
    expect(turn.call('update_item',{productId:17,cartLineIndex:0,quantity:2}).ok).toBe(true);
    expect(turn.call('add_item',{productId:62}).ok).toBe(true);
    expect((await apply(turn.actions,[line(17)])).map(l=>[l.productId,l.quantity])).toEqual([[17,2],[62,1]]);
  });
  it('does not interpret packaging a side as ordering an additional included drink',()=>{
    const turn=turnTools([],'Un combo de pollo frito con Coca Cola y arepas fritas. Las arepas en bolsa aparte');
    expect(turn.call('add_item',{productId:99}).ok).toBe(true);
    expect(turn.call('add_item',{productId:34}).ok).toBe(false);
    expect(turn.actions.addItems).toHaveLength(1);
  });
  it('preserves the complete compound dish instead of adding its embedded simpler combo',()=>{
    const turn=turnTools([],'Un combo de arroz chino con medio pollo frito y bebida Manzana');
    expect(turn.call('add_item',{productId:99}).error).toBe('different_composed_dish');
    expect(turn.call('add_item',{productId:97}).ok).toBe(true);
    expect(turn.actions.addItems?.map(l=>l.productId)).toEqual([97]);
  });
  it('retains an explicit scoped note when the model omits it',()=>{
    const turn=turnTools([],'Un arroz con pollo sin ensalada; una mojarra asada sin cilantro; dos limonadas naturales');
    expect(turn.call('add_item',{productId:14,attributes:[{attributeName:'Seleccion',attributeValue:'Asada'}]}).ok).toBe(true);
    expect(turn.actions.addItems?.[0].note).toMatch(/sin cilantro/i);
  });
  it('keeps selected variants when the first clause omits the SKU cooking word',async()=>{
    const service=Object.create(WhatsappOrchestratorService.prototype) as any;service.catalogService=catalog;
    const result=await service.applyActions({}, {cart:[],orderType:'pickup'}, {addItems:[
      {productId:1,quantity:2,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
      {productId:1,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]},
    ]},products,{},'Dos pollos con arepas blancas y un pollo con arepas fritas');
    expect(result.session.cart.map(l=>[l.quantity,l.attributes[0].attributeValue])).toEqual([[2,'Blancas'],[1,'Fritas']]);
  });
  it('rejects malformed model attributes without throwing or changing the cart',()=>{
    const turn=turnTools([],'Un cuarto frito ala pechuga con las arepas fritas');
    expect(turn.call('add_item',{productId:3,attributes:['Fritas','Ala pechuga']}).error).toBe('invalid_attribute_shape');
    expect(turn.actions).toEqual({});
  });
  it('preserves an explicit side substitution even when the model only sends the exclusion note',()=>{
    const turn=turnTools([],'Un arroz con pollo sin ensalada y cambia las papas por yuca');
    expect(turn.call('add_item',{productId:23,note:'sin ensalada'}).ok).toBe(true);
    expect(turn.actions.addItems?.[0].note).toMatch(/sin ensalada.*yuca/i);
  });
});


describe('Model tools — grouped changes affect only the requested units', () => {
  const args = { productId: 50, cartLineIndex: 0, affectedQuantity: 2,
    attributes: [{ attributeName: 'Sabor', attributeValue: 'Lulo' }] };
  it('passes tool, guard and application while preserving the other units and original price', async () => {
    const cart = [line(50, 4, 'Mango', 'sin hielo'), line(23)]; cart[0].unitPrice = 1234;
    const turn = turnTools(cart); expect(turn.call('set_unit_attributes', args).ok).toBe(true);
    const projected = turn.call('get_cart');
    expect(projected.lines.filter(item => item.productId === 50).map(item => [item.quantity, item.attributes[0].attributeValue]))
      .toEqual([[2, 'Mango'], [2, 'Lulo']]);
    expect(projected.hint).toMatch(/solo lectura/i);
    const edited = await apply(turn.actions, cart);
    expect(edited.filter(item => item.productId === 50).map(item => [item.quantity, item.unitPrice, item.note, item.attributes[0].attributeValue]))
      .toEqual([[2, 1234, 'sin hielo', 'Mango'], [2, 1234, 'sin hielo', 'Lulo']]);
    expect(edited[2]).toEqual(cart[1]); expect(cart[0].quantity).toBe(4);
  });
  it.each([0, -1, 5, 1.5, '2', null])('rejects count %s through guard without changing any unit', async affectedQuantity => {
    const cart = [line(50, 4, 'Mango')]; const turn = turnTools(cart);
    expect(turn.call('set_unit_attributes', { ...args, affectedQuantity }).ok).toBe(false);
    expect(await apply(turn.actions, cart)).toEqual(cart);
    expect(turn.call('set_attribute', { productId: 50, attributeName: 'Sabor', attributeValue: 'Lulo' }).error)
      .toBe('unit_option_turn_locked');
  });
  it.each(['update_item', 'remove_item', 'replace_item', 'add_item', 'set_attribute', 'clear_cart', 'set_address', 'set_notes'])
    ('does not let %s reinterpret projected row identifiers or expand the scope', async name => {
      const cart = [line(50, 4, 'Mango')]; const turn = turnTools(cart);
      expect(turn.call('set_unit_attributes', args).ok).toBe(true);
      const before = structuredClone(turn.actions);
      const projected = turn.call('get_cart').lines;
      expect(turn.call(name, { productId: 50, cartLineIndex: projected[1].cartLineIndex, newProductId: 51,
        quantity: 4, attributeName: 'Sabor', attributeValue: 'Lulo', address: 'Calle 12 34 56', notes: 'otra nota' }).error)
        .toBe('unit_option_turn_locked');
      expect(turn.actions).toEqual(before);
      expect((await apply(turn.actions, cart)).reduce((sum, item) => sum + item.quantity, 0)).toBe(4);
    });
  it('keeps projected identifiers stable across get_cart calls and repeated identical tool calls', async () => {
    const cart = [line(50, 4, 'Mango')]; const turn = turnTools(cart);
    turn.call('set_unit_attributes', args); const first = turn.call('get_cart');
    expect(turn.call('set_unit_attributes', args)).toMatchObject({ ok: true, unchanged: true });
    expect(turn.call('get_cart')).toEqual(first); expect(turn.actions.updateUnitOptions).toHaveLength(1);
    expect((await apply(turn.actions, cart)).map(item => item.quantity)).toEqual([2, 2]);
  });
  it('rejects all groups after an overlapping second group, not just the second', async () => {
    const cart = [line(50, 4, 'Mango')]; const turn = turnTools(cart);
    turn.call('set_unit_attributes', args);
    expect(turn.call('set_unit_attributes', { ...args, affectedQuantity: 1 }).error).toBe('overlapping_subsets');
    expect(turn.call('get_cart').lines.map(item => [item.quantity, item.attributes[0].attributeValue])).toEqual([[4, 'Mango']]);
    expect(await apply(turn.actions, cart)).toEqual(cart);
  });
  it('rejects all groups after a second group points to a synthetic projection index', async () => {
    const cart = [line(50, 4, 'Mango')]; const turn = turnTools(cart); turn.call('set_unit_attributes', args);
    const projected = turn.call('get_cart').lines[1];
    expect(turn.call('set_unit_attributes', { ...args, cartLineIndex: projected.cartLineIndex }).error).toBe('invalid_cart_line');
    expect(await apply(turn.actions, cart)).toEqual(cart);
  });
  it('prepares two original rows without treating the inserted variant as row one', async () => {
    const cart = [line(50, 4, 'Mango'), line(50, 3, 'Guanabana')]; const turn = turnTools(cart);
    expect(turn.call('set_unit_attributes', args).ok).toBe(true);
    expect(turn.call('set_unit_attributes', { ...args, cartLineIndex: 1, affectedQuantity: 1 }).ok).toBe(true);
    expect((await apply(turn.actions, cart)).map(item => [item.quantity, item.attributes[0].attributeValue]))
      .toEqual([[2, 'Mango'], [3, 'Lulo'], [2, 'Guanabana']]);
  });
  it('does not silently split a pending addition or commit the preceding purchase', async () => {
    const turn = turnTools([]); turn.call('add_item', { productId: 50, quantity: 4 });
    const pending = turn.call('get_cart').lines[0];
    expect(turn.call('set_unit_attributes', { ...args, cartLineIndex: pending.cartLineIndex }).ok).toBe(false);
    expect(await apply(turn.actions, [])).toEqual([]);
  });
  it.each([
    { addItems: [{ productId: 23, quantity: 1 }] }, { clearCart: true }, { requestConfirm: true },
    { removeProductIds: [50] }, { updateCartLines: [{ productId: 50, cartLineIndex: 0, quantity: 1 }] },
    { setAddress: 'Calle 12 34 56' },
  ])('rejects mixed actions atomically at both guard and application: %j', async extra => {
    const cart = [line(50, 4, 'Mango')]; const actions = { updateUnitOptions: [args], ...extra };
    const guarded = new WhatsappActionGuardService(catalog).sanitize({ actions, products, cart, businessOpen: true, allowMercadoPago: false });
    expect(guarded.actions).toBeUndefined(); expect(guarded.warnings.join(' ')).toMatch(/sigue igual/);
    const service = Object.create(WhatsappOrchestratorService.prototype) as any; service.catalogService = catalog;
    const session = { cart, orderType: 'pickup' };
    expect(await service.applyActions({}, session, actions, products, {})).toEqual({ session, unitOptionError: 'mixed_unit_option_actions' });
  });
  it('cannot revive a rejected group by repeating a previously valid request', async () => {
    const cart = [line(50, 4, 'Mango')]; const turn = turnTools(cart);
    turn.call('set_unit_attributes', args); turn.call('set_unit_attributes', { ...args, affectedQuantity: 1 });
    expect(turn.call('set_unit_attributes', args).error).toBe('unit_option_batch_rejected');
    expect(await apply(turn.actions, cart)).toEqual(cart);
  });
  it('canonicalizes the beverage spelling against the actual product catalog', async () => {
    const cart = [line(76, 4, 'Coca Cola', 'sin cebolla')]; const turn = turnTools(cart);
    expect(turn.call('set_unit_attributes', { productId: 76, cartLineIndex: 0, affectedQuantity: 2,
      attributes: [{ attributeName: 'Bebida', attributeValue: 'Colombiana' }] }).ok).toBe(true);
    expect((await apply(turn.actions, cart)).map(item => [item.quantity, item.attributes[0].attributeValue]))
      .toEqual([[2, 'Coca Cola'], [2, 'Colmbiana']]);
  });
  it('does not create a partition when the option is already selected', () => {
    const turn = turnTools([line(50, 4, 'Lulo')]);
    expect(turn.call('set_unit_attributes', args)).toMatchObject({ ok: true, unchanged: true });
    expect(turn.actions).toEqual({}); expect(turn.call('get_cart').lines).toHaveLength(1);
  });
  it('does not accept a grouped action without a cart snapshot in the guard', () => {
    const guarded = new WhatsappActionGuardService(catalog).sanitize({ actions: { updateUnitOptions: [args] },
      products, businessOpen: true, allowMercadoPago: false });
    expect(guarded.actions).toBeUndefined(); expect(guarded.warnings).toHaveLength(1);
  });

  it.each(['partial', 'whole'].flatMap(mode => [{ mode, sourcePrice: 1234, existingPrice: 3500 }, { mode, sourcePrice: 3500, existingPrice: 1234 }]))('preserves prices when $mode edit meets a matching variant priced $sourcePrice/$existingPrice', async ({ mode, sourcePrice, existingPrice }) => {
    const cart = [line(50, 4, 'Mango', 'sin hielo'), line(50, 2, 'Lulo', 'sin hielo')];
    cart[0].unitPrice = sourcePrice; cart[1].unitPrice = existingPrice;
    const actions = mode === 'partial'
      ? tool('set_unit_attributes', args, cart).actions
      : tool('set_attribute', { productId: 50, cartLineIndex: 0, attributeName: 'Sabor', attributeValue: 'Lulo' }, cart).actions;
    const edited = await apply(actions, cart);
    expect(edited.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)).toBe(4 * sourcePrice + 2 * existingPrice);
    expect(edited.filter(item => item.unitPrice === sourcePrice).reduce((sum, item) => sum + item.quantity, 0)).toBe(4);
    expect(edited.filter(item => item.unitPrice === existingPrice).reduce((sum, item) => sum + item.quantity, 0)).toBe(2);
    expect(edited).toHaveLength(mode === 'partial' ? 3 : 2);
  });

});
