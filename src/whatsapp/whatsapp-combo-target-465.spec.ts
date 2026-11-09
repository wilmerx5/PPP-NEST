import { harness, products } from './whatsapp-accuracy.test-support';

const families=[{label:'PPP',menu:products,whole:4,half:5,combo:98,side:'Arepas',a:'Fritas',b:'Blancas',
 wholeBuy:'Quiero 1 Pollo Broaster con arepas fritas',halfBuy:'Medio Pollo Broaster con arepas blancas',reference:'el pollo'}];
for(const [index,name] of ['Burrito Vegetal','Tortilla Vegetal'].entries()) {
 const base=76500+index*10, side={attributeName:'Guarnición',options:['Puré','Ensalada']};
 families.push({label:name,whole:base+1,half:base+2,combo:base+3,side:side.attributeName,a:'Puré',b:'Ensalada',reference:`el ${name}`,
  wholeBuy:`Quiero 1 ${name} con guarnición puré`,halfBuy:`Quiero 1/2 ${name} con guarnición ensalada`,menu:[
   {id:base+1,code:base+1,name:`1 ${name}`,price:20000,hasAttributes:true,attributes:[side]},
   {id:base+2,code:base+2,name:`1/2 ${name}`,price:12000,hasAttributes:true,attributes:[side]},
   {id:base+3,code:base+3,name:`Combo De ${name}`,price:26000,hasAttributes:true,attributes:[side,{attributeName:'Bebida',options:['Colombiana','Manzana']}]},
  ]});
}
type Family=typeof families[number];
const request=(f:Family)=>`${f.reference} lo quiero en combo con bebida colombiana`;
function setup(f:Family,agent:boolean) {
 const h=harness(f.menu,agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:465,dailyOrderNumber:465});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 return h;
}
async function prepare(f:Family,agent:boolean,reverse=false,phase='cart') {
 const h=setup(f,agent);
 for(const text of reverse?[f.halfBuy,f.wholeBuy]:[f.wholeBuy,f.halfBuy])await h.sendQueued(text);
 expect(h.conv.sessionData.cart.map(p=>p.productId)).toEqual(reverse?[f.half,f.whole]:[f.whole,f.half]);
 expect(h.conv.sessionData.cart.find(p=>p.productId===f.whole)?.attributes).toContainEqual({attributeName:f.side,attributeValue:f.a});
 expect(h.conv.sessionData.cart.find(p=>p.productId===f.half)?.attributes).toContainEqual({attributeName:f.side,attributeValue:f.b});
 if(phase!=='cart')await h.sendQueued('nada mas');
 if(phase==='final')await h.sendQueued('contraentrega');
 if(phase!=='cart')expect(h.conv.state).toBe(phase==='final'?'awaiting_final_confirm':'awaiting_payment');
 return h;
}
async function finish(h:ReturnType<typeof setup>) {
 const saved=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued('nada mas');await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];
 expect(dto.items.map(p=>p.productId).sort()).toEqual(saved.flatMap(p=>Array(p.quantity).fill(p.productId)).sort());
 for(const item of dto.items){const original=saved.find(p=>p.productId===item.productId)!;expect(item.attributes).toEqual(original.attributes);expect(item.note).toBe(original.note);}
}
function assertConversion(h:ReturnType<typeof setup>,f:Family,before:typeof h.conv.sessionData.cart,targetId:number,side?:string,drink='Colombiana') {
 const original=before.find(p=>p.productId===targetId)!, other=before.filter(p=>p.productId!==targetId);
 expect(h.conv.sessionData.cart.map(p=>[p.productId,p.quantity]).sort()).toEqual([[f.combo,original.quantity],...other.map(p=>[p.productId,p.quantity])].sort());
 expect(h.conv.sessionData.cart.filter(p=>p.productId!==f.combo)).toEqual(other);
 const changed=h.conv.sessionData.cart.find(p=>p.productId===f.combo)!;
 expect(changed.attributes).toEqual(expect.arrayContaining([{attributeName:f.side,attributeValue:side || original.attributes!.find(p=>p.attributeName===f.side)!.attributeValue},{attributeName:'Bebida',attributeValue:drink}]));
 expect(changed.note).toBe(original.note);expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();
 expect(h.service.ordersService.create).not.toHaveBeenCalled();expect(h.replies.at(-1)).toContain(changed.name);
}

for(const f of families)for(const agent of [false,true])for(const reverse of [false,true])for(const phase of ['cart','payment','final'])for(const answer of ['1','2','el entero','el medio']) {
 it(`combo target ${f.label}/${agent}/${reverse}/${phase}/${answer}`,async()=>{
  const h=await prepare(f,agent,reverse,phase),before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(request(f));
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartReplacement?.variantRequest).toBe(request(f));
  expect(h.replies.at(-1)).toMatch(/cu[aá]l/i);expect(h.replies.at(-1)).not.toMatch(/algo m[aá]s/i);expect(h.replies.at(-1)?.match(/\?/g)).toHaveLength(1);
  const target=answer==='el entero'?f.whole:answer==='el medio'?f.half:before[Number(answer)-1].productId;
  await h.sendQueued(answer);assertConversion(h,f,before,target);await finish(h);
 });
}
for(const f of families)for(const agent of [false,true]) {
 for(const portion of ['entero','medio'])it(`explicit target overrides focus ${f.label}/${agent}/${portion}`,async()=>{
  const h=await prepare(f,agent,portion==='medio'),before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`el ${portion} lo quiero en combo con bebida colombiana`);
  assertConversion(h,f,before,portion==='entero'?f.whole:f.half);await finish(h);
 });
 it(`explicit side overrides carried option ${f.label}/${agent}`,async()=>{
  const h=await prepare(f,agent),before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(request(f)+` y ${f.side} ${f.b}`);expect(h.conv.sessionData.cart).toEqual(before);
  await h.sendQueued('el entero');assertConversion(h,f,before,f.whole,f.b);await finish(h);
 });
 it(`new flavour while clarifying remains owned by conversion ${f.label}/${agent}`,async()=>{
  const h=await prepare(f,agent),before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(request(f));await h.sendQueued(request(f).replace('colombiana','manzana'));
  expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('1');assertConversion(h,f,before,f.whole,undefined,'Manzana');await finish(h);
 });
 it(`persisted quantities and notes survive target selection ${f.label}/${agent}`,async()=>{
  const h=await prepare(f,agent); // Only these extra persisted fields are seeded; both products were bought through the router.
  h.conv.sessionData.cart.find(p=>p.productId===f.whole)!.quantity=2;
  h.conv.sessionData.cart.find(p=>p.productId===f.whole)!.note='bien empacado';
  h.conv.sessionData.cart.find(p=>p.productId===f.half)!.note='sin salsa';
  const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(request(f));await h.sendQueued('el entero');
  assertConversion(h,f,before,f.whole);await finish(h);
 });
 for(const scenario of ['cancel','decline','invalid','confirm','stale','no_combo','missing_product','payment_link','question'])it(`pending target guard ${f.label}/${agent}/${scenario}`,async()=>{
  const h=await prepare(f,agent),before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(request(f));
  if(scenario==='cancel'||scenario==='decline') {
   await h.sendQueued(scenario==='cancel'?'cancela ese cambio':'no');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();expect(h.replies.at(-1)).toMatch(/cancel[eé].*cambio/i);
  } else if(scenario==='stale') {
   h.conv.sessionData.cart[0].quantity=3;const changed=structuredClone(h.conv.sessionData.cart);await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual(changed);expect(h.conv.sessionData.pendingCartReplacement).toBeUndefined();expect(h.replies.at(-1)).toMatch(/carrito cambi[oó]/i);
  } else if(scenario==='no_combo'||scenario==='missing_product') {
   h.service.catalogService.getMenuProducts.mockResolvedValue(f.menu.filter(p=>p.id!==(scenario==='no_combo'?f.combo:f.whole)));
   await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/no|ya no/i);
  } else if(scenario==='payment_link') {
   h.conv.sessionData.mpPreferenceId='isolated-test-link';await h.sendQueued('1');expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies.at(-1)).toMatch(/enlace de pago/i);
  } else {
   await h.sendQueued(scenario==='invalid'?'9':scenario==='confirm'?'confirmar':'¿Cuánto es el total?');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartReplacement).toBeDefined();
  }
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
