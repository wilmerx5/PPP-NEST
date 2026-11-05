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

for (const other of [false,true]) for (const agent of [false,true]) for (const repeat of [false,true]) for (const choice of ['1','2']) {
 it(`fragmented allocation ${other}/${agent}/${repeat}/${choice}`,async()=>{
  const {h,ids,soups}=setup(other,agent);
  await h.sendQueued(other?'4 bowls: 3 asados y 1 ahumado':'4 ejecutivos: 3 fritos y 1 broster');
  const partial=other?'3 tomates':'3 ajiacos';
  const response=await h.sendQueued(partial);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.conv.sessionData.pendingCountedHeaderOrder?.allocations[0]?.counts).toEqual([{value:soups[0],quantity:3}]);
  expect(response).toMatch(/falta.*1/i);
  if(repeat) await h.sendQueued(partial);
  await h.sendQueued(other?'una lentejas':'una menudencia');
  expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued(choice);
  const cart=h.conv.sessionData.cart;
  expect(cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4);
  expect(cart.filter(line=>line.productId===ids[0]).reduce((sum,line)=>sum+line.quantity,0)).toBe(3);
  expect(cart.find(line=>line.attributes?.some(a=>a.attributeValue===soups[1]))?.productId).toBe(ids[Number(choice)-1]);
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;
  expect(items).toHaveLength(4);
  expect(items.filter(item=>item.attributes.some(a=>a.attributeValue===soups[1]))).toHaveLength(1);
 });
}

for (const other of [false,true]) for (const agent of [false,true]) for (const interruption of ['sí','2','¿cuánto vale?','overflow','unknown','cancel','note']) {
 it(`fragmented allocation guard ${other}/${agent}/${interruption}`,async()=>{
  const {h,soups}=setup(other,agent);
  await h.sendQueued(other?'4 bowls: 3 asados y 1 ahumado':'4 ejecutivos: 3 fritos y 1 broster');
  await h.sendQueued(other?'3 tomates':'3 ajiacos');
  const input=interruption==='overflow'?(other?'2 lentejas':'2 menudencias'):interruption==='unknown'?'una sopa lunar':interruption==='cancel'?'cancelar pedido':interruption==='note'?'Sin ensaladas':interruption;
  await h.sendQueued(input);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(interruption==='cancel') {expect(h.conv.sessionData.pendingCountedHeaderOrder).toBeFalsy();return;}
  expect(h.conv.sessionData.pendingCountedHeaderOrder?.allocations[0]?.counts).toEqual([{value:soups[0],quantity:3}]);
  await h.sendQueued(other?'una lentejas':'una menudencia');
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4);
  if(interruption==='note')expect(h.conv.sessionData.cart.every(line=>/sin ensaladas/i.test(line.note||''))).toBe(true);
 });
}
