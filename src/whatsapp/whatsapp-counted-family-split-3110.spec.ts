import {harness} from './whatsapp-accuracy.test-support';
for(const family of ['Pollo','Pescado'])for(const agent of [false,true])for(const mode of ['plain','price','unavailable','repeat']) {
 it(`${family}: preserve two-unit split after family choice; ${mode}; agent=${agent}`,async()=>{
  const menu=['Frito','Broaster'].map((style,i)=>({id:95501+i,code:i+1,name:`1 ${family} ${style}`,price:44000+i*2000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Arepas',options:['Blancas','Fritas','Sin arepas']}]}));
  const h=harness(menu,agent);
  h.cfg.ignoreBusinessHours=false;
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:331,dailyOrderNumber:331});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued(`Para pedir dos ${family.toLowerCase()}s`);
  expect(h.conv.sessionData.address).toBeFalsy();
  if(mode==='price') { const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('cuanto cuesta el broaster?');expect(h.conv.sessionData.cart).toEqual(before); }
  if(mode==='unavailable') menu[1].availableNow=false;
  const reply=await h.sendQueued('Uno frito y uno broaster');
  if(mode==='unavailable') {expect(h.conv.sessionData.cart).toEqual([]);expect(reply).toMatch(/disponible|igual/);return;}
  expect(h.conv.sessionData.cart.map(row=>[row.productId,row.quantity])).toEqual([[95501,1],[95502,1]]);
  expect(reply).not.toMatch(/pídelos uno|dime primero el número/i);
  expect(h.conv.sessionData.pendingMatch).toBeUndefined();
  expect(h.conv.sessionData.cart.every(row=>row.attributes?.some(a=>a.attributeName==='Arepas'&&a.attributeValue==='Blancas'))).toBe(true);
  if(mode==='repeat') {const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`Es uno con ${family.toLowerCase()} frito y otro con ${family.toLowerCase()} broaster`);expect(h.conv.sessionData.cart).toEqual(before);}
  await h.sendQueued('no mas');await h.sendQueued('contraentrega');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const receipt=await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.map(i=>i.productId)).toEqual([95501,95502]);
  expect(receipt).toContain('90.000');
 });
}
