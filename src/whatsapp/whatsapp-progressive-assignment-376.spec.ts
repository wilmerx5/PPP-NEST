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


for(const agent of [false,true])for(const choice of ['1','2'])for(const note of [false,true]) {
 it(`keep resolved soup while correcting default base ${agent}/${choice}/${note}`,async()=>{
  const {h,ids,soups}=setup(true,agent);
  await h.sendQueued('4 bowls: 3 asados y 1 ahumado');
  await h.sendQueued('3 tomates y una lentejas');
  if(note)await h.sendQueued('Sin ensaladas');
  await h.sendQueued(choice);
  expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4);
  await h.sendQueued('todos con quinoa');
  const cart=h.conv.sessionData.cart;
  expect(cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(4);
  expect(cart.find(line=>line.attributes?.some(a=>a.attributeValue===soups[1]))?.productId).toBe(ids[Number(choice)-1]);
  expect(cart.every(line=>line.attributes?.some(a=>a.attributeName==='Base' && a.attributeValue==='Quinoa'))).toBe(true);
  if(note)expect(cart.every(line=>/sin ensaladas/i.test(line.note||''))).toBe(true);
 });
}
