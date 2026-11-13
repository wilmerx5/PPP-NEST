import {harness} from './whatsapp-accuracy.test-support';
const requests=[
 {prefix:'me regalas una',suffix:'',quantity:1},
 {prefix:'dame dos',suffix:'',quantity:2},
 {prefix:'agrega tres',suffix:' porfa',quantity:3},
 {prefix:'una',suffix:', porfa',quantity:1},
 {prefix:'una',suffix:',porfa',quantity:1},
 {prefix:'una',suffix:', por fa',quantity:1},
 {prefix:'una',suffix:', porfavor',quantity:1},
 {prefix:'me das una',suffix:' por favor',quantity:1},
 {prefix:'quiero dos',suffix:' porfa',quantity:2},
];
for(const name of ['Limonada','Jugo','Gaseosa']) for(const agent of [false,true])
for(const existing of [false,true]) for(const ambiguous of [false,true]) for(const request of requests) {
 test(`${name}/${agent}/${existing}/${ambiguous}/${request.prefix}${request.suffix}: colloquial drink journey closes exactly`,async()=>{
  const h=setup(name,agent,ambiguous?'ambiguous':'normal');
  if(existing) await h.sendQueued('una Sopa Vegetal');
  const cart=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`${request.prefix} ${name}${request.suffix}`);
  if(ambiguous){
   expect(h.conv.sessionData.cart).toEqual(cart);
   expect(h.conv.sessionData.pendingMatch?.quantity).toBe(request.quantity);
   await h.sendQueued('2');
  }
  const id=ambiguous?95203:95201,price=ambiguous?7000:5000;
  expect(h.cartRows().find(row=>row.id===id)?.qty).toBe(request.quantity);
  await h.sendQueued('no más, recojo en el local');await h.sendQueued('efectivo');
  expect(h.replies.at(-1)).toContain((request.quantity*price+(existing?10000:0)).toLocaleString('es-CO'));
  await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(request.quantity+(existing?1:0));
 });
}
function setup(name:string,agent:boolean,mode='normal'){
 const h=harness([
  {id:95201,code:1,name:mode==='ambiguous'?`${name} Natural`:name,price:5000,availableNow:mode!=='unavailable',categoryName:'Bebidas',hasAttributes:mode==='flavor',attributes:mode==='flavor'?[{attributeName:'Sabor',options:['Mango','Lulo']}]:[]},
  ...(mode==='ambiguous'?[{id:95203,code:3,name:`${name} Especial`,price:7000,availableNow:true,categoryName:'Bebidas',attributes:[]}]:[]),
  {id:95202,code:2,name:'Sopa Vegetal',price:10000,availableNow:true,categoryName:'Sopas',attributes:[]},
 ],agent);
 h.cfg.ignoreBusinessHours=false;
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:512,dailyOrderNumber:512});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 return h;
}
