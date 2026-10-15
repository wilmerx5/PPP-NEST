import {readFileSync} from 'fs';
import {join} from 'path';
import {WhatsappAgentService} from './whatsapp-agent.service';
import {WhatsappCatalogService} from './whatsapp-catalog.service';
const real=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-beta-menu.json'),'utf8'));
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
it.each([
 {name:'PPP',menu:real,id:71,text:'Buenas, para hoy me mandas un dúo de tacos con Coca Cola Zero y dos sopas de ajiaco sin arroz. Si no venden flan, no lo reemplaces.'},
 {name:'otro catálogo',menu:[{...real.find(p=>p.id===71),id:601,code:601,name:'Duo De Arepas Del Campo'},real.find(p=>p.id===95),{...real.find(p=>p.id===38),id:602,code:602,name:'Crema De Calabaza'}],id:601,text:'Para hoy me mandas un dúo de arepas con Coca Cola Zero y dos cremas de calabaza. Si no venden flan, no lo reemplaces.'}
])('accepts a catalog-resolved host without turning its option into a standalone SKU: $name',async({menu,id,text})=>{
 const catalog=new WhatsappCatalogService({} as never);
 expect(catalog.hostedMenuDrink(text,menu)?.product.id).toBe(id);
 globalThis.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:null,tool_calls:[{id:'c1',type:'function',function:{name:'add_item',arguments:JSON.stringify({productId:id,quantity:1,attributes:[{attributeName:'Bebida',attributeValue:'Coca Cola Zero'}]})}}]}}]})})
  .mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:'Listo.'}}]})});
 const agent=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'offline',openaiModel:'gpt-4.1-2025-04-14',localContext:{}})} as never,catalog);
 const result=await agent.runTurn({userMessage:text,products:menu,cart:[],sessionSummary:'Vacío',recentMessages:[],businessRulesBlock:'',brandName:'Prueba'});
 expect(result.purchaseAttempts).toEqual([{productId:id,accepted:true}]);
 expect(result.actions.addItems).toEqual([expect.objectContaining({productId:id,quantity:1,attributes:[{attributeName:'Bebida',attributeValue:'Coca Cola Zero'}]})]);
});
