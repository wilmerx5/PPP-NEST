import {harness} from './whatsapp-accuracy.test-support';
const menus=[['Bowl de garbanzos','Curry de lentejas','Pasta del huerto','Risotto vegetal'],['Pizza de hongos','Ravioles de ricota','Lasaña vegetal','Tortilla española']];
async function setup(names:string[],agent:boolean,size:number,note='sin cebolla',source=0,options:{quantity?:number;targetNote?:string;duplicate?:boolean}={}){
 const h=harness(names.slice(0,size).map((name,i)=>({id:89801+i,code:89801+i,name,price:18000+i*1000,availableNow:true,attributes:[]})),agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 for(const name of names.slice(0,size))await h.sendQueued(`quiero un ${name}`);
 h.conv.sessionData.cart.forEach((line,i)=>line.note=i===source?'bien empacado':'salsa aparte');
 h.conv.sessionData.cart[source].quantity=options.quantity||1;
 if(options.targetNote)h.conv.sessionData.cart[2].note=options.targetNote;
 // A displayed title may occur on multiple independently configured cart lines.
 if(options.duplicate)h.conv.sessionData.cart[1].name=h.conv.sessionData.cart[2].name;
 const original=structuredClone(h.conv.sessionData.cart);
 await h.sendQueued(`uno ${note}`);await h.sendQueued(String(source+1));
 return {h,original};
}
for(const names of menus)for(const agent of [false,true])for(const size of [3,4]){
 for(const source of [0,1])for(const state of ['building_cart','awaiting_final_confirm'])for(const note of ['sin cebolla','sin cebolla y sin tomate'])
 for(const style of ['ordinal','name','number'])it(`explicit redirection ${names[0]} agent=${agent} size=${size} source=${source} ${state} ${note} ${style}`,async()=>{
  const {h,original}=await setup(names,agent,size,note,source);h.conv.state=state;
  const target=style==='ordinal'?2:style==='name'?size-1:1-source;
  const text=style==='ordinal'?'perdón, al tercero':style==='name'?`no, al ${names[target]}`:`mejor al ${target+1}`;
  const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual(original.map((line,i)=>i===target?{...line,note:`${line.note}; ${note}`}:line));
  expect(reply).toContain(names[target]);expect(reply).toMatch(/pas[eé] la nota/i);expect(reply).toContain(note);
  expect(h.conv.state).toBe(state);expect(h.conv.sessionData.lastKitchenNoteSelection).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const once=structuredClone(h.conv.sessionData.cart);await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual(once);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const scenario of ['stale','expired','future','interruption','media','question','same-source','pending','multi-units','no-context','unknown','mixed','closed','payment-link','long-note','duplicate-name'])
 it(`redirection guard ${names[0]} agent=${agent} size=${size}: ${scenario}`,async()=>{
  const {h}=await setup(names,agent,size,'sin cebolla',0,{quantity:scenario==='multi-units'?2:1,targetNote:scenario==='long-note'?'x'.repeat(195):undefined,duplicate:scenario==='duplicate-name'});
  const marker=h.conv.sessionData.lastKitchenNoteSelection;
  if(['expired','future'].includes(scenario)){expect(marker).toBeTruthy();if(!marker)throw Error('missing marker');marker.createdAt=Date.now()+(scenario==='expired'?-660000:60000);}
  if(scenario==='stale')h.conv.sessionData.cart[2].unitPrice++;
  if(scenario==='interruption')await h.sendQueued('cuánto es el total');
  if(scenario==='media')await h.sendQueued('',{messageType:'other'});
  if(scenario==='pending')h.conv.sessionData.pendingUnitDistribution={productId:89801,quantity:2,sourceText:'dos platos'};
  if(scenario==='closed')h.conv.state='completed';
  if(scenario==='payment-link')h.conv.sessionData.mpPreferenceId='synthetic-link';
  if(scenario==='no-context')h.conv.sessionData.lastKitchenNoteSelection=undefined;
  const before=structuredClone(h.conv.sessionData.cart);
  const text=scenario==='question'?'¿perdón, al tercero?':scenario==='same-source'?'perdón, al primero':scenario==='unknown'?'perdón, al inexistente':scenario==='mixed'?'perdón, al tercero y agrega agua':scenario==='duplicate-name'?`perdón, al ${names[2]}`:'perdón, al tercero';
  const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(['unknown','mixed','long-note','duplicate-name'].includes(scenario)){expect(reply).toMatch(/cu[aá]l|elige|indica/i);expect(h.conv.sessionData.lastKitchenNoteSelection?.awaitingDestination).toBe(true);}
  if(scenario==='same-source')expect(reply).toMatch(/ya.*nota|nota.*ya/i);
 });
 for(const scenario of ['ambiguous','conflict','cancel','interrupted','expired'])it(`redirection recovery ${names[0]} agent=${agent} size=${size}: ${scenario}`,async()=>{
  const {h,original}=await setup(names,agent,size,'sin cebolla',0,{targetNote:scenario==='conflict'?'con cebolla':undefined});
  const selected=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(scenario==='conflict'?'perdón, al tercero':'no, el otro');
  expect(h.conv.sessionData.cart).toEqual(selected);expect(h.conv.sessionData.lastKitchenNoteSelection?.awaitingDestination).toBe(true);
  expect(reply).toMatch(scenario==='conflict'?/incompatible/i:/cu[aá]l|elige/i);
  if(scenario==='conflict')expect(reply).toContain('con cebolla');
  if(scenario==='interrupted')await h.sendQueued('cuánto es el total');
  if(scenario==='expired')h.conv.sessionData.lastKitchenNoteSelection!.createdAt=Date.now()-660000;
  const answer=scenario==='cancel'?'no muevas la nota':scenario==='interrupted'?'perdón, al tercero':scenario==='conflict'?'2':names[size-1];
  await h.sendQueued(answer);
  const target=scenario==='conflict'?1:size-1;
  expect(h.conv.sessionData.cart).toEqual(['cancel','interrupted','expired'].includes(scenario)?selected:original.map((line,i)=>i===target?{...line,note:`${line.note}; sin cebolla`}:line));
  expect(h.conv.sessionData.lastKitchenNoteSelection).toBeFalsy();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
