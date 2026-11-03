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
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:374,dailyOrderNumber:374});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const request=other ? 'Por favor 4 bowls\n3 bowls asados\n1 ahumado\nArroz todos\n3 tomates\n1 lentejas' : 'Por favor 4 ejecutivos\n3 ejecutivos con frito\n1 broster\nPierna pernil todos\n3 ajiacos\n1 menudencias';
 return {h,menu,request,ids:other?[96401,96402]:[22,18],soups:other?['Tomate','Lentejas']:['Ajiaco','Menudencias'],base:other?'Arroz':'Pierna Pernil',total:other?'81.000':'97.000'};
}
function compactRequest(request:string,format:string,words:boolean) {
 const rows=request.split('\n').map(row=>words?row.replace(/\b4\b/g,'cuatro').replace(/\b3\b/g,'tres').replace(/\b1\b/g,'uno'):row);
 if(format==='semicolon')return rows.join('; ');
 if(format==='comma')return rows.join(', ');
 if(format==='tail')return `${rows[1]} y ${rows[2]}, ${rows[0].replace(/^Por favor /,'')} en total, ${rows[3]}, ${rows[4]} y ${rows[5]}`;
 return `${rows[0]}: ${rows[1]} y ${rows[2]}, ${rows[3]}, ${rows[4]} y ${rows[5]}`;
}
for(const other of [false,true])for(const agent of [false,true])for(const words of [false,true])
 for(const format of ['colon','comma','semicolon','tail'])for(const choice of ['1','2']) {
 it(`compact total heading ${other}/${agent}/${words}/${format}/${choice}`,async()=>{
  const {h,request,ids,soups,base}=setup(other,agent);
  const compact=compactRequest(request,format,words);
  const reply=await h.sendQueued(compact);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.conv.sessionData.pendingCountedHeaderOrder?.units).toHaveLength(4);
  expect(reply).toContain('4 platos');expect(reply).toContain(soups[1]);
  await h.sendQueued('Sin ensaladas');
  await h.sendQueued(choice);
  const cart=h.conv.sessionData.cart;
  expect(cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4);
  expect(cart.filter(line=>line.productId===ids[0]).reduce((sum,line)=>sum+line.quantity,0)).toBe(3);
  expect(cart.every(line=>ids.includes(line.productId) && /sin ensaladas/i.test(line.note||'') && line.attributes?.some(attr=>attr.attributeValue===base))).toBe(true);
  expect(cart.find(line=>line.attributes?.some(attr=>attr.attributeValue===soups[1]))?.productId).toBe(ids[Number(choice)-1]);
  const before=structuredClone(cart);
  const repeat=await h.sendQueued(compact);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(repeat).toMatch(/ya está|no añadí/i);
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);
  expect(items.every(item=>ids.includes(item.productId) && /sin ensaladas/i.test(item.note||''))).toBe(true);
  expect(items.filter(item=>item.attributes.some(attr=>attr.attributeValue===soups[1]))).toHaveLength(1);
 });
}
for(const other of [false,true])for(const agent of [false,true])
 for(const scenario of ['total','soup-total','unknown-style','unknown-shared','stock','stale','cancel','quote']) {
 it(`compact heading guard ${other}/${agent}/${scenario}`,async()=>{
  const {h,request,ids,menu}=setup(other,agent);
  let input=compactRequest(request,'colon',false);
  if(scenario==='total') input=input.replace('4 ','5 ');
  if(scenario==='soup-total') input=input.replace('3 ajiacos','2 ajiacos').replace('3 tomates','2 tomates');
  if(scenario==='unknown-style') input=input.replace('1 broster','1 inventado').replace('1 ahumado','1 inventado');
  if(scenario==='unknown-shared') input=input.replace('Pierna pernil todos','salsa lunar todos').replace('Arroz todos','salsa lunar todos');
  if(scenario==='quote') input=`¿Cuánto valen ${input}?`;
  await h.sendQueued(input);
  if(['total','soup-total','unknown-style','unknown-shared','quote'].includes(scenario)) {
   expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
  }
  expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeTruthy();
  if(scenario==='stock')menu.find(product=>product.id===ids[1])!.availableNow=false;
  if(scenario==='stale')h.conv.sessionData.cart.push({productId:999,code:999,name:'Plato previo',quantity:1,unitPrice:10000});
  const before=structuredClone(h.conv.sessionData.cart);
  const reply=await h.sendQueued(scenario==='cancel'?'cancelar pedido':'2');
  expect(h.conv.sessionData.cart).toEqual(scenario==='cancel'?[]:before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(scenario==='stock')expect(reply).toMatch(/disponible/i);
  else expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeFalsy();
 });
}
for(const other of [false,true])for(const agent of [false,true]) {
 it(`literal short heading preserves the preparation split ${other}/${agent}`,async()=>{
  const {h,ids}=setup(other,agent);
  const reply=await h.sendQueued(other?'4 bowls: 3 asados y 1 ahumado':'4 ejecutivos: 3 fritos y 1 broster');
  const cart=h.conv.sessionData.cart;
  if(cart.length) {
   expect(cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4);
   expect(cart.filter(line=>line.productId===ids[0]).reduce((sum,line)=>sum+line.quantity,0)).toBe(3);
   expect(cart.filter(line=>line.productId===ids[1]).reduce((sum,line)=>sum+line.quantity,0)).toBe(1);
  } else expect(reply).toMatch(/faltan opciones|indícalas junto con cada plato/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
