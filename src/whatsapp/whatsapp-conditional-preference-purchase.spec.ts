import { harness } from './whatsapp-accuracy.test-support';
const menus = [
 ['Hamburguesa Clasica','Hamburguesa Vegetariana','Flan De Coco'],
 ['Taco De Res','Taco De Hongos','Mochi De Fresa'],
 ['Ramen De Pollo','Ramen De Tofu','Pan De Ajo'],
];
for(const names of menus) for(const agent of [false,true]) for(const availability of ['tienes','hay','tienen']) {
 it(`preserves purchase and asks preference scope through DTO: ${names[0]}/${agent}/${availability}`,async()=>{
  const menu=names.map((name,i)=>({id:99001+i,code:91+i,name,price:15000,availableNow:true,attributes:[]}));
  menu.push({id:99004,code:94,name:'Porcion De Yuca Frita',price:5000,availableNow:true,attributes:[]});
  const h=harness(menu,agent);
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  await h.sendQueued(`Me das un ${names[0]} y un ${names[1]} si ${availability} yuca mejor y 2 ${names[2]} por favor`);
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity]).sort()).toEqual([[99001,1],[99002,1],[99003,2]]);
  expect(h.conv.sessionData.cart.every(line=>!line.note)).toBe(true);
  expect(h.conv.sessionData.pendingSubsetKitchenNote?.productIds.sort()).toEqual([99001,99002]);
  expect(h.replies.at(-1)).toMatch(/cu[aá]les productos/i);
  expect(h.replies.at(-1)).toMatch(/si hay/i);
  expect(h.conv.state).toBe('building_cart');
  const beforeRepeat=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(`Me das un ${names[0]} y un ${names[1]} si ${availability} yuca mejor y 2 ${names[2]} por favor`);
  expect(h.conv.sessionData.cart).toEqual(beforeRepeat);
  await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('2');
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
  expect(h.conv.sessionData.cart.find(line=>line.productId===99002)?.note).toMatch(/yuca.*si hay/i);
  expect(h.conv.sessionData.cart.find(line=>line.productId===99001)?.note).toBeFalsy();
  expect(h.conv.sessionData.cart.find(line=>line.productId===99003)?.note).toBeFalsy();
  await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(4);
  expect(dto.items.filter((line:any)=>line.productId===99002)).toEqual([expect.objectContaining({note:expect.stringMatching(/yuca.*si hay/i)})]);
 });
}

for(const agent of [false,true]) {
 it(`pending preference can be removed without removing dishes ${agent}`,async()=>{
  const menu=[...menus[0],'Porcion De Yuca Frita'].map((name,i)=>({id:99001+i,code:91+i,name,price:15000,availableNow:true,attributes:[]}));
  const h=harness(menu,agent);
  await h.sendQueued(`Me das un ${menu[0].name} y un ${menu[1].name} si hay yuca mejor y 2 ${menu[2].name}`);
  const before=structuredClone(h.conv.sessionData.cart);
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeTruthy();
  await h.sendQueued('no apliques esa nota');
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.replies.at(-1)).toMatch(/retiré esa indicación/i);
 });
}
for(const condition of ['solo si tienes yuca','si no tienes yuca mejor','si tienes descuento mejor','si tienes yuca mejor para que uno venga con papa y el otro con yuca']) {
 it(`soft preference handler declines other condition: ${condition}`,async()=>{
  const menu=[...menus[0],'Porcion De Yuca Frita'].map((name,i)=>({id:99001+i,code:91+i,name,price:15000,availableNow:true,attributes:[]}));
  const h=harness(menu,false);
  expect(await h.service.tryHandleOptionalAccompanimentPurchase(h.conv,h.conv.waId,h.conv.sessionData,`Me das un ${menu[0].name} y un ${menu[1].name} ${condition}`,menu,h.cfg)).toBe(false);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.conv.sessionData.pendingSubsetKitchenNote).toBeFalsy();
  expect(h.replies).toEqual([]);
 });
}
