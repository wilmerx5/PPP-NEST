/** Batch 239: structured unit notes; baseline diagnosis is recorded in batch 238. */
import { harness, products } from './whatsapp-accuracy.test-support';

const menus = [
  {dish:'Sopa De Lentejas', left:'arroz', right:'arepa', shared:'bien caliente'},
  {dish:'Bowl De Vegetales', left:'quinoa', right:'ensalada', shared:'bien empacado'},
  {dish:'Pasta Primavera', left:'queso', right:'albahaca', shared:'bien caliente'},
];
const paths = ['notes', 'shared', 'elliptical', 'extra', 'payment'] as const;
for (const [index, f] of menus.entries()) for (const agent of [false,true]) for (const path of paths) {
  it(`${index}/${agent}/${path}: total and note ownership survive checkout`, async () => {
    const menu = [
      {id:8801,code:8801,name:f.dish,price:20000,availableNow:true,hasAttributes:false,attributes:[],description:`Acompañado con ${f.left} y ${f.right}`},
      {id:8802,code:8802,name:`Porción De ${f.left}`,price:4000,availableNow:true,hasAttributes:false,attributes:[]},
      {id:8803,code:8803,name:'Agua Mineral',price:3000,availableNow:true,hasAttributes:false,attributes:[]},
    ];
    const h=harness(menu as never,agent);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
    if(path==='payment') {
      h.conv.state='awaiting_payment';
      h.conv.sessionData.cart=[{productId:8803,code:8803,name:'Agua Mineral',quantity:1,unitPrice:3000,attributes:[]}];
    }
    const common=path==='notes'?'':` ${f.shared}`;
    const sides=path==='elliptical'?`una con porción de ${f.left} y la otra ${f.right}`:
      `una con harto ${f.left} y la otra con poca ${f.right}`;
    const input=`Me regala dos ${f.dish}${common} ${sides}`+
      (path==='extra'?`, y una porción adicional de ${f.left}`:'');
    await h.sendQueued(input);
    const rows=h.conv.sessionData.cart.filter(line=>line.productId===8801);
    expect(rows).toHaveLength(2);
    expect(rows.map(line=>line.quantity)).toEqual([1,1]);
    expect(rows[0].note).toContain(f.left);
    expect(rows[0].note).not.toContain(f.right);
    expect(rows[1].note).toContain(f.right);
    expect(rows[1].note).not.toContain(f.left);
    if(common)expect(rows.every(line=>(line.note||'').includes(f.shared))).toBe(true);
    expect(h.conv.sessionData.cart.filter(line=>line.productId===8802).reduce((n,line)=>n+line.quantity,0)).toBe(path==='extra'?1:0);
    expect(h.conv.sessionData.cart.filter(line=>line.productId===8803).reduce((n,line)=>n+line.quantity,0)).toBe(path==='payment'?1:0);
    expect(h.replies.join('\n')).not.toMatch(/no manejamos|no pude|necesito aclarar|aclar[ae]mos/i);
    expect(h.replies.join('\n')).toContain(f.left);
    expect(h.replies.join('\n')).toContain(f.right);
    expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
    if(path==='payment')expect(h.replies.at(-1)).toMatch(/pag[ao]|pago/i);
    const expectedNotes=rows.map(line=>line.note);
    await h.sendQueued('contraentrega');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.filter((line:{productId:number})=>line.productId===8801).map((line:{note:string})=>line.note)).toEqual(expectedNotes);
    expect(dto.items).toHaveLength(2+(path==='extra'||path==='payment'?1:0));
  });
}
for(const agent of [false,true])it(`real soup phrasing ${agent}`,async()=>{
  const h=harness(products,agent);
  await h.sendQueued('Me regala dos sopas grandes de menudencias bien caliente una con porción de arroz y la otra arepita');
  expect(h.conv.sessionData.cart).toHaveLength(2);
  expect(h.conv.sessionData.cart.map(line=>[line.code,line.quantity])).toEqual([[20,1],[20,1]]);
  expect(h.conv.sessionData.cart.every(line=>/caliente/i.test(line.note||''))).toBe(true);
  expect(h.conv.sessionData.cart[0].note).toMatch(/arroz/i);
  expect(h.conv.sessionData.cart[1].note).toMatch(/arep/i);
  expect(h.replies.join('\n')).not.toMatch(/no manejamos|aclar/i);
});

for (const f of menus) for (const agent of [false,true]) for (const fault of ['total','extra-unavailable']) {
  it(`${f.dish}/${agent}/${fault}: no partial purchase`,async()=>{
    const menu=[
      {id:8801,code:8801,name:f.dish,price:20000,availableNow:true,hasAttributes:false,attributes:[]},
      {id:8802,code:8802,name:`Porción De ${f.left}`,price:4000,availableNow:false,hasAttributes:false,attributes:[]},
    ];
    const h=harness(menu as never,agent);
    h.conv.state='awaiting_payment';
    h.conv.sessionData.cart=[{productId:9999,code:9999,name:'Pedido anterior',quantity:1,unitPrice:10000}];
    const before=structuredClone(h.conv.sessionData.cart);
    const total=fault==='total'?'tres':'dos';
    await h.sendQueued(`Me regala ${total} ${f.dish} ${f.shared} una con harto ${f.left} y la otra con poca ${f.right}`+
      (fault==='extra-unavailable'?`, y una porción adicional de ${f.left}`:''));
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.replies.at(-1)).toMatch(/aclarar.*reparto/i);
  });
}
