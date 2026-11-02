import { applyLocalGlossary } from './whatsapp-local-glossary';
import {harness} from './whatsapp-accuracy.test-support';
for(const names of [['Bagre Sudado','Sobrebarriga Asada','Sopa De Menudencias','Sopa De Ajiaco'],['Bowl Vegetal','Pasta Del Huerto','Sopa De Lentejas','Crema De Tomate']])for(const agent of [false,true])for(const burst of [false,true]) {
 it(`consecutive purchases ${names[0]} agent=${agent} burst=${burst}`,async()=>{
  const menu=names.map((name,i)=>({id:96501+i,code:i+1,name,price:10000+i*1000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h=harness(menu,agent);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:341,dailyOrderNumber:341});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  const messages=[`Un ${names[0]}`,`Una ${names[1]} también por Fis`,`Una ${names[2]}`,`Y un ${names[3]}`];
  if(burst) {
   jest.useFakeTimers();
   try {
    const turns=messages.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`purchase-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
    await jest.advanceTimersByTimeAsync(4000);await Promise.all(turns);
   }finally{jest.useRealTimers();}
  }else for(const text of messages) await h.sendQueued(text);
  expect(h.conv.sessionData.orderType).toBe('pickup');
  expect(h.conv.sessionData.address).toBeUndefined();
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity]).sort()).toEqual(menu.map(p=>[p.id,1]).sort());
  expect(h.replies.join('\n')).not.toMatch(/(?:no encontr|no manej|no tenemos|aclarar)[^\n]*fis/i);
  for (const name of names) expect(h.replies.join('\n').toLowerCase()).toContain(name.toLowerCase());
  await h.sendQueued('no mas');await h.sendQueued('contraentrega');
  const receipt=await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId).sort()).toEqual(menu.map(p=>p.id).sort());
  expect(receipt).toContain('46.000');
 });
}
for(const name of ['Sobrebarriga Asada','Pasta Del Huerto']) it(`reject stale model repetition while buying ${name}`,async()=>{
 const h=harness([{id:96601,code:1,name:'Plato Previo',price:10000,hasAttributes:false,attributes:[],availableNow:true},{id:96602,code:2,name,price:11000,hasAttributes:false,attributes:[],availableNow:true}],true);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
 await h.sendQueued('Un Plato Previo');
 h.agent.runTurn.mockClear();
 h.agent.runTurn.mockResolvedValue({reply:'Listo, agregué ambos platos',actions:{addItems:[{productId:96601,quantity:1},{productId:96602,quantity:1}]},toolCalls:['add_item']});
 const reply=await h.sendQueued(`Una ${name} también por Fis`);
 expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
 expect(reply).not.toMatch(/agregué ambos/);
 expect(h.conv.sessionData.cart.find(line=>line.productId===96601)?.quantity).toBe(1);
 expect(h.conv.sessionData.cart.find(line=>line.productId===96602)?.quantity).toBe(1);
});

describe('courtesy boundaries',()=>{
 for(const spelling of ['por fis','por fi','porfis','porfi','por Fis','por favor']) {
  it(spelling,()=>{
   const normalized=applyLocalGlossary('una pasta '+spelling);
   expect(normalized).toBe('una pasta por favor');
   expect(applyLocalGlossary(normalized)).toBe(normalized);
  });
 }
 for(const text of ['helado de pistacho','por fisura','pescado por fisonomía','porfiado']) {
  it('preserves '+text,()=>expect(applyLocalGlossary(text)).toBe(text));
 }
});
