import { harness } from './whatsapp-accuracy.test-support';
import { writeFileSync } from 'fs';

for (const other of [false,true]) for(const agent of [false,true]) for(const quantities of [[2,3],[3,1]]) for(const noted of [false,true]) for(const drinks of [false,true]) for(const numeric of [false,true]) {
 it(`quoted options and quantities ${other} ${agent} ${quantities} ${noted} ${drinks} ${numeric}`,async()=>{
  const names=drinks ? (other?['Batido Natural','Smoothie Especial']:['Jugo En Agua','Jugo En Leche']) : (other?['Pasta Vegetal','Crema De Zapallo']:['Arroz Con Pollo','Sopa Del Dia']);
  const attributeName=drinks?'Sabor':'Bebida'; const options=drinks?['Mango','Lulo']:['Agua','Pepsi'];
  const notes=drinks?['sin azúcar','sin hielo']:['sin cebolla','sin cilantro'];
  const menu=names.map((name,i)=>({id:98601+i,code:871+i,name,price:20000+i*10000,availableNow:true,hasAttributes:true,attributes:[{attributeName,options}]}));
  const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:366,dailyOrderNumber:366});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  try {
   const quote=await h.sendQueued(`Cuánto cuestan ${quantities[0]} ${names[0]}${noted?' '+notes[0]:''} y ${quantities[1]} ${names[1]}${noted?' '+notes[1]:''}?`);
   expect(h.conv.sessionData.pendingAddOffer?.productIds).toEqual(menu.map(p=>p.id));
   expect(quote).toContain((quantities[0]*20000+quantities[1]*30000).toLocaleString('es-CO'));
   await h.sendQueued('sí');
   expect(h.conv.state).toBe('awaiting_attribute');
   expect(h.replies.at(-1)).toContain(names[0]);
   if(numeric) {await h.sendQueued('Me pasas el menú porfa');expect(h.conv.state).toBe('awaiting_attribute');}
   await h.sendQueued(numeric?'1':options[0]);
   if(drinks) {
    expect(h.conv.state).toBe('awaiting_attribute');
    expect(h.replies.at(-1)).toContain(names[1]);
    await h.sendQueued(numeric?'2':options[1]);
   }
   expect(h.conv.sessionData.cart).toHaveLength(2);
   for(let i=0;i<2;i++) {
    const line=h.conv.sessionData.cart.find(l=>l.productId===menu[i].id);
    expect(line).toMatchObject({quantity:quantities[i],unitPrice:menu[i].price});
    expect(line?.attributes).toContainEqual({attributeName,attributeValue:drinks&&i===1?options[1]:options[0]});
    if(noted){const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');expect(normalize(line?.note || '')).toContain(normalize(notes[i]));expect(normalize(line?.note || '')).not.toContain(normalize(notes[1-i]));}
   }
   await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const items=h.service.ordersService.create.mock.calls[0][0].items;
   expect(items).toHaveLength(quantities[0]+quantities[1]);
   for(let i=0;i<2;i++) {
    const units=items.filter(item=>item.productId===menu[i].id);
    expect(units).toHaveLength(quantities[i]);
    for(const unit of units) {
     expect(unit.attributes).toContainEqual({attributeName,attributeValue:drinks&&i===1?options[1]:options[0]});
     if(noted) expect(unit.note.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')).toContain(notes[i].normalize('NFD').replace(/[\u0300-\u036f]/g,''));
    }
   }
  } finally {writeFileSync(`/tmp/ppp-366-${other}-${agent}-${quantities}-${noted}-${drinks}-${numeric}.json`,JSON.stringify({replies:h.replies,session:h.conv.sessionData,state:h.conv.state},null,2));}
 });
}

for(const other of [false,true]) for(const agent of [false,true]) for(const explicit of ['first','second','both','three']) {
 it(`quoted preselected options ${other} ${agent} ${explicit}`,async()=>{
  const names=other?['Batido Natural','Smoothie Especial','Malteada Especial']:['Jugo En Agua','Jugo En Leche','Malteada Natural'];
  const menu=names.slice(0,explicit==='three'?3:2).map((name,i)=>({id:98611+i,code:881+i,name,price:10000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Sabor',options:['Mango','Lulo']}]}));
  const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:366,dailyOrderNumber:366});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const query=menu.map((p,i)=>`${i+1} ${p.name}${explicit==='both'||explicit==='first'&&i===0||explicit==='second'&&i===1 ? (i===1?' de Lulo':' de Mango'):''}`).join(' y ');
  await h.sendQueued(`Cuánto cuestan ${query}?`);
  expect(h.conv.sessionData.pendingAddOffer?.productIds).toEqual(menu.map(p=>p.id));
  await h.sendQueued('sí');
  const pending=explicit==='three'?[0,1,2]:explicit==='both'?[]:explicit==='first'?[1]:[0];
  for(const i of pending){expect(h.conv.state).toBe('awaiting_attribute');expect(h.conv.sessionData.pendingAttribute?.productId).toBe(menu[i].id);expect(h.replies.at(-1)).toContain(names[i]);await h.sendQueued(i===1?'Lulo':'Mango');}
  expect(h.conv.sessionData.cart).toHaveLength(menu.length);
  for(let i=0;i<menu.length;i++)expect(h.conv.sessionData.cart).toContainEqual(expect.objectContaining({productId:menu[i].id,quantity:i+1,attributes:[{attributeName:'Sabor',attributeValue:i===1?'Lulo':'Mango'}]}));
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
  await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(explicit==='three'?6:3);
 });
}
