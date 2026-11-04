import {harness,products} from './whatsapp-accuracy.test-support';
function setup(other:boolean,agent:boolean) {
 const menu=other ? [
  ...['Asado','Ahumado'].map((style,i)=>({id:96401+i,code:i+1,name:`Bowl ${style}`,price:20000+i*1000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']},{attributeName:'Sopa',options:['Tomate','Lentejas']},{attributeName:'Bebida',options:['Agua','Limonada']}]})),
  {id:96403,code:3,name:'Sopa De Tomate',price:5000,availableNow:true,hasAttributes:false,attributes:[]},
 ] : structuredClone(products);
 const h=harness(menu,agent);
 h.cfg.ignoreBusinessHours=false;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:375,dailyOrderNumber:375});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const request=other ? 'Por favor 4 bowls\n3 bowls asados\n1 ahumado\nArroz todos\n3 tomates\n1 lentejas' : 'Por favor 4 ejecutivos\n3 ejecutivos con frito\n1 broster\nPierna pernil todos\n3 ajiacos\n1 menudencias';
 return {h,menu,request,ids:other?[96401,96402]:[22,18],soups:other?['Tomate','Lentejas']:['Ajiaco','Menudencias'],base:other?'Arroz':'Pierna Pernil',total:other?'81.000':'97.000'};
}

for(const other of [false,true])for(const agent of [false,true])for(const choice of ['1','2'])for(const partial of [false,true]) {
 it(`shared choice while soup allocation pending ${other}/${agent}/${choice}/${partial}`,async()=>{
  const {h,request,ids,soups}=setup(other,agent);
  await h.sendQueued(partial?request.replace(/\n1 (menudencias|lentejas)$/,''):request);
  await h.sendQueued('Sin ensaladas');
  const drink=other?'Limonada':'Pepsi';
  const response=await h.sendQueued(`todos ${drink}`);
  expect(h.conv.sessionData.cart).toEqual([]);
  if(!partial)expect(response).toContain(soups[1]);
  else expect(response).toMatch(/falta.*1/i);
  expect(h.conv.sessionData.pendingCountedHeaderOrder?.units.every(unit=>unit.attributes.some(a=>a.attributeName==='Bebida'&&a.attributeValue===drink))).toBe(true);
  await h.sendQueued(`todos ${drink}`);
  if(partial)await h.sendQueued(other?'una lentejas':'una menudencia');
  await h.sendQueued(choice);
  const cart=h.conv.sessionData.cart;
  expect(cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4);
  expect(cart.every(line=>line.attributes?.some(a=>a.attributeValue===drink)&&/sin ensaladas/i.test(line.note||''))).toBe(true);
  expect(cart.find(line=>line.attributes?.some(a=>a.attributeValue===soups[1]))?.productId).toBe(ids[Number(choice)-1]);
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(4);
 });
}
for(const agent of [false,true])for(const choice of ['1','2'])for(const interruption of ['none','question','unknown','conflict','repeat','cancel','stock','option','stale']) {
 it(`required flavor after resolved allocation ${agent}/${choice}/${interruption}`,async()=>{
  const menu=['Agua','Leche'].map((style,i)=>({id:98601+i,code:i+1,name:`Jugo Natural En ${style}`,price:10000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Endulzante',options:['Azucar','Panela']},{attributeName:'Sabor',options:['Mango','Fresa']}]}));
  const h=harness(menu,agent);
  h.cfg.ignoreBusinessHours=false;
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:386,dailyOrderNumber:386});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const request='4 jugos: 3 jugo natural en agua y 1 jugo natural en leche, 3 azucar y 1 panela';
  await h.sendQueued(request);
  expect(h.conv.sessionData.pendingCountedHeaderOrder?.units).toHaveLength(4);
  await h.sendQueued('Sin hielo');
  await h.sendQueued(choice);
  expect(h.conv.sessionData.cart).toEqual([]);
  const resolved=structuredClone(h.conv.sessionData.pendingCountedHeaderOrder?.units);
  expect(resolved?.filter(unit=>unit.attributes.some(a=>a.attributeValue==='Panela'))).toHaveLength(1);
  if(['question','unknown','conflict','repeat'].includes(interruption)) {
    await h.sendQueued(interruption==='question'?'¿tienen mango?':interruption==='unknown'?'todos sabor lunar':interruption==='conflict'?'todos azucar':request);
    expect(h.conv.sessionData.pendingCountedHeaderOrder?.units).toEqual(resolved);
    expect(h.conv.sessionData.cart).toEqual([]);
  }
  if(interruption==='cancel') {
    await h.sendQueued('cancelar pedido');
    expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeUndefined();
    expect(h.conv.sessionData.cart).toEqual([]);return;
  }
  if(interruption==='stock') menu[1].availableNow=false;
  if(interruption==='option') menu[1].attributes[1].options=['Fresa'];
  if(interruption==='stale') h.conv.sessionData.cart.push({productId:999,name:'Previo',quantity:1,code:999,unitPrice:1000});
  const before=structuredClone(h.conv.sessionData.cart);
  const response=await h.sendQueued('todos mango');
  if(['stock','option','stale'].includes(interruption)) {expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();return;}
  expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeUndefined();
  expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4);
  expect(h.conv.sessionData.cart.every(line=>line.attributes?.some(a=>a.attributeValue==='Mango'))).toBe(true);
  expect(h.conv.sessionData.cart.find(line=>line.attributes?.some(a=>a.attributeValue==='Panela'))?.productId).toBe(98600+Number(choice));
  expect(response).toMatch(/listo/i);
  expect(h.conv.sessionData.cart.every(line=>/sin hielo/i.test(line.note||''))).toBe(true);
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);
  expect(items.filter(item=>item.attributes.some(a=>a.attributeValue==='Panela'))).toHaveLength(1);
  expect(items.every(item=>/sin hielo/i.test(item.note||'')&&item.attributes.some(a=>a.attributeValue==='Mango'))).toBe(true);
 });
}
