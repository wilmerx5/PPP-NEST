import {harness} from './whatsapp-accuracy.test-support';
for(const dish of ['Pollo Broaster','Bowl Vegetal'])for(const agent of [false,true])for(const mode of ['plain','repeat','checkout','multiple','named','pending_drink','only_drink','unavailable','accept','accept_yes']) {
 it(`${dish} combo inquiry after drink ${mode} agent=${agent}`,async()=>{
  const menu=[{id:95801,code:1,name:dish,price:30000,availableNow:true,hasAttributes:false,attributes:[]},{id:95802,code:2,name:`Combo De ${dish}`,price:35000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Coca Cola']}]},{id:95803,code:3,name:'Coca Cola 1.5L',price:8500,categoryName:'Bebidas',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Original','Zero']}]}];
  menu.push({id:95804,code:4,name:'Sopa De Ajiaco',price:10000,availableNow:true,hasAttributes:false,attributes:[]});
  const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:334,dailyOrderNumber:334});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  if(mode!=='only_drink') await h.sendQueued(`un ${dish}`);
  if(['multiple','named'].includes(mode)) await h.sendQueued('una Sopa De Ajiaco');
  await h.sendQueued('una Coca Cola 1.5L');if(mode!=='pending_drink') await h.sendQueued('Original');
  if(mode==='unavailable') menu[1].availableNow=false;
  if(mode==='checkout'){await h.sendQueued('no mas');await h.sendQueued('contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');}

  const before=structuredClone(h.conv.sessionData.cart);
  const pending=structuredClone(h.conv.sessionData.pendingAttribute);
  const question=mode==='named'?`hay combo de ${dish} con gaseosa?`:'o hay combo con gaseosa?';
  const reply=await h.sendQueued(question);
  expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(['multiple','only_drink'].includes(mode)){expect(reply).toMatch(/cu[aá]l plato/i);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingMatch).toBeUndefined();return;}
  if(mode==='unavailable'){expect(reply).not.toContain(`Combo De ${dish}`);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();return;}
  if(mode==='pending_drink'){expect(reply).toContain(`Combo De ${dish}`);expect(h.conv.sessionData.pendingAttribute).toEqual(pending);await h.sendQueued('Original');expect(h.conv.sessionData.cart.map(line=>line.productId)).toEqual([95801,95803]);}
  else {
  expect(reply).toContain(`Combo De ${dish}`);expect(reply).toMatch(/bebida.*aparte/i);expect(reply).not.toMatch(/(?:qué|que) sabor/i);expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
  }
  if(mode==='repeat'){await h.sendQueued(question);expect(h.conv.sessionData.cart).toEqual(before);}
  if(['accept','accept_yes'].includes(mode)){await h.sendQueued(mode==='accept_yes'?'si':'en combo');expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(95802);await h.sendQueued('Colombiana');expect(h.conv.sessionData.cart.map(line=>line.productId)).toEqual([95802,95803]);}
  else if(h.conv.sessionData.pendingMatch?.replacement){await h.sendQueued('no gracias');expect(h.conv.sessionData.cart).toEqual(before);}
  if(mode==='checkout') expect(h.conv.state).toBe('awaiting_final_confirm');
  else {await h.sendQueued('no mas');await h.sendQueued('contraentrega');}
  const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([['accept','accept_yes'].includes(mode)?95802:95801,...(mode==='named'?[95804]:[]),95803]);
  expect(receipt).toContain(['accept','accept_yes'].includes(mode)?'43.500':mode==='named'?'48.500':'38.500');
 });
}
