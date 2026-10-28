import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  ['Pollo Frito', 'Combo De Arroz Con Costillas', 'Combo De Arroz Con Pollo', 'Limonada', 'combo de arroz', 'el de costillas'],
  ['Pizza Hawaiana', 'Combo De Pasta Con Hongos', 'Combo De Pasta Con Queso', 'Limonada', 'combo de pasta', 'el de hongos'],
  ['Rollo California', 'Combo De Ramen Con Tofu', 'Combo De Ramen Con Cerdo', 'Limonada', 'combo de ramen', 'el de tofu'],
];
function setup(names: string[], agent: boolean, state = 'building_cart') {
  const menu = names.slice(0, 4).map((name, i) => ({ id: 9851+i, code: 9851+i, name, price: 10000, availableNow: true, hasAttributes: false, attributes: [] }));
  const h = harness(menu, agent);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  h.service.ordersService.create = jest.fn().mockResolvedValue({ id: 999, dailyOrderNumber: 99 });
  Object.assign(h.conv.sessionData, { cart: menu.map((p,i) => ({ productId:p.id,code:p.code,name:p.name,quantity:i===3?2:1,unitPrice:p.price,attributes:[],note:i===3?'Sin hielo':undefined })), phoneConfirmed:true, contactPhone:h.conv.phoneE164, notesCollected:true });
  h.conv.state = state;
  return h;
}
for (const names of menus) for (const agent of [false,true]) for (const state of ['building_cart','awaiting_final_confirm']) {
  it(`${names[0]}/${agent}/${state}: short clarification finishes both removals atomically`, async () => {
    const h=setup(names,agent,state); const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`elimina el ${names[0]} y el ${names[4]}`);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/cuál|elige/i);
    await h.sendQueued(names[5]);
    expect(h.conv.sessionData.cart).toEqual([before[2],before[3]]);
    expect(h.conv.state).toBe(state);
    expect(h.replies.at(-1)).toMatch(/retiré|quité/i);
    expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('contraentrega'); await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.map((x:{productId:number})=>x.productId)).toEqual([9853,9854,9854]);
    expect(dto.items.filter((x:{productId:number})=>x.productId===9854).every((x:{note:string})=>x.note==='Sin hielo')).toBe(true);
    expect(h.replies.at(-1)).toMatch(/Sin hielo/);
  });
}

for (const names of menus) for (const agent of [false,true]) {
  for (const reply of ['confirmar','99','¿el de costillas?','quiero una limonada','el combo','no el de costillas']) {
    it(`${names[0]}/${agent}: ${reply} cannot resolve or partly apply removal`, async () => {
      const h=setup(names,agent); const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`elimina el ${names[0]} y el ${names[4]}`);
      await h.sendQueued(reply);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingCartRemoval).toBeDefined();
      expect(h.replies.at(-1)).toMatch(/igual|No cambié/);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
  it(`${names[0]}/${agent}: numbered choice resolves the displayed list only`,async()=>{
    const h=setup(names,agent);const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`elimina el ${names[0]} y el ${names[4]}`);await h.sendQueued('2');
    expect(h.conv.sessionData.cart).toEqual([before[1],before[3]]);
    expect(h.replies.at(-1)).toMatch(/retiré/);
  });
  it(`${names[0]}/${agent}: cancellation retains all products`,async()=>{
    const h=setup(names,agent);const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`elimina el ${names[0]} y el ${names[4]}`);await h.sendQueued('cancela el cambio del carrito');
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
    expect(h.replies.at(-1)).toMatch(/cancel|igual/);
  });
  it(`${names[0]}/${agent}: stale cart invalidates the whole pending list`,async()=>{
    const h=setup(names,agent);
    await h.sendQueued(`elimina el ${names[0]} y el ${names[4]}`);
    h.conv.sessionData.cart[0].quantity=2;const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(names[5]);expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();expect(h.replies.at(-1)).toMatch(/carrito cambió/);
  });
  it(`${names[0]}/${agent}: two ambiguous targets remain atomic across both choices`,async()=>{
    const h=setup(names,agent);h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],note:'Sin salsa'});
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`elimina el ${names[0]} y el ${names[4]}`);
    await h.sendQueued('2');expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).toMatch(/No cambié/);
    await h.sendQueued(names[5]);expect(h.conv.sessionData.cart).toEqual([before[0],before[2],before[3]]);
    expect(h.replies.at(-1)).toMatch(/retiré/);
  });
}

for (const names of menus) for (const agent of [false,true]) {
  it(`${names[0]}/${agent}: direct confirmation cannot bypass unresolved removal`,async()=>{
    const h=setup(names,agent);await h.sendQueued(`elimina el ${names[0]} y el ${names[4]}`);
    const before=structuredClone(h.conv.sessionData);
    await h.service.tryConfirmOrder(h.conv,'customer',h.conv.sessionData,{skipFinalConfirm:true});
    expect(h.conv.sessionData).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/cuál línea|elige/);
  });
  it(`${names[0]}/${agent}: payment created during clarification prevents all removals`,async()=>{
    const h=setup(names,agent);await h.sendQueued(`elimina el ${names[0]} y el ${names[4]}`);
    h.conv.sessionData.mpPreferenceId='synthetic-only';const before=structuredClone(h.conv.sessionData);
    await h.sendQueued(names[5]);expect(h.conv.sessionData).toEqual(before);expect(h.replies.at(-1)).toMatch(/pago/);
  });
  it(`${names[0]}/${agent}: an unknown third target never creates a partial plan`,async()=>{
    const h=setup(names,agent);const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`elimina el ${names[0]} y el ${names[4]} y el plato inexistente`);
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingCartRemoval).toBeUndefined();
    expect(h.replies.at(-1)).toMatch(/nombre completo/);
  });
  it(`${names[0]}/${agent}: note clarification resolves a duplicate line before the second target`,async()=>{
    const h=setup(names,agent);h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],note:'Sin salsa'});
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`elimina el ${names[0]} y el ${names[4]}`);
    await h.sendQueued('el sin salsa');expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued(names[5]);expect(h.conv.sessionData.cart).toEqual([before[0],before[2],before[3]]);
    expect(h.replies.at(-1)).toMatch(/retiré/);
  });
}
