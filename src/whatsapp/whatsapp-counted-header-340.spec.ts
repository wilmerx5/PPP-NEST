import {harness,products} from './whatsapp-accuracy.test-support';
function setup(other:boolean,agent:boolean) {
 const menu=other ? [
  ...['Asado','Ahumado'].map((style,i)=>({id:96401+i,code:i+1,name:`Bowl ${style}`,price:20000+i*1000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']},{attributeName:'Sopa',options:['Tomate','Lentejas']},{attributeName:'Bebida',options:['Agua']}]})),
  {id:96403,code:3,name:'Sopa De Tomate',price:5000,availableNow:true,hasAttributes:false,attributes:[]},
 ] : structuredClone(products);
 const h=harness(menu,agent);
 h.cfg.ignoreBusinessHours=false;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:340,dailyOrderNumber:340});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const request=other ? 'Por favor 4 bowls\n3 bowls asados\n1 ahumado\nArroz todos\n3 tomates\n1 lentejas' : 'Por favor 4 ejecutivos\n3 ejecutivos con frito\n1 broster\nPierna pernil todos\n3 ajiacos\n1 menudencias';
 return {h,menu,request,ids:other?[96401,96402]:[22,18],soups:other?['Tomate','Lentejas']:['Ajiaco','Menudencias'],base:other?'Arroz':'Pierna Pernil',total:other?'81.000':'97.000'};
}
for(const other of [false,true])for(const agent of [false,true])for(const choice of ['1','2']) {
 it(`total heading and included options ${other}/${agent}/${choice}`,async()=>{
  const {h,request,ids,soups,base,total}=setup(other,agent);
  const reply=await h.sendQueued(request);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.conv.sessionData.pendingCountedHeaderOrder?.units).toHaveLength(4);
  expect(reply).toContain('4 platos');expect(reply).toContain(soups[1]);
  await h.sendQueued('Sin ensaladas');
  expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued(choice);
  expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeUndefined();
  const cart=h.conv.sessionData.cart;
  expect(cart.filter(line=>line.productId===ids[0]).reduce((sum,line)=>sum+line.quantity,0)).toBe(3);
  expect(cart.filter(line=>line.productId===ids[1]).reduce((sum,line)=>sum+line.quantity,0)).toBe(1);
  expect(cart.every(line=>ids.includes(line.productId) && /sin ensaladas/i.test(line.note||'') && line.attributes?.some(attr=>attr.attributeValue===base))).toBe(true);
  for(const [i,quantity] of [[0,3],[1,1]]) expect(cart.filter(line=>line.attributes?.some(attr=>attr.attributeName==='Sopa' && attr.attributeValue===soups[i])).reduce((sum,line)=>sum+line.quantity,0)).toBe(quantity);
  expect(cart.find(line=>line.attributes?.some(attr=>attr.attributeValue===soups[1]))?.productId).toBe(ids[Number(choice)-1]);
  await h.sendQueued('no mas');await h.sendQueued('contraentrega');
  const receipt=await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);expect(items.every(item=>ids.includes(item.productId))).toBe(true);
  expect(items.filter(item=>item.attributes.some(attr=>attr.attributeName==='Sopa'&&attr.attributeValue===soups[1]))).toHaveLength(1);
  expect(receipt).toContain(total);expect(receipt).toMatch(/sin ensaladas/i);
 });
}
for(const other of [false,true])for(const agent of [false,true])for(const scenario of ['stock','option','stale','invalid','cancel','total','soup-total']) {
 it(`header guard ${other}/${agent}/${scenario}`,async()=>{
  const {h,request,menu,ids}=setup(other,agent);
  await h.sendQueued(scenario==='total'?request.replace('4 ','5 '):scenario==='soup-total'?request.replace('3 ajiacos','2 ajiacos').replace('3 tomates','2 tomates'):request);
  if(['total','soup-total'].includes(scenario)) {expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeUndefined();return;}
  expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeDefined();
  if(scenario==='stock') menu.find(p=>p.id===ids[1])!.availableNow=false;
  if(scenario==='option') menu.find(p=>p.id===ids[1])!.attributes.find(a=>a.attributeName==='Sopa')!.options=[];
  if(scenario==='stale') h.conv.sessionData.cart.push({productId:999,code:999,name:'Plato previo',quantity:1,unitPrice:10000});
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(scenario==='cancel'?'reiniciar':scenario==='invalid'?'9':'2');
  expect(h.conv.sessionData.cart).toEqual(scenario==='cancel'?[]:before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(scenario==='cancel'||scenario==='stale')expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeUndefined();
  if(scenario==='stock'||scenario==='option')expect(reply).toMatch(/disponible/);
 });
}
for(const other of [false,true])for(const agent of [false,true])for(const mode of ['repeat','named','checkout','unknown']) {
 it(`header continuity ${other}/${agent}/${mode}`,async()=>{
  const {h,menu,request,ids}=setup(other,agent);
  if(mode==='checkout') {
    h.conv.sessionData.cart=[{productId:ids[0],code:ids[0],name:menu.find(p=>p.id===ids[0])!.name,quantity:1,unitPrice:10000,attributes:[]}];
    h.conv.state='awaiting_final_confirm';
  }
  const before=structuredClone(h.conv.sessionData.cart);
  const first=await h.sendQueued(mode==='unknown'?request+'\ncon ingrediente imaginario':request);
  if(mode==='unknown') {expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeUndefined();expect(first).toMatch(/aclarar/);return;}
  expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeDefined();
  await h.sendQueued(request);expect(h.conv.sessionData.cart).toEqual(before);
  const answer=mode==='named'?menu.find(p=>p.id===ids[1])!.name:'2';
  await h.sendQueued(answer);
  expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeUndefined();
  expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4+(mode==='checkout'?1:0));
  if(mode==='checkout')expect(h.conv.state).toBe('awaiting_final_confirm');
  const done=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(request);expect(h.conv.sessionData.cart).toEqual(done);expect(reply).toMatch(/no añadí más/);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
for(const other of [false,true])for(const agent of [false,true]) {
 it(`word counts and short choice ${other}/${agent}`,async()=>{
  const {h,request,ids}=setup(other,agent);
  await h.sendQueued(request.replace('4 ','cuatro ').replace(/3 /g,'tres ').replace(/1 /g,'un '));
  expect(h.conv.sessionData.pendingCountedHeaderOrder?.units).toHaveLength(4);
  await h.sendQueued(other?'ahumado':'broaster');
  expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeUndefined();
  expect(h.conv.sessionData.cart.filter(line=>line.productId===ids[1]).reduce((n,line)=>n+line.quantity,0)).toBe(1);
 });
 for(const interrupt of ['no','quiero otro','¿cuál?']) it(`does not consume unrelated acceptance ${other}/${agent}/${interrupt}`,async()=>{
  const {h,request}=setup(other,agent);
  await h.sendQueued(request);const before=structuredClone(h.conv.sessionData);
  await h.sendQueued(interrupt);
  expect(h.conv.sessionData).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
