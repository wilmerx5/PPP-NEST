import {mealtimeAvailabilityQuery} from './whatsapp-mealtime-query';
import {harness} from './whatsapp-accuracy.test-support';
const families = [
 {word:'hamburguesas',names:['Mini Hamburguesa','Hamburguesa Clasica']},
 {word:'pizzas',names:['Pizza Margarita','Pizza Del Huerto']},
 {word:'sopas',names:['Sopa De Verduras','Sopa De Lentejas']},
];
function setup(f:typeof families[number], agent:boolean, existing:boolean) {
 const menu=[...f.names,'Ejecutivo Del Dia','Agua Mineral'].map((name,i)=>({id:96000+i,code:96000+i,name,price:16000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn();
 if(existing)h.conv.sessionData.cart=[{productId:96003,code:96003,name:'Agua Mineral',quantity:2,unitPrice:19000,attributes:[],note:'Sin hielo'}];
 return {h,menu};
}
for(const f of families)for(const agent of [false,true])for(const existing of [false,true])
for(const phrase of [`¿Tienen ${f.word} para almorzar?`,`Hola veci, ¿tienes ${f.word} para la cena?`,`hay ${f.word} para el almuerzo`,`tines ${f.word} para almorzar porfa`,`veci hay ${f.word} para cenar`])
it(`availability occasion ${f.word} ${agent} cart=${existing} ${phrase}`,async()=>{
 const {h}=setup(f,agent,existing);const before=structuredClone(h.conv.sessionData.cart);
 const reply=await h.sendQueued(phrase);
 for(const name of f.names)expect(reply).toContain(name);
 expect(reply).not.toMatch(/no (?:tenemos|manejamos|ofrecemos)|Ejecutivo Del Dia/i);
 expect(h.conv.sessionData.cart).toEqual(before);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

for(const agent of [false,true])for(const existing of [false,true]) {
 it(`single mini burger remains a valid offer ${agent} ${existing}`,async()=>{
  const {h,menu}=setup(families[0],agent,existing);menu.splice(1,1);
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('¿Tienen hamburguesas para almorzar?');
  expect(reply).toContain('Mini Hamburguesa');expect(reply).not.toMatch(/no (?:tenemos|manejamos|ofrecemos)/i);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`unavailable sibling is not offered ${agent} ${existing}`,async()=>{
  const {h,menu}=setup(families[0],agent,existing);menu[1].availableNow=false;
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('¿Tienen hamburguesas para almorzar?');
  expect(reply).toContain('Mini Hamburguesa');expect(reply).not.toContain('Hamburguesa Clasica');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`missing dish is not replaced by lunch meals ${agent} ${existing}`,async()=>{
  const {h}=setup(families[0],agent,existing);const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued('¿Tienen sushi para almorzar?');
  expect(reply).toMatch(/no (?:tenemos|manejamos|ofrecemos)/i);expect(reply).not.toContain('Ejecutivo Del Dia');
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
it.each([
 'quiero dos hamburguesas para almorzar', 'no quiero hamburguesas para almorzar',
 'tienen hamburguesas para almorzar mañana', 'tienen hamburguesas para almorzar y agrega dos',
 'tienen hamburguesas para almorzar con bebida', 'tienen hamburguesas si hay sopa para almorzar',
 'tienen mesas para almorzar', 'Hi! Do you have hamburguers for lunch?',
])('leave purchases, conditions and deferred languages to their own routes: %s',text=>{
 expect(mealtimeAvailabilityQuery(text)).toBeNull();
});
it.each([
 ['tienes hamburguesas sin carne para almorzar','hamburguesas sin carne'],
 ['tienes hamburguesas con bebida para almorzar','hamburguesas con bebida'],
 ['hay sopa de verduras para cenar','sopa de verduras'],
])('preserve dish qualifiers: %s', (text,query)=>expect(mealtimeAvailabilityQuery(text)).toBe(query));

for(const agent of [false,true])for(const existing of [false,true])it(`all presentations unavailable ${agent} ${existing}`,async()=>{
 const {h,menu}=setup(families[0],agent,existing);menu[0].availableNow=false;menu[1].availableNow=false;
 const before=structuredClone(h.conv.sessionData.cart);
 const reply=await h.sendQueued('¿Tienen hamburguesas para almorzar?');
 expect(reply).toMatch(/no hay opciones disponibles/i);expect(reply).not.toContain('$');
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingMatch).toBeFalsy();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
