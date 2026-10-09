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
});
