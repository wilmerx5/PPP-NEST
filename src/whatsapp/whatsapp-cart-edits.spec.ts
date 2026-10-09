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
  return {productId:id,name:product.name,unitPrice:product.price,quantity,note,
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
  const guarded=new WhatsappActionGuardService(catalog).sanitize({actions,products,businessOpen:true,allowMercadoPago:false});
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

});
