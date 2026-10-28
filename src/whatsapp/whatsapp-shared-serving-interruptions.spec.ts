/** Batch 240: interruptions and scoped retirement of stored serving notes. */
import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  { dish: 'Sopa De Lentejas', side: 'arroz', other: 'arepa' },
  { dish: 'Bowl De Vegetales', side: 'quinoa', other: 'ensalada' },
  { dish: 'Pasta Primavera', side: 'queso', other: 'albahaca' },
];

for (const menu of menus) for (const agent of [false, true]) {
  const catalog = [
    { id: 8801, code: 8801, name: menu.dish, price: 20000, availableNow: true, hasAttributes: false, attributes: [], description: `Acompañado con ${menu.side} y ${menu.other}` },
    { id: 8802, code: 8802, name: `Porción De ${menu.side}`, price: 4000, availableNow: true, hasAttributes: false, attributes: [] },
  ];
  const purchase = `Me regala dos ${menu.dish} bien calientes una con harto ${menu.side} y la otra con poca ${menu.other}`;
  const setup = () => {
    const h = harness(catalog as never, agent);
    h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
    return h;
  };
  it(`${menu.dish}/${agent}: price inquiry before distribution does not purchase`, async () => {
    const h = setup();
    await h.sendQueued(`¿Cuánto cuestan dos ${menu.dish} una con harto ${menu.side} y la otra con poca ${menu.other}?`);
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.replies.at(-1)).toMatch(/20[.,]?000|40[.,]?000|precio|cuestan/i);
    await h.sendQueued(purchase);
    expect(h.conv.sessionData.cart.filter(row => row.productId === 8801)).toHaveLength(2);
  });
  it(`${menu.dish}/${agent}: content inquiry after distribution preserves both notes`, async () => {
    const h = setup();
    await h.sendQueued(purchase);
    const before = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`¿Qué trae ${menu.dish}?`);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).toMatch(new RegExp(`${menu.side}|${menu.other}`, 'i'));
  });
  it(`${menu.dish}/${agent}: one-unit change preserves the other serving`, async () => {
    const h = setup();
    await h.sendQueued(purchase);
    const original = structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(`A la primera ${menu.dish} quítale el ${menu.side}`);
    const rows = h.conv.sessionData.cart.filter(row => row.productId === 8801);
    expect(rows).toHaveLength(2);
    expect(rows[0].note).not.toMatch(new RegExp(menu.side, 'i'));
    expect(rows[1]).toEqual(original[1]);
    expect(h.replies.at(-1)).not.toMatch(/no pude|no entend/i);
  });
}

for (const menu of menus) for (const agent of [false, true]) {
  const setup = async () => {
    const h = harness([{ id:8801,code:8801,name:menu.dish,price:20000,availableNow:true,hasAttributes:false,attributes:[],
      description: `Acompañado con ${menu.side} y ${menu.other}` }] as never,agent);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
    await h.sendQueued(`Me regala dos ${menu.dish} bien calientes una con harto ${menu.side} y la otra con poca ${menu.other}`);
    return h;
  };
  for (const position of [0,1]) it(`${menu.dish}/${agent}/${position}: retire one note, repeat safely and preserve DTO`, async()=>{
    const h=await setup();
    const original=structuredClone(h.conv.sessionData.cart);
    h.conv.state='awaiting_payment';
    const request=`A la ${position===0?'primera':'segunda'} ${menu.dish} quítale el ${position===0?menu.side:menu.other}`;
    await h.sendQueued(request);
    const rows=h.conv.sessionData.cart;
    expect(rows).toHaveLength(2);
    expect(rows[position].note).toBe('bien calientes');
    expect(rows[1-position]).toEqual(original[1-position]);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.replies.at(-1)).toMatch(/retiré la nota/i);
    expect(h.replies.at(-1)).toMatch(/pag[ao]/i);
    const edited=structuredClone(rows);
    await h.sendQueued(request);
    expect(h.conv.sessionData.cart).toEqual(edited);
    expect(h.replies.at(-1)).toMatch(/no encontré.*nota/i);
    await h.sendQueued('contraentrega');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.map((item:{note?:string})=>item.note)).toEqual(edited.map(item=>item.note));
  });
  for (const state of ['awaiting_address','awaiting_final_confirm'])
    it(`${menu.dish}/${agent}/${state}: keep checkout step and require confirmation`,async()=>{
      const h=await setup();
      h.conv.state=state;
      h.conv.sessionData.orderType='delivery';
      h.conv.sessionData.address='Calle 10 # 20-30';
      h.conv.sessionData.paymentMethod='cash';
      const second=structuredClone(h.conv.sessionData.cart[1]);
      await h.sendQueued(`A la primera ${menu.dish} quítale el ${menu.side}`);
      expect(h.conv.sessionData.cart[0].note).toBe('bien calientes');
      expect(h.conv.sessionData.cart[1]).toEqual(second);
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.address).toBe('Calle 10 # 20-30');
      expect(h.conv.sessionData.paymentMethod).toBe('cash');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.replies.at(-1)).toMatch(state==='awaiting_address'?/direcci[oó]n/i:/confirmar/i);
    });
  for (const fault of ['dish','position','quantity','selection','link','missing-note','compound-note','question'] as const)
    it(`${menu.dish}/${agent}/${fault}: unsafe or non-edit reference preserves cart`, async()=>{
      const h=await setup();
      h.conv.state='awaiting_payment';
      if(fault==='quantity')h.conv.sessionData.cart[0].quantity=2;
      if(fault==='selection')h.conv.sessionData.pendingCartQuantity={sourceText:'deja dos',quantity:2,candidates:[{cartIndex:0,name:menu.dish}],cartSignature:JSON.stringify(h.conv.sessionData.cart)} as never;
      if(fault==='link'){h.conv.state='awaiting_mp_payment';h.conv.sessionData.mpPreferenceId='synthetic-payment';}
      if(fault==='missing-note')h.conv.sessionData.cart[0].note='bien calientes; sin '+menu.side;
      if(fault==='compound-note')h.conv.sessionData.cart[0].note=`bien calientes; con harto ${menu.side} y salsa`;
      const before=structuredClone(h.conv.sessionData);
      const state=h.conv.state;
      const ordinal=fault==='position'?'cuarta':'primera';
      const dish=fault==='dish'?'Producto Distinto':menu.dish;
      const request=`A la ${ordinal} ${dish} quítale el ${menu.side}`;
      await h.sendQueued(fault==='question'?`¿${request}?`:request);
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.mpPreferenceId).toBe(before.mpPreferenceId);
      expect(h.conv.sessionData.pendingCartQuantity).toEqual(before.pendingCartQuantity);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.replies.at(-1)).not.toMatch(/Listo, retiré la nota/i);
    });
}
