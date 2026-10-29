import { isCheckoutWaitIntent } from './whatsapp-intent';
import { normalizeRegionalPaymentIntent, DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';
import { harness } from './whatsapp-accuracy.test-support';

const menus = [
  ['Bowl de verduras','Agua mineral'],
  ['Pizza del huerto','Té frío'],
];
function setup(names: string[], enabled: boolean, state: string) {
  const menu = names.map((name,i) => ({id:87001+i,code:87001+i,name,price:10000,
    availableNow:true,hasAttributes:false,attributes:[]}));
  const h = harness(menu,enabled);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn();
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.conv.state=state;
  Object.assign(h.conv.sessionData,{cart:menu.map(p=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:1})),
    fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  return h;
}
for (const names of menus) for (const enabled of [false,true]) {
  describe(`${names[0]} agent=${enabled}`,()=>{
    it.each(['quiero cancelar con efectivo','quiero cancelar por transferencia'])('paying is not cancelling: %s',async text=>{
      const h=setup(names,enabled,'awaiting_payment');
      const before=structuredClone(h.conv.sessionData.cart);
      const reply=await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.paymentMethod).toBe(text.includes('efectivo')?'cash':'transfer');
      expect(reply).not.toMatch(/cancelado|vaciamos|pedido cancel/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    for (const state of ['awaiting_name','awaiting_address']) {
      it.each(['ahorita te digo','dame un ratito','ya te paso la dirección'])('wait preserves data: %s in '+state,async text=>{
        const h=setup(names,enabled,state);
        const before=structuredClone(h.conv);
        const reply=await h.sendQueued(text);
        expect(h.conv.sessionData).toEqual(before.sessionData);
        expect(h.conv.customerName).toBe(before.customerName);
        expect(h.conv.state).toBe(state);
        expect(reply).toMatch(/espero|cuando.*listo/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      });
    }
  });
}

for (const enabled of [false,true]) {
  it('an actual cancellation still clears the draft agent='+enabled, async()=>{
    const h=setup(menus[0],enabled,'awaiting_payment');
    await h.sendQueued('quiero cancelar el pedido');
    expect(h.conv.sessionData.cart).toHaveLength(0);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('a payment question selects nothing agent='+enabled,async()=>{
    const h=setup(menus[0],enabled,'awaiting_payment');
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued('puedo cancelar con efectivo?');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.paymentMethod).toBeFalsy();
    expect(reply).toMatch(/efectivo|contraentrega/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it('waiting during review never confirms agent='+enabled,async()=>{
    const h=setup(menus[0],enabled,'awaiting_final_confirm');
    Object.assign(h.conv.sessionData,{paymentMethod:'cash'});
    const before=structuredClone(h.conv.sessionData);
    await h.sendQueued('ahorita te digo');
    expect(h.conv.sessionData).toEqual(before);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
it.each(['ahorita te digo, calle 10 #20-30','dame un arroz','ahorita paso a recoger','ya te paso la dirección calle 10 #20-30'])('does not swallow substantive information: %s',text=>{
  expect(isCheckoutWaitIntent(text)).toBe(false);
});
it.each(['quiero cancelar el pedido','no quiero cancelar con efectivo','quiero cancelar con efectivo y quitar el agua','ya cancelé por transferencia'])('does not rewrite cancellation, negation, compound or payment proof: %s',text=>{
  expect(normalizeRegionalPaymentIntent(text,DEFAULT_PAYMENT_METHODS)).toBeNull();
});
it('recognizes a configured local payment keyword without hardcoding its name',()=>{
  const methods=[{...DEFAULT_PAYMENT_METHODS[1],id:'custom_local',label:'Pago local',keywords:['billetera local']}];
  expect(normalizeRegionalPaymentIntent('quiero cancelar por billetera local',methods)).toBe('pago con billetera local');
});

for (const enabled of [false, true]) {
  it.each(['quiero cancelar con bitcoin', 'quiero cancelar con urgencia', 'quiero cancelar con efectivo y quitar el agua'])(
    'clarifies ambiguous cancellation without mutating: %s agent='+enabled, async text=>{
      const h=setup(menus[0],enabled,'awaiting_payment');
      const before=structuredClone(h.conv.sessionData);
      const reply=await h.sendQueued(text);
      expect(h.conv.sessionData).toEqual(before);
      expect(reply).toMatch(/pagar.*anular/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
}

for (const enabled of [false,true]) {
  it.each(['Cancelo con 100mil','Cancelo con 100.000','Cancelo con un billete de 100mil'])(
    'preserves the existing bill-for-change route: %s agent='+enabled,async text=>{
      const h=setup(menus[0],enabled,'awaiting_payment');
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(text);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(String(h.conv.sessionData.cashChangeFor)).toMatch(/100/);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
}
