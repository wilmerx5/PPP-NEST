import { harness } from './whatsapp-accuracy.test-support';

const menus=[
 {categories:['Carnes','Pescados'],subjects:['carne','pescado'],names:['Churrasco','Mojarra']},
 {categories:['Pizzas','Pastas'],subjects:['pizzas','pastas'],names:['Pizza Vegetal','Ravioles']},
 {categories:['Postres','Bebidas'],subjects:['postres','bebidas'],names:['Tarta De Manzana','Té Verde']},
];
for(const menu of menus)for(const enabled of [false,true])for(const occupied of [false,true]){
 const products=menu.names.map((name,i)=>({id:99501+i,code:99501+i,name,categoryName:menu.categories[i],price:15000,availableNow:true,attributes:[]}));
 const [a,b]=menu.subjects;
 for(const [mode,text] of [
  ['audio',`Quiero algo como de ${a}. ¿Qué tiene de ${a}? O de ${b}, ¿qué tiene de ${b}?`],
  ['text',`¿Qué tienen de ${a} o de ${b}?`],
  ['text',`Hola, ¿qué tienen de ${a}? ¿Y de ${b}?`],
 ]){
  it(`${a}/${b} ${mode} occupied=${occupied} agent=${enabled}: ${text}`,async()=>{
   const h=harness(products,enabled);
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Qué se te antoja?',actions:{}});
   if(occupied)await h.sendQueued(`Quiero un ${menu.names[0]}`);
   const before=structuredClone(h.conv.sessionData.cart);
   h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('audio fixture'),mimeType:'audio/ogg'});
   h.service.aiService.transcribeAudio=jest.fn().mockResolvedValue(text);
   h.service.conversationService.updateMessageBody=jest.fn();
   h.service.ordersService.create=jest.fn();
   const start=h.replies.length;
   await h.sendQueued(mode==='audio'?'':text,mode==='audio'?{messageType:'audio',mediaId:'fixture'}:{});
   const reply=h.replies.slice(start).join('\n');
   expect(reply).not.toMatch(/no (?:tenemos|manejamos)/i);
   for(const name of menu.names)expect(reply).toContain(name);
   expect(h.conv.sessionData.cart).toEqual(before);
   expect(h.conv.state).toBe('building_cart');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued(`Quiero un ${menu.names[1]}`);
   expect(h.conv.sessionData.cart.find(i=>i.productId===99502)?.quantity).toBe(1);
  });
 }
 it(`carta con saludo: ${a} occupied=${occupied} agent=${enabled}`,async()=>{
  const h=harness(products,enabled);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Qué se te antoja?',actions:{}});
  if(occupied)await h.sendQueued(`Quiero un ${menu.names[0]}`);
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('Hola buenas tardes tienes la carta por favor');
  expect(reply).toContain(h.cfg.menuUrl);
  expect(reply).not.toMatch(/no (?:tenemos|manejamos)/i);
  expect(h.conv.sessionData.cart).toEqual(before);
 });
}

describe('category composition boundaries',()=>{
 const menu=[
  {id:99601,code:99601,name:'Pizza Vegetal',categoryName:'Pizzas',price:16000,availableNow:true,attributes:[]},
  {id:99602,code:99602,name:'Ravioles',categoryName:'Pastas',price:18000,availableNow:true,attributes:[]},
 ];
 it.each([
  '¿Qué tiene de pizzas? Agrega unos ravioles',
  '¿Qué tiene de pizzas? ¿Cuánto tardan?',
  '¿Qué tiene de pizzas? ¿Aceptan transferencia?',
  '¿Qué tiene de pizzas sin gluten? ¿Y de pastas?',
  '¿Qué tiene de pizzas? ¿Y de pastas sin huevo?',
 ])('does not silently drop a clause: %s',text=>{
  const h=harness(menu);
  expect(h.service.catalogService.findCategoryQuestionList(text,menu)).toBeNull();
 });
 for(const enabled of [false,true]){
  it(`repetition deduplicates choices and numeric selection uses displayed menu agent=${enabled}`,async()=>{
   const h=harness(menu,enabled);
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
   await h.sendQueued('¿Qué tienen de pizzas? ¿Y de pastas? ¿Qué tienen de pizzas?');
   expect(h.conv.sessionData.cart).toHaveLength(0);
   expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([99601,99602]);
   await h.sendQueued('2');
   expect(h.conv.sessionData.cart).toHaveLength(1);
   expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99602,quantity:1});
  });
 }
});
