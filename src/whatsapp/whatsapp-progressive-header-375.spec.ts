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
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:375,dailyOrderNumber:375});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 const request=other ? 'Por favor 4 bowls\n3 bowls asados\n1 ahumado\nArroz todos\n3 tomates\n1 lentejas' : 'Por favor 4 ejecutivos\n3 ejecutivos con frito\n1 broster\nPierna pernil todos\n3 ajiacos\n1 menudencias';
 return {h,menu,request,ids:other?[96401,96402]:[22,18],soups:other?['Tomate','Lentejas']:['Ajiaco','Menudencias'],base:other?'Arroz':'Pierna Pernil',total:other?'81.000':'97.000'};
}

for(const other of [false,true])for(const agent of [false,true])for(const words of [false,true])for(const choice of ['1','2']) {
 it(`progressive heading ${other}/${agent}/${words}/${choice}`,async()=>{
  const {h,ids,soups,base}=setup(other,agent);
  let heading=other?'4 bowls: 3 asados y 1 ahumado':'4 ejecutivos: 3 fritos y 1 broster';
  if(words)heading=heading.replace('4 ','cuatro ').replace('3 ','tres ').replace('1 ','uno ');
  const first=await h.sendQueued(heading);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.conv.sessionData.pendingCountedHeaderOrder?.units).toHaveLength(4);
  expect(first).toMatch(/conservo.*4|4.*platos/i);
  const reply=await h.sendQueued(other?'todos arroz, 3 tomates y una lentejas':'todos pierna pernil, 3 ajiacos y una menudencia');
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(reply).toContain(soups[1]);
  await h.sendQueued('Sin ensaladas');await h.sendQueued(choice);
  const cart=h.conv.sessionData.cart;
  expect(cart.reduce((s,l)=>s+l.quantity,0)).toBe(4);
  expect(cart.filter(l=>l.productId===ids[0]).reduce((s,l)=>s+l.quantity,0)).toBe(3);
  expect(cart.every(l=>l.attributes?.some(a=>a.attributeValue===base)&&/sin ensaladas/i.test(l.note||''))).toBe(true);
  expect(cart.find(l=>l.attributes?.some(a=>a.attributeValue===soups[1]))?.productId).toBe(ids[Number(choice)-1]);
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);
  expect(items.filter(item=>item.productId===ids[0])).toHaveLength(3);
  expect(items.every(item=>/sin ensaladas/i.test(item.note||''))).toBe(true);
  expect(items.filter(item=>item.attributes.some(a=>a.attributeValue===soups[1]))).toHaveLength(1);
 });
}
for(const other of [false,true])for(const agent of [false,true])for(const bad of ['confirmar','sí','salsa lunar todos','3 ajiacos y 2 menudencias','cancelar pedido','stale','stock','repeat']) {
 it(`progressive guard ${other}/${agent}/${bad}`,async()=>{
  const {h,ids,menu}=setup(other,agent);
  const heading=other?'4 bowls: 3 asados y 1 ahumado':'4 ejecutivos: 3 fritos y 1 broster';
  await h.sendQueued(heading);expect(h.conv.sessionData.pendingCountedHeaderOrder?.units).toHaveLength(4);
  if(bad==='stale')h.conv.sessionData.cart.push({productId:999,name:'Previo',code:999,quantity:1,unitPrice:10000});
  if(bad==='stock')menu.find(p=>p.id===ids[0])!.availableNow=false;
  const before=structuredClone(h.conv.sessionData.cart);
  let input=bad==='repeat'?heading:bad;
  if(other && bad==='3 ajiacos y 2 menudencias')input='3 tomates y 2 lentejas';
  if(bad==='stock')input=other?'todos arroz, 3 tomates y una lentejas':'todos pierna pernil, 3 ajiacos y una menudencia';
  await h.sendQueued(input);
  if(bad==='stock')await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual(bad==='cancelar pedido'?[]:before);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(['stale','cancelar pedido'].includes(bad))expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeFalsy();
  else expect(h.conv.sessionData.pendingCountedHeaderOrder?.units).toHaveLength(4);
 });
}

for(const other of [false,true])for(const agent of [false,true])for(const intermediate of ['Sin ensaladas','salsa lunar todos','sí','¿cuánto vale?']) {
 it(`progressive recovery ${other}/${agent}/${intermediate}`,async()=>{
  const {h,ids,soups}=setup(other,agent);
  await h.sendQueued(other?'4 bowls: 3 asados y 1 ahumado':'4 ejecutivos: 3 fritos y 1 broster');
  await h.sendQueued(intermediate);
  expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued(other?'todos arroz, 3 tomates y una lentejas':'todos pierna pernil, 3 ajiacos y una menudencia');
  await h.sendQueued('2');
  const cart=h.conv.sessionData.cart;
  expect(cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4);
  expect(cart.filter(line=>line.productId===ids[0]).reduce((sum,line)=>sum+line.quantity,0)).toBe(3);
  expect(cart.filter(line=>line.attributes?.some(a=>a.attributeValue===soups[1])).reduce((sum,line)=>sum+line.quantity,0)).toBe(1);
  if(intermediate==='Sin ensaladas')expect(cart.every(line=>/sin ensaladas/i.test(line.note||''))).toBe(true);
  else expect(cart.every(line=>!line.note)).toBe(true);
 });
}
