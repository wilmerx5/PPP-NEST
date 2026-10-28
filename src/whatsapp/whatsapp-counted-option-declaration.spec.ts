/** CHAT2510-05 partial reproduction: correcting existing units, not a complete replay. */
import {harness,products} from './whatsapp-accuracy.test-support';
for(const agent of [false,true])it(`CHAT2510-05 correcting one of two existing executives: ${agent}`,async()=>{
 const product=products.find(p=>p.id===22)!;const h=harness(products,agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 const attributes=[{attributeName:'Presa',attributeValue:'Ala, pechuga'},{attributeName:'Sopa',attributeValue:'Ajiaco'},{attributeName:'Bebida',attributeValue:'Limonada'}];
 h.conv.sessionData.cart=[{productId:22,code:22,name:product.name,quantity:2,unitPrice:product.price,attributes}];
 await h.sendQueued('un ejecutvo va conpierna pernil y  con limonada');
 expect(h.conv.sessionData.cart.reduce((n,p)=>n+p.quantity,0)).toBe(2);
 const changed=h.conv.sessionData.cart.filter(p=>p.attributes?.some(a=>a.attributeName==='Presa'&&a.attributeValue==='Pierna Pernil'));
 expect(changed.reduce((n,p)=>n+p.quantity,0)).toBe(1);
 expect(h.conv.sessionData.cart.every(p=>p.attributes?.some(a=>a.attributeName==='Bebida'&&a.attributeValue==='Limonada'))).toBe(true);
});

const menus=[
 {name:'Ejecutivo Vegetal',attribute:'Proteína',before:'Tofu',after:'Garbanzos',drink:'Limonada'},
 {name:'Bento Oriental',attribute:'Proteína',before:'Tofu',after:'Tempura',drink:'Té Verde'},
 {name:'Pasta Primavera',attribute:'Salsa',before:'Pesto',after:'Pomodoro',drink:'Agua'},
];
for(const m of menus)for(const agent of [false,true]){
 const setup=()=>{
  const product={id:9601,code:61,name:m.name,price:25000,availableNow:true,hasAttributes:true,attributes:[{attributeName:m.attribute,options:[m.before,m.after]},{attributeName:'Bebida',options:['Cola',m.drink]}]};
  const h=harness([product],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
  Object.assign(h.conv.sessionData,{cart:[{productId:9601,code:61,name:m.name,quantity:2,unitPrice:product.price,note:'Sin cebolla',attributes:[{attributeName:m.attribute,attributeValue:m.before},{attributeName:'Bebida',attributeValue:m.drink}]}],phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});return h;
 };
 const text=`un ${m.name} va con${m.after} y con ${m.drink}`;
 for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])it(`${m.name}/${agent}/${state}: declaration changes one of two and preserves checkout`,async()=>{
  const h=setup();h.conv.state=state;await h.sendQueued(text);
  const rows=h.conv.sessionData.cart;expect(rows.map(p=>p.quantity)).toEqual([1,1]);expect(h.conv.state).toBe(state);
  expect(rows.map(p=>p.attributes?.find(a=>a.attributeName===m.attribute)?.attributeValue)).toEqual([m.before,m.after]);
  expect(rows.every(p=>p.note==='Sin cebolla'&&p.attributes?.some(a=>a.attributeName==='Bebida'&&a.attributeValue===m.drink))).toBe(true);
  expect(h.replies.at(-1)).not.toMatch(/no pude|no entend/i);
  const changed=structuredClone(rows);await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual(changed);expect(h.replies.at(-1)).toMatch(/ya est[aá] aplicado/i);
  await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(2);expect(dto.items.map((p:{note?:string})=>p.note)).toEqual(['Sin cebolla','Sin cebolla']);
  expect(dto.items.map((p:{attributes:Array<{attributeName:string;attributeValue:string}>})=>p.attributes.find(a=>a.attributeName===m.attribute)?.attributeValue)).toEqual([m.before,m.after]);
 });
 for(const fault of ['unknown','excess','ambiguous','pending'])it(`${m.name}/${agent}/${fault}: no extra purchase or partial edit`,async()=>{
  const h=setup();if(fault==='ambiguous')h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],note:'Sin sal'});
  if(fault==='pending')h.conv.sessionData.pendingMatch={query:'otra compra',candidates:[],quantity:1,intent:'order'} as never;
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`${fault==='excess'?'tres':'un'} ${m.name} va con${fault==='unknown'?'opcion inexistente':m.after} y con ${m.drink}`);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/cu[aá]l|aclara|selecci[oó]n|pendiente/i);
 });
 it(`${m.name}/${agent}: an explicit additional purchase still adds one`,async()=>{
  const h=setup();await h.sendQueued(`Agrega un ${m.name} con ${m.after} y ${m.drink}`);
  expect(h.conv.sessionData.cart.reduce((n,p)=>n+p.quantity,0)).toBe(3);
 });
 it(`${m.name}/${agent}: question does not change either unit`,async()=>{
  const h=setup();const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`¿Un ${m.name} va con ${m.after}?`);
  expect(h.conv.sessionData.cart).toEqual(before);
 });

}
