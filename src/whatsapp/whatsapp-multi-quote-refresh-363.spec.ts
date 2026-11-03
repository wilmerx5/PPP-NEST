import {harness} from './whatsapp-accuracy.test-support';
async function setup(other:boolean,agent:boolean){
 const names=other?['Pasta Vegetal','Crema De Zapallo']:['Arroz Con Pollo','Sopa Del Dia'];
 const menu=names.map((name,i)=>({id:98401+i,code:841+i,name,price:20000+i*10000,availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn().mockResolvedValue({id:363,dailyOrderNumber:363});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 await h.sendQueued(`Cuánto cuesta ${names.join(' y ')}?`);expect(h.conv.sessionData.pendingAddOffer?.productIds).toEqual([98401,98402]);return {h,menu};
}
for(const other of [false,true])for(const agent of [false,true]){
 for(const index of [0,1]){
  for(const delta of [-2000,3000])for(const accept of [false,true])it(`multi price change ${other} ${agent} ${index} ${delta} ${accept}`,async()=>{
   const {h,menu}=await setup(other,agent);const current=structuredClone(menu);current[index].price+=delta;h.service.catalogService.getMenuProducts.mockResolvedValue(current);
   const reply=await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);expect(reply).toContain(menu[index].name);expect(reply).toMatch(/precio.*cambi|cambi.*precio/i);expect(reply).toContain(String(current[index].price/1000)+'.000');
   await h.sendQueued('Me pasas el menú porfa');expect(h.conv.sessionData.cart).toEqual([]);await h.sendQueued(accept?'sí':'no');expect(h.conv.sessionData.cart).toHaveLength(accept?2:0);
   if(accept){for(const p of current)expect(h.conv.sessionData.cart).toContainEqual(expect.objectContaining({productId:p.id,unitPrice:p.price,quantity:1}));await h.sendQueued('no más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(2);}
  });
  for(const removed of [false,true])it(`multi unavailable blocks partial add ${other} ${agent} ${index} ${removed}`,async()=>{
   const {h,menu}=await setup(other,agent);const current=structuredClone(menu);current[index].availableNow=false;h.service.catalogService.getMenuProducts.mockResolvedValue(removed?current.filter((_,i)=>i!==index):current);
   const reply=await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);expect(reply).toContain(menu[index].name);expect(reply).toMatch(/no.*disponible|no.*carta/i);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued(`Quiero ${menu[1-index].name}`);expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual([menu[1-index].id]);
  });
 }
 it(`unchanged multi quote ${other} ${agent}`,async()=>{const {h}=await setup(other,agent);await h.sendQueued('sí');expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual([98401,98402]);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();});
 it(`legacy quote requires new review ${other} ${agent}`,async()=>{
  const {h}=await setup(other,agent);delete (h.conv.sessionData.pendingAddOffer as any).quotedProducts;
  const reply=await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);expect(reply).toMatch(/cotizaci[oó]n|precio/i);await h.sendQueued('sí');expect(h.conv.sessionData.cart).toHaveLength(2);
 });
}
for(const other of [false,true])for(const agent of [false,true]){
 for(const unavailable of [false,true])it(`multi changes again before accepting ${other} ${agent} ${unavailable}`,async()=>{
  const {h,menu}=await setup(other,agent);const current=structuredClone(menu);current[0].price=22000;h.service.catalogService.getMenuProducts.mockResolvedValue(current);await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);
  const again=structuredClone(current);again[1].price=35000;again[1].availableNow=!unavailable;h.service.catalogService.getMenuProducts.mockResolvedValue(again);
  const reply=await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(unavailable){expect(reply).toContain(menu[1].name);expect(reply).toMatch(/no.*disponible/i);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();}
  else{expect(reply).toContain('35.000');await h.sendQueued('sí');expect(h.conv.sessionData.cart.map(l=>l.unitPrice)).toEqual([22000,35000]);}
 });
 it(`entire multi quote removed ${other} ${agent}`,async()=>{
  const {h,menu}=await setup(other,agent);h.service.catalogService.getMenuProducts.mockResolvedValue([]);const reply=await h.sendQueued('sí');for(const p of menu)expect(reply).toContain(p.name);expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
