import {harness} from './whatsapp-accuracy.test-support';
for(const family of ['Pollo','Pescado'])for(const agent of [false,true]) {
 const menu=()=>['Frito','Broaster'].flatMap((style,i)=>[false,true].map(combo=>({id:95600+i*2+Number(combo),code:10+i*2+Number(combo),name:combo?`Combo De ${family} ${style}`:`1 ${family} ${style}`,price:combo?50000:40000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Arepas',options:['Blancas','Fritas']},...(combo?[{attributeName:'Bebida',options:['Colombiana','Ginger']}]:[])]})));
 const setup=()=>{const products=menu();const h=harness(products,agent);h.cfg.ignoreBusinessHours=false;h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});h.service.ordersService.create=jest.fn().mockResolvedValue({id:332,dailyOrderNumber:332});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);return {h,products};};
 it(`${family} repair existing wrong split agent=${agent}`,async()=>{const {h}=setup();await h.sendQueued(`dos ${family.toLowerCase()}s fritos`);expect(h.conv.sessionData.cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(2);await h.sendQueued(`no, quiero un ${family.toLowerCase()} frito y un ${family.toLowerCase()} broaster`);expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[95600,1],[95602,1]]);});
 it(`${family} both to combo agent=${agent}`,async()=>{const {h}=setup();await h.sendQueued(`un ${family.toLowerCase()} frito`);await h.sendQueued(`un ${family.toLowerCase()} broaster`);expect(h.conv.sessionData.cart.map(line=>line.productId)).toEqual([95600,95602]);const reply=await h.sendQueued(`Que sean ambos ${family.toLowerCase()}s en combo porfa`);expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[95601,1],[95603,1]]);expect(reply).toMatch(/combo/i);});
 for(const mode of ['repeat','unavailable','ambiguous','incompatible','checkout','notes']) it(`${family} paired conversion ${mode} agent=${agent}`,async()=>{
  const {h,products}=setup();
  await h.sendQueued(`un ${family.toLowerCase()} frito`);await h.sendQueued(`un ${family.toLowerCase()} broaster`);
  // Existing per-line customizations must survive a collective product replacement.
  h.conv.sessionData.cart[0].attributes=[{attributeName:'Arepas',attributeValue:'Fritas'}];
  h.conv.sessionData.cart[0].note='Salsa aparte';h.conv.sessionData.cart[1].note='Bien caliente';
  const before=structuredClone(h.conv.sessionData.cart);
  if(mode==='unavailable') products[3].availableNow=false;
  if(mode==='ambiguous') products.push({...products[3],id:95610});
  if(mode==='incompatible') products[3].attributes[0].options=['Sin arepas'];
  if(mode==='checkout') {await h.sendQueued('no mas');await h.sendQueued('contraentrega');expect(h.conv.state).toBe('awaiting_final_confirm');}
  const reply=await h.sendQueued(`Que sean ambos ${family.toLowerCase()}s en combo porfa`);
  if(['unavailable','ambiguous','incompatible'].includes(mode)) {expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/sigue igual/);expect(h.service.ordersService.create).not.toHaveBeenCalled();return;}
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[95601,1],[95603,1]]);
  expect(h.conv.sessionData.cart.map(line=>line.note)).toEqual(['Salsa aparte','Bien caliente']);
  expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Arepas',attributeValue:'Fritas'});
  if(mode==='repeat') {const converted=structuredClone(h.conv.sessionData.cart);await h.sendQueued(`Que sean ambos ${family.toLowerCase()}s en combo porfa`);expect(h.conv.sessionData.cart).toEqual(converted);}
  if(mode==='checkout') {expect(h.conv.state).toBe('awaiting_final_confirm');expect(reply).toMatch(/confirmar/i);}
  else {await h.sendQueued('no mas');await h.sendQueued('contraentrega');}
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  const receipt=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items.map(i=>i.productId)).toEqual([95601,95603]);expect(receipt).toContain('100.000');
 });
 for(const mode of ['full','unavailable','repeat','incompatible']) it(`${family} repair then combo ${mode} agent=${agent}`,async()=>{
  const {h,products}=setup();await h.sendQueued(`dos ${family.toLowerCase()}s fritos`);
  h.conv.sessionData.cart[0].note='Salsa aparte';h.conv.sessionData.cart[0].attributes=[{attributeName:'Arepas',attributeValue:'Fritas'}];
  const before=structuredClone(h.conv.sessionData.cart);
  if(mode==='unavailable') products[2].availableNow=false;
  if(mode==='incompatible') products[2].attributes[0].options=['Blancas'];
  const message=`no, quiero un ${family.toLowerCase()} frito y un ${family.toLowerCase()} broaster`;
  const reply=await h.sendQueued(message);
  if(['unavailable','incompatible'].includes(mode)){expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/sigue igual/);return;}
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[95600,1],[95602,1]]);
  if(mode==='repeat'){const repaired=structuredClone(h.conv.sessionData.cart);await h.sendQueued(message);expect(h.conv.sessionData.cart).toEqual(repaired);}
  await h.sendQueued(`Que sean ambos ${family.toLowerCase()}s en combo porfa`);
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[95601,1],[95603,1]]);
  expect(h.conv.sessionData.cart.every(line=>line.note==='Salsa aparte' && line.attributes?.some(attr=>attr.attributeValue==='Fritas'))).toBe(true);
  await h.sendQueued('no mas');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items.map(i=>i.productId)).toEqual([95601,95603]);
 });
}
