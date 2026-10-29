import { harness } from './whatsapp-accuracy.test-support';
const menus=[['Bowl de garbanzos','Curry de lentejas'],['Pizza del huerto','Ravioles de ricota']];
for(const names of menus)for(const agent of [false,true]){
 const setup=async(options: {targetNote?:string;quantity?:number;third?:boolean;sourceNote?:string}={})=>{
  const h=harness([...names,...(options.third?['Agua mineral']:[])].map((name,i)=>({id:89001+i,code:89001+i,name,price:20000,availableNow:true,attributes:[]})),agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
  for(const name of names)await h.sendQueued(`Quiero un ${name}`);
  if(options.third)await h.sendQueued('Quiero un Agua mineral');
  h.conv.sessionData.cart[0].quantity=options.quantity||1;
  h.conv.sessionData.cart[0].note=options.sourceNote||'salsa aparte';h.conv.sessionData.cart[1].note=options.targetNote||'bien empacado';
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('uno sin cebolla');await h.sendQueued('1');
  expect(h.conv.sessionData.cart.some(line=>line.note?.includes('sin cebolla'))).toBe(true);
  return {h,before};
 };
 it.each(['no, el otro','perdón, el otro','mejor el otro'])(`redirects only last note ${names[0]} agent=${agent}: %s`,async text=>{
  const {h,before}=await setup();const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([before[0],{...before[1],note:'bien empacado; sin cebolla'}]);
  expect(reply).toContain(names[1]);expect(reply).toMatch(/nota|indicaci[oó]n/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it.each(['stale','expired','future','interrupted','media','conflict','review','repeat','pending','closed','negation','location-link'])(`redirect guard ${names[0]} agent=${agent}: %s`,async scenario=>{
  const {h}=await setup({targetNote:scenario==='conflict'?'con cebolla':undefined});
  const marker=h.conv.sessionData.lastKitchenNoteSelection;
  expect(marker).toBeTruthy();if(!marker)throw new Error('Expected recent selection');
  if(scenario==='stale')h.conv.sessionData.cart[1].quantity=2;
  if(scenario==='expired')marker.createdAt=Date.now()-11*60*1000;
  if(scenario==='future')marker.createdAt=Date.now()+60000;
  if(scenario==='interrupted')await h.sendQueued('Cuánto es el total');
  if(scenario==='location-link')await h.sendQueued('https://maps.google.com/?q=4.6,-74.1');
  if(scenario==='media')await h.sendQueued('',{messageType:'other'});
  if(scenario==='review')h.conv.state='awaiting_final_confirm';
  if(scenario==='closed')h.conv.state='completed';
  if(scenario==='pending')h.conv.sessionData.pendingUnitDistribution={productId:89001,quantity:2,sourceText:'dos platos'};
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(scenario==='negation'?'no el otro':'no, el otro');
  if(scenario==='review'||scenario==='repeat'){
   expect(h.conv.sessionData.cart[0].note).toBe('salsa aparte');
   expect(h.conv.sessionData.cart[1].note).toBe('bien empacado; sin cebolla');
   if(scenario==='review')expect(h.conv.state).toBe('awaiting_final_confirm');
   const corrected=structuredClone(h.conv.sessionData.cart);
   await h.sendQueued('no, el otro');
   expect(h.conv.sessionData.cart).toEqual(corrected);
  }else expect(h.conv.sessionData.cart).toEqual(before);
  if(scenario==='conflict')expect(h.conv.sessionData.lastKitchenNoteSelection?.awaitingDestination).toBe(true);
  else expect(h.conv.sessionData.lastKitchenNoteSelection).toBeFalsy();
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });

 it.each(['multiple-units','three-lines','already-noted'])(`does not infer another unit or preexisting note ${names[0]} agent=${agent}: %s`,async scenario=>{
  const {h}=await setup({quantity:scenario==='multiple-units'?2:1,third:scenario==='three-lines',sourceNote:scenario==='already-noted'?'salsa aparte; sin cebolla':undefined});
  if(scenario==='three-lines')expect(h.conv.sessionData.lastKitchenNoteSelection).toBeTruthy();
  else expect(h.conv.sessionData.lastKitchenNoteSelection).toBeFalsy();
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('no, el otro');
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });

}
