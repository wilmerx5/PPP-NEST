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
  it('lists soups rather than meals that only include soup as an accompaniment', () => {
    const result = catalog.findCategoryBrowseHit('¿Qué sopas hay?', products);
    expect(result?.products.map(p=>p.id).sort((a,b)=>a-b)).toEqual([20,38,40,41,45]);
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
  it.each(['3/4','tres cuartos','término medio'])('keeps cooking metadata even when the model add tool omits the note: %s', term => {
    const ctx = context(`Quiero tres churrascos ${term}`);
    agent.executeTool('add_item',{productId:17,quantity:3},ctx);
    expect((ctx.actions as any).addItems[0]).toMatchObject({productId:17,quantity:3,note:expect.stringMatching(/término/)});
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
  it('treats bien frito and arto aji as chicken notes, not a missing dish', () => {
    const source = 'quiero dos pollos bien fritos,  con las arepas fritas y arto aji por favor';
    const chicken = products.find((item) => item.id === 1);
    expect(catalog.uncoveredDishWords(source, products)).toEqual([]);
    expect(catalog.uncoveredWordsAnchoredByProduct(source, chicken, products)).toEqual([]);
    const ctx = context(source);
    const added = JSON.parse(agent.executeTool('add_item', { productId: 1, quantity: 2 }, ctx));
    expect(added.ok).toBe(true);
    expect((ctx.actions as any).addItems[0].note).toMatch(/bien frito/i);
    expect((ctx.actions as any).addItems[0].note).toMatch(/(?:harto|arto).*aj[ií]/i);
    const wrong = context(source);
    expect(JSON.parse(agent.executeTool('add_item', { productId: 4, quantity: 2 }, wrong)).ok).toBe(false);
    expect((wrong.actions as any).addItems).toBeUndefined();
  });
});


describe('Accepted tool quantity and variant evidence',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 it('corrects a conflicting literal quantity before returning the accepted tool result',()=>{
  const ctx=context('Quiero dos bowls andinos',menu);const result=JSON.parse(agent.executeTool('add_item',{productId:501,quantity:8},ctx));
  expect(result.ok).toBe(true);expect(result.quantity).toBe(2);expect((ctx.actions as any).addItems[0].quantity).toBe(2);
 });
 it.each(['No quiero una Limonada De Hierbabuena','No agregues Limonada De Hierbabuena','Sin Limonada De Hierbabuena'])('rejects an explicitly excluded catalog product: %s',text=>{
  const ctx=context(text,menu);expect(JSON.parse(agent.executeTool('add_item',{productId:503,quantity:1},ctx)).error).toBe('explicitly_negated_product');expect((ctx.actions as any).addItems).toBeUndefined();
 });
 it('does not merge two explicit options into a default when the model omitted attributes',()=>{
  const ctx=context('Un wrap vegetariano con tahini y para Sara otro wrap vegetariano pero con yogur',menu);
  expect(JSON.parse(agent.executeTool('add_item',{productId:502,quantity:2},ctx)).error).toBe('variant_scope_required');expect((ctx.actions as any).addItems).toBeUndefined();
 });
 it.each(['Quiero un bowl andino con camarones','Un wrap vegetariano pero con camarones'])('keeps unavailable-ingredient validation despite grammar filtering: %s',text=>{
  const id=text.includes('bowl')?501:502;const ctx=context(text,menu);
  expect(JSON.parse(agent.executeTool('add_item',{productId:id,quantity:1},ctx)).error).toBe('dish_not_on_menu');expect((ctx.actions as any).addItems).toBeUndefined();
 });
});


describe('Literal quantities cannot inflate through a kitchen note',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 it.each(['sin cebolla','sin ensalada'])('retains two units when the proposed eight has note %s',note=>{
  const ctx=context('Quiero dos bowls andinos sin cebolla y sin ajo',menu);
  const result=JSON.parse(agent.executeTool('add_item',{productId:501,quantity:8,note},ctx));
  expect(result.ok).toBe(true);expect(result.quantity).toBe(2);expect((ctx.actions as any).addItems[0].quantity).toBe(2);
 });
});


describe('Unavailable reply respects the whole-message intent',()=>{
 const menu=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-alternate-menu.json'),'utf8'));
 it.each([
  'Me ayudas con el almuerzo: dos bowls andinos, un wrap vegetariano con salsa yogur y un brownie. Si no hay brownie, deja solo lo demás.',
  'Quiero dos bowls y un wrap. Si no tienen brownie, solo lo demás.',
  'Me regalas dos pollos y una sopa, si no hay postre déjalo.',
 ])('does not turn a purchase into an unavailable-category answer: %s',text=>{
  expect(catalog.isAvailabilityInquiry(text)).toBe(false);expect(catalog.unavailableAskReply(text,menu)).toBeNull();
 });
 it.each(['Tienen brownie?','Venden brownies?','Hay brownie?'])('keeps a genuine availability denial: %s',text=>{
  expect(catalog.isAvailabilityInquiry(text)).toBe(true);expect(catalog.unavailableAskReply(text,menu)||'').toMatch(/no tenemos/i);
 });
});
