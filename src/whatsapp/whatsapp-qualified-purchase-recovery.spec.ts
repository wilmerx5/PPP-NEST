import { isFailedAdditionQuestion } from './whatsapp-session-intents';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness, products } from './whatsapp-accuracy.test-support';

const source = 'Me das una milanesa de pollo con arta ensalada, un pollo frito y una sopa de ajiaco a cambio del arroz yuca, por favor';
const response = (message: unknown) => ({ok:true,json:async()=>({choices:[{message}]})});
const call = (id:number) => ({id:`add-${id}`,type:'function',function:{name:'add_item',arguments:JSON.stringify({productId:id,quantity:1})}});
const makeAgent = () => new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline',openaiModel:'gpt-4.1-2025-04-14',systemPrompt:'',localContext:{}})} as never,new WhatsappCatalogService({} as never));
const input = (text:string,menu=products) => ({userMessage:new WhatsappCatalogService({} as never).alignMenuSpelling(text,menu),sessionSummary:'Carrito vacío',recentMessages:[],businessRulesBlock:'',brandName:'Prueba',products:menu,cart:[]});
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;jest.restoreAllMocks();});

test('real purchase tools retain the three dishes and their own preparation notes',async()=>{
 globalThis.fetch=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:[call(62),call(1),call(38)]})).mockResolvedValueOnce(response({content:'Listo'}));
 const result=await makeAgent().runTurn(input(source));
 expect(result.purchaseAttempts).toEqual([62,1,38].map(productId=>({productId,accepted:true})));
 expect(result.actions.addItems?.find(i=>i.productId===62)?.note).toMatch(/ensalada/);
 expect(result.actions.addItems?.find(i=>i.productId===38)?.note).toMatch(/arroz.*yuca/);
});

describe.each([false,true])('router agent=%s',enabled=>{
 test('qualified multi dish purchase',async()=>{
  const h=harness(products,enabled);
  await h.send(source);
  expect(h.cartRows().map(i=>i.id).sort((a,b)=>a-b)).toEqual([1,38,62]);
  expect(h.cartRows().find(i=>i.id===62)?.note).toMatch(/ensalada/);
  expect(h.cartRows().find(i=>i.id===38)?.note).toMatch(/arroz.*yuca/);
 });
 test('asking why an add failed does not purchase anything',async()=>{
  const h=harness(products,enabled);
  h.conv.sessionData.cart=[{productId:1,code:1,name:'1 Pollo Frito',quantity:1,unitPrice:41000,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]}];
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.send('Porque no puedes añadir la milanesa y el ajiaco?');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(reply).not.toMatch(/Listo ✅/);
 });
});

const families = [
 ['Pasta Primavera','Crema Vegetal','ensalada','arroz','yuca'],
 ['Bowl Andino','Sopa Oriental','quinua','fideos','verduras'],
 ['Filete Dorado','Guiso Campestre','salsa','pure','patatas'],
];
const menuOf=(names:string[])=>names.slice(0,2).map((name,index)=>({id:87001+index,code:87001+index,name,price:18000,availableNow:true,hasAttributes:false,attributes:[]}));
const phrase=(f:string[])=>`Me das un ${f[0]} con arta ${f[2]} y un ${f[1]} a cambio del ${f[3]} ${f[4]}, por favor`;
describe.each([false,true])('scoped notes across menus, agent=%s',enabled=>{
 test.each(families)('%s / %s preserve separate notes through order DTO',async(...f)=>{
  const h=harness(menuOf(f),enabled);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:125,dailyOrderNumber:125});
  const reply=await h.send(phrase(f));
  expect(h.cartRows()).toHaveLength(2);
  expect(h.cartRows().find(i=>i.id===87001)?.note).toContain(f[2]);
  expect(h.cartRows().find(i=>i.id===87002)?.note).toContain(f[3]);
  expect(h.cartRows().find(i=>i.id===87002)?.note).toContain(f[4]);
  expect(reply).not.toMatch(/No pude|no manejamos/);
  expect(reply).toContain('1.'); expect(reply).toContain('2.');
  await h.send('no más, recojo en el local'); await h.send('contraentrega');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.send('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(2);
  expect(items.find(i=>i.productId===87001)?.note).toContain(f[2]);
  expect(items.find(i=>i.productId===87002)?.note).toContain(f[4]);
 });
});
test.each(families)('tool validation for %s / %s',async(...f)=>{
 globalThis.fetch=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:[call(87001),call(87002)]})).mockResolvedValueOnce(response({content:'Listo'}));
 const result=await makeAgent().runTurn(input(phrase(f),menuOf(f)));
 expect(result.purchaseAttempts).toEqual([87001,87002].map(productId=>({productId,accepted:true})));
 expect(result.actions.addItems?.find(i=>i.productId===87001)?.note).toContain(f[2]);
 expect(result.actions.addItems?.find(i=>i.productId===87002)?.note).toContain(f[4]);
});
const complaints=['Porque no puedes añadir la milanesa y el ajiaco?','¿Por qué no agregaste la sopa?','por que no pudiste incluir la pasta','y por qué no me puedes agregar el bowl'];
test.each(complaints)('a proposed tool purchase is rejected for complaint: %s',async text=>{
 globalThis.fetch=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:[call(38)]})).mockResolvedValueOnce(response({content:'Aclaremos'}));
 const result=await makeAgent().runTurn(input(text));
 expect(result.actions.addItems).toBeUndefined();
 expect(result.purchaseAttempts).toEqual([{productId:38,accepted:false,reason:'question_not_order'}]);
});
test.each(['entonces agrega el ajiaco','sí añade la pasta','quiero la sopa porque no he almorzado','puedes agregar el bowl'])('purchase stays eligible: %s',text=>expect(isFailedAdditionQuestion(text)).toBe(false));
test('unsupported composition still rejected, not hidden as a kitchen note',async()=>{
 globalThis.fetch=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:[call(38)]})).mockResolvedValueOnce(response({content:'Aclaremos'}));
 const result=await makeAgent().runTurn(input('quiero una sopa de ajiaco con langosta'));
 expect(result.actions.addItems).toBeUndefined();
 expect(result.purchaseAttempts?.[0]).toMatchObject({accepted:false,reason:'dish_not_on_menu'});
});

const pairSource='Dos sopas de menudencias una con arto arroz y la otra con arta ensalada';
test('two note groups do not reuse the total quantity in each tool call',async()=>{
 const calls=[['con harto arroz',1],['con harta ensalada',2]].map(([note,quantity],index)=>({id:`group-${index}`,type:'function',function:{name:'add_item',arguments:JSON.stringify({productId:20,quantity,note})}}));
 globalThis.fetch=jest.fn().mockResolvedValueOnce(response({content:null,tool_calls:calls})).mockResolvedValueOnce(response({content:'Listo'}));
 const result=await makeAgent().runTurn(input(pairSource));
 expect(result.actions.addItems?.map(i=>i.quantity)).toEqual([1,1]);
 expect(result.actions.addItems?.map(i=>i.note)).toEqual([expect.stringMatching(/arroz/),expect.stringMatching(/ensalada/)]);
});
for(const enabled of [false,true]) test(`two notes on exactly two soups agent=${enabled}`,async()=>{
 const h=harness(products,enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 const reply=await h.send(pairSource);
 expect(h.cartRows().map(i=>[i.id,i.qty])).toEqual([[20,1],[20,1]]);
 expect(h.cartRows()[0].note).toMatch(/arroz/);expect(h.cartRows()[1].note).toMatch(/ensalada/);
 expect(reply).not.toMatch(/interrumpió|no manejamos/i);
});
for(const enabled of [false,true])for(const f of families)test(`two scoped abundance notes ${f[0]} agent=${enabled}`,async()=>{
 const menu=menuOf(f);const h=harness(menu,enabled);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:126,dailyOrderNumber:126});
 const reply=await h.send(`dos ${f[0]} una con arta ${f[2]} y la otra con arto ${f[3]}`);
 expect(h.cartRows().map(i=>[i.id,i.qty])).toEqual([[87001,1],[87001,1]]);
 expect(h.cartRows()[0].note).toContain(f[2]);expect(h.cartRows()[0].note).not.toContain(f[3]);
 expect(h.cartRows()[1].note).toContain(f[3]);expect(h.cartRows()[1].note).not.toContain(f[2]);
 expect(reply).not.toMatch(/interrumpió|no manejamos/i);
 await h.send('no más, recojo en el local');await h.send('contraentrega');
 expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.send('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const items=h.service.ordersService.create.mock.calls[0][0].items;
 expect(items).toHaveLength(2);
 expect(items[0].note).toContain(f[2]);expect(items[1].note).toContain(f[3]);
});
