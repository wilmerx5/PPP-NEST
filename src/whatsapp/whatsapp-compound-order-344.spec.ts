import { harness, products } from './whatsapp-accuracy.test-support';
for (const other of [false,true]) for (const agent of [false,true]) for(const separator of [',',' con']) for(const burst of [false,true]) {
 it(`single dish without drink ${other}/${agent}/${separator}/burst=${burst}`,async()=>{
  const menu=other ? [
   {id:97101,code:1,name:'Pasta',price:18000},
   {id:97102,code:2,name:'Setas Del Bosque',price:9000},
   {id:97103,code:3,name:'Pasta Con Setas Del Bosque',price:23000},
   {id:97104,code:4,name:'Combo Pasta Con Setas Del Bosque',price:27000},
  ].map(p=>({...p,availableNow:true,hasAttributes:false,attributes:[]})) : structuredClone(products);
  const h=harness(menu,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:344,dailyOrderNumber:344});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const name=other?'Pasta Con Setas Del Bosque':'Arroz Chino Con Costillas De Cerdo';
  const request=`Buen día, por favor un ${other?'pasta':'arroz chino'}${separator} ${other?'setas del bosque':'costillas de cerdo'} y sin gaseosa.`;
  if(burst) {
   jest.useFakeTimers();
   try {
    const pending=[request,'Pago con nequi'].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'compound-'+i,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
    await jest.advanceTimersByTimeAsync(4000);await Promise.all(pending);
   } finally {jest.useRealTimers();}
  } else await h.sendQueued(request);
  const reply=h.replies.join('\n');
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[other?97103:84,1]]);
  expect(reply).toContain(name);
  expect(h.conv.sessionData.cart[0].note).toMatch(/sin gaseosa/i);
  if(!burst) await h.sendQueued('Pago con nequi');
  await h.sendQueued('no mas');
  const receipt=await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(1);
  expect(dto.items[0]).toMatchObject({productId:other?97103:84,note:expect.stringMatching(/sin gaseosa/i)});
  expect(receipt).toContain(other?'23.000':'48.000');
 });
}

describe('compound request boundaries',()=>{
 const {canonicalCompoundDishRequest:parse}=require('./whatsapp-compound-dish-request');
 const menu=[{name:'Arroz Chino'},{name:'Costillas De Cerdo'},{name:'Arroz Chino Con Costillas De Cerdo'},{name:'Combo Arroz Chino Con Costillas De Cerdo'}];
 for(const text of [
  'un arroz chino y una costillas de cerdo sin gaseosa',
  'un arroz chino, dos costillas de cerdo sin gaseosa',
  'un arroz chino, costillas de cerdo aparte sin gaseosa',
  'un arroz chino, costillas de cerdo separados sin gaseosa',
  '¿un arroz chino, costillas de cerdo sin gaseosa?',
  'no quiero un arroz chino, costillas de cerdo sin gaseosa',
  'un arroz chino, costillas de cerdo si hay sin gaseosa',
  'un combo arroz chino, costillas de cerdo sin gaseosa',
  'un arroz chino, costillas de cerdo',
  '0 arroz chino, costillas de cerdo sin gaseosa',
 ]) it('does not infer composition '+text,()=>expect(parse(text,menu)).toBeNull());
 it('keeps explicit count',()=>expect(parse('dos arroz chino, costillas de cerdo sin gaseosa',menu)).toBe('2 Arroz Chino Con Costillas De Cerdo sin gaseosa'));
 it('does not choose ambiguous catalog prefixes',()=>expect(parse('un arroz chino, costillas sin gaseosa',[...menu,{name:'Arroz Chino Con Costillas Ahumadas'}])).toBeNull());
 it('does not invent a product absent from catalog',()=>expect(parse('un arroz chino, costillas de cerdo sin gaseosa',menu.slice(0,2))).toBeNull());
});
for(const agent of [false,true]) it('explicit independent purchases '+agent,async()=>{
 const h=harness(structuredClone(products),agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 await h.sendQueued('un arroz chino y una costillas de cerdo sin gaseosa');
 expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity]).sort()).toEqual([[26,1],[60,1]]);
});
