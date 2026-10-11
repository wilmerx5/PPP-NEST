import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { interpretProductNote } from './whatsapp-product-intent';

const products = JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-beta-menu.json'),'utf8'));
const catalog = new WhatsappCatalogService({} as never);
const agent = new WhatsappAgentService({} as never,catalog) as any;
const context = (userMessage: string, menu=products) => ({products:menu,byId:new Map(menu.map(p=>[p.id,p])),
  actions:{},userMessage,cart:[],setNeedsAttr:()=>{}});

describe('Catalog intent contracts without paid inference', () => {
  it.each(['Que jugos naturales hay','Que jugos naturales hay?','Qué jugos naturales tienes'])
  ('keeps available products when search abbreviates the customer inquiry: %s', source => {
    for (const query of [source,'jugos naturales','jugo natural']) {
      const result=JSON.parse(agent.executeTool('search_menu',{query},context(source)));
      expect(result.missing).toBeNull();
      expect(result.results.map(p=>p.id).sort()).toEqual([50,51]);
    }
  });
  it('does not declare a known drink family unavailable when no preparation was selected', () => {
    const ctx = context('jugos naturales');
    const result = JSON.parse(agent.executeTool('search_menu', {query:'jugos naturales'}, ctx));
    expect(result.mode).not.toBe('menu_drinks');
    expect(result.results.map(p=>p.id)).toEqual(expect.arrayContaining([50,51]));
    expect(result.hint).not.toMatch(/no (?:tenemos|está)/i);
    expect((ctx.actions as any).addItems).toBeUndefined();
  });
  it.each(['arto Ahi','harto ají','bastante ají','mucho cilantro','extra salsa'])
  ('keeps the product and applies its qualified note: %s', preference => {
    const source=`Quiero un arroz con pollo con ${preference} por favor`;
    const ctx=context(source);
    expect(catalog.uncoveredDishWords(source,products)).toEqual([]);
    const result=JSON.parse(agent.executeTool('add_item',{productId:23,quantity:1},ctx));
    expect(result.ok).toBe(true);
    expect((ctx.actions as any).addItems[0].note).toMatch(/con /);
    expect((ctx.actions as any).addItems[0].productId).toBe(23);
  });
  it('does not keep a model-invented juice flavor when the customer omitted it', () => {
    const ctx = context('Dos jugos naturales en agua');
    const result = JSON.parse(agent.executeTool('add_item', {productId:50, quantity:2,
      attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]}, ctx));
    expect(result.ok).toBe(true);
    expect(result.pendingChoices).toEqual([expect.objectContaining({attributeName:'Sabor'})]);
    expect((ctx.actions as any).addItems[0]).toMatchObject({productId:50, quantity:2});
    expect((ctx.actions as any).addItems?.[0]?.attributes || []).not.toEqual(
      expect.arrayContaining([expect.objectContaining({attributeName:'Sabor'})]));
    expect(catalog.fillDefaultAttributes(products.find(p=>p.id===50), [])).toEqual([]);
  });
  it('keeps an explicit juice flavor instead of a different model suggestion', () => {
    const ctx = context('Dos jugos naturales en agua de lulo');
    agent.executeTool('add_item', {productId:50, quantity:2,
      attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]}, ctx);
    expect((ctx.actions as any).addItems[0].attributes).toEqual([{attributeName:'Sabor',attributeValue:'Lulo'}]);
  });
  it('uses catalog names for another restaurant rather than PPP-specific dishes',()=>{
    const menu=[{id:903,name:'Bowl Andino',code:903,price:18700,attributes:[],hasAttributes:false,availableNow:true}];
    const source='Quiero un Bowl Andino con bastante tahini';
    expect(interpretProductNote(source,menu)).toEqual({productId:903,productText:'Quiero un Bowl Andino',note:'con bastante tahini'});
    const ctx=context(source,menu);
    expect(JSON.parse(agent.executeTool('add_item',{productId:903,quantity:1},ctx)).ok).toBe(true);
    expect((ctx.actions as any).addItems[0].note).toBe('con bastante tahini');
  });
  it.each(['una bandeja con frijolitos','arroz con pollo con camarones','arroz con pollo con bastante ají y dos sopas'])
  ('does not hide another composition or another order as a single note: %s', source=>{
    expect(interpretProductNote(source,products)).toBeNull();
  });
  it('does not buy a product during a price inquiry that mentions a preference',()=>{
    const ctx=context('¿Cuánto cuesta arroz con pollo con bastante ají?');
    expect(JSON.parse(agent.executeTool('add_item',{productId:23},ctx)).ok).toBe(false);
    expect((ctx.actions as any).addItems).toBeUndefined();
  });
});
