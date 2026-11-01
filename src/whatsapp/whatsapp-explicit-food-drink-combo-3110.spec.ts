import {harness} from './whatsapp-accuracy.test-support';
for(const dish of ['Pollo Broaster','Pescado Frito'])for(const agent of [false,true])for(const mode of ['plain','repeat','checkout','unavailable','ambiguous_combo','ambiguous_drink','named_drink','extra_quantity','drink_note','wrong_volume','incompatible','side','limit','unknown_drink']) {
 it(`${dish} replaces explicitly removed food and drink with combo ${mode} agent=${agent}`,async()=>{
  const menu=[{id:95701,code:1,name:`1 ${dish}`,price:46000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Arepas',options:['Blancas','Fritas']}]},{id:95702,code:2,name:`Combo De ${dish}`,price:55000,description:'Incluye bebida de 1.5L',availableNow:true,hasAttributes:true,attributes:[{attributeName:'Arepas',options:['Blancas','Fritas']},{attributeName:'Bebida',options:['Coca Cola','Colombiana']}]},{id:95703,code:3,name:'Coca Cola 1.5L',price:8500,categoryName:'Bebidas',availableNow:true,hasAttributes:false,attributes:[]}];
  menu.push({id:95704,code:4,name:'Agua Mineral',price:4000,categoryName:'Bebidas',availableNow:true,hasAttributes:false,attributes:[]});
  const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  await h.sendQueued(`un ${dish}`);await h.sendQueued('una Coca Cola 1.5L');
  expect(h.conv.sessionData.cart.map(line=>line.productId)).toEqual([95701,95703]);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:333,dailyOrderNumber:333});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.conv.sessionData.cart[0].note='Salsa aparte';h.conv.sessionData.cart[0].attributes=[{attributeName:'Arepas',attributeValue:'Fritas'}];
  if(mode==='unavailable') menu[1].availableNow=false;
  if(mode==='ambiguous_combo') menu.push({...menu[1],id:95705});
  if(['ambiguous_drink','named_drink'].includes(mode)) await h.sendQueued('un Agua Mineral');
  if(mode==='extra_quantity') h.conv.sessionData.cart[1].quantity=2;
  if(mode==='drink_note') h.conv.sessionData.cart[1].note='Para Ana';
  if(mode==='incompatible') menu[1].attributes[0].options=['Blancas'];
  if(mode==='side'){menu.push({id:95706,code:6,name:'Sopa De Ajiaco',price:10000,availableNow:true,hasAttributes:false,attributes:[]});await h.sendQueued('una Sopa De Ajiaco');}
  if(mode==='checkout'){await h.sendQueued('no mas');await h.sendQueued('contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');}
  if(mode==='limit') Object.assign(h.cfg,{maxOrderAmount:55000});
  const before=structuredClone(h.conv.sessionData.cart);
  const message=`elimina el ${dish.split(' ')[0]} y la ${mode==='named_drink'?'Coca Cola 1.5L':'agseosa'} y dame un combo de ${dish} con ${mode==='unknown_drink'?'Fanta':'coca cola'} ${mode==='wrong_volume'?'400 ml':'1.5 litros'}`;
  const reply=await h.sendQueued(message);
  if(['unavailable','ambiguous_combo','ambiguous_drink','extra_quantity','drink_note','wrong_volume','incompatible','unknown_drink'].includes(mode)){expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/sigue igual/);expect(h.service.ordersService.create).not.toHaveBeenCalled();return;}

  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[95702,1],...(mode==='named_drink'?[[95704,1]]:mode==='side'?[[95706,1]]:[])]);expect(reply).toMatch(/combo/i);
  expect(h.conv.sessionData.cart[0].note).toBe('Salsa aparte');expect(h.conv.sessionData.cart[0].attributes).toEqual(expect.arrayContaining([{attributeName:'Arepas',attributeValue:'Fritas'},{attributeName:'Bebida',attributeValue:'Coca Cola'}]));
  if(mode==='repeat'){const converted=structuredClone(h.conv.sessionData.cart);await h.sendQueued(message);expect(h.conv.sessionData.cart).toEqual(converted);}
  if(mode==='checkout'){expect(h.conv.state).toBe('awaiting_final_confirm');expect(reply).toMatch(/confirmar/i);}else{await h.sendQueued('no mas');await h.sendQueued('contraentrega');}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([95702,...(mode==='named_drink'?[95704]:mode==='side'?[95706]:[])]);expect(receipt).toContain(mode==='named_drink'?'59.000':mode==='side'?'65.000':'55.000');
 });
}
