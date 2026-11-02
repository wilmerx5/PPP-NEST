import { harness } from './whatsapp-accuracy.test-support';

function setup(other: boolean, agent: boolean) {
  const names = other ? ['Sandwich Vegetal', 'Sandwich Campestre'] : ['1 Pollo Frito', '1/2 Pollo Frito'];
  const attributeName = other ? 'Pan' : 'Arepas';
  const options = other ? ['Blanco', 'Integral'] : ['Blancas', 'Fritas'];
  const menu = names.map((name, i) => ({ id: 96301+i, code: i+1, name, categoryName: 'Platos', price: 20000-i*5000, availableNow: true, hasAttributes: true, attributes: [{attributeName, options}] }));
  menu.push({id:96303,code:3,name:'Sopa Vegetal',categoryName:'Sopas',price:7000,availableNow:true,hasAttributes:false,attributes:[]});
  const h = harness(menu, agent);
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn = jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create = jest.fn().mockResolvedValue({id:339,dailyOrderNumber:339});
  h.service.ordersService.findTodayOrdersByPhone = jest.fn().mockResolvedValue([]);
  h.conv.sessionData.cart = menu.slice(0,2).map((p,i) => ({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:i+1,attributes:[{attributeName,attributeValue:options[0]}],note:'Salsa aparte'}));
  // An unrelated dish must never receive the shared option.
  h.conv.sessionData.cart.push({productId:96303,code:3,name:'Sopa Vegetal',unitPrice:7000,quantity:1});
  return {h,menu,attributeName,options};
}
for(const other of [false,true]) for(const agent of [false,true]) for(const answer of ['a los dos','ambos','en ambos','a todos']) {
  it(`resolves shared pending option and closes once: ${other}/${agent}/${answer}`,async()=>{
    const {h,attributeName,options}=setup(other,agent);
    const before=structuredClone(h.conv.sessionData.cart);
    const question=await h.sendQueued(`${attributeName} ${options[1]}`);
    expect(question).toMatch(/cu[aá]l plato/i);
    expect(h.conv.sessionData.pendingCartAttributeEdit?.candidates).toHaveLength(2);
    const reply=await h.sendQueued(answer);
    expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>i<2?{...line,attributes:[{attributeName,attributeValue:options[1]}]}:line));
    expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
    expect(reply).toContain(options[1]);
    expect(reply).not.toMatch(/carrito cambi[oó]/i);
    await h.sendQueued('no mas'); await h.sendQueued('contraentrega');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    const receipt=await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const items=h.service.ordersService.create.mock.calls[0][0].items;
    expect(items).toHaveLength(4);
    expect(items.filter(item=>item.productId!==96303).every(item=>item.attributes.some(a=>a.attributeName===attributeName && a.attributeValue===options[1]))).toBe(true);
    expect(receipt).toContain('57.000');
    expect(receipt).toContain('Salsa aparte');
  });
}

for(const other of [false,true]) for(const agent of [false,true]) {
  for(const scenario of ['stale','withdrawn','count','confirm','courtesy','third-unoffered','single']) {
    it(`pending group guard ${other}/${agent}/${scenario}`,async()=>{
      const {h,menu,attributeName,options}=setup(other,agent);
      if(scenario==='confirm') {
        await h.sendQueued('no mas'); await h.sendQueued('contraentrega');
        expect(h.conv.state).toBe('awaiting_final_confirm');
      }
      await h.sendQueued(`${attributeName} ${options[1]}`);
      expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
      if(scenario==='stale') h.conv.sessionData.cart[0].quantity++;
      if(scenario==='withdrawn') menu[1].attributes[0].options=[options[0]];
      if(scenario==='third-unoffered') {
        // A matching attribute outside the offered candidates must remain untouched.
        menu[2].hasAttributes=true; menu[2].attributes=structuredClone(menu[0].attributes);
        h.conv.sessionData.cart[2].attributes=[{attributeName,attributeValue:options[0]}];
        h.conv.sessionData.pendingCartAttributeEdit!.cartSignature=JSON.stringify(h.conv.sessionData.cart);
      }
      const before=structuredClone(h.conv.sessionData.cart);
      const state=h.conv.state;
      const reply=await h.sendQueued(scenario==='count'?'a los tres':scenario==='courtesy'?'a los dos por favor':scenario==='single'?'1':'a los dos');
      if(['stale','withdrawn','count'].includes(scenario)) {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(reply).not.toMatch(/Listo ✅/);
        if(scenario==='count') expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
        else expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
      } else {
        expect(h.conv.sessionData.cart).toEqual(before.map((line,i)=>i<(scenario==='single'?1:2)?{...line,attributes:[{attributeName,attributeValue:options[1]}]}:line));
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
        expect(reply).toContain(options[1]);
        if(scenario==='confirm') { expect(h.conv.state).toBe(state); expect(reply).toMatch(/confirmar/); }
      }
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
}
for(const text of ['agrega dos','a los dos si no cuesta más','no, a los dos no','¿a los dos?','a los dos y agrega una sopa','dos','a los dos sin sal']) {
  it(`does not interpret compound or conditional instructions as bare group: ${text}`,()=>{
    const {h}=setup(false,false);
    expect(h.service.pendingAttributeGroupChoice(text)).toBeUndefined();
  });
}
