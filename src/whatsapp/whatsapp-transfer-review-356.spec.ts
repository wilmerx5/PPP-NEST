import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const catalogs = [
  [{id:94,code:94,name:'Combo De Arroz Paisa',price:47000,availableNow:true,hasAttributes:false,attributes:[]}],
  [{id:901,code:1,name:'Lasaña vegetal',price:21000,availableNow:true,hasAttributes:false,attributes:[]}],
];
const details = 'Banco de pruebas, cuenta TEST-356, titular Comercio Demo';
function setup(menu:typeof catalogs[number], agent:boolean, configured:boolean) {
  const h = harness(structuredClone(menu),agent);
  h.cfg.paymentMethods = structuredClone(DEFAULT_PAYMENT_METHODS).filter(m=>m.id!=='mercadopago');
  h.cfg.localContext = configured ? {transferInfoNote:details} : {};
  h.conv.customerName = '';
  h.conv.sessionData.orderType = 'delivery';
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.ordersService.create = jest.fn().mockResolvedValue({id:356,dailyOrderNumber:356});
  return h;
}
for(const menu of catalogs) for(const agent of [false,true]) {
  for(const configured of [false,true]) for(const choice of ['Vale, sería por transferencia','Pago con nequi']) {
    it(`early transfer review ${menu[0].id} ${agent} ${configured} ${choice}`,async()=>{
      const h=setup(menu,agent,configured);
      await h.sendQueued(`Quiero un ${menu[0].name}`);
      const cart=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(choice);
      expect(h.conv.sessionData.paymentMethod).toBe('transfer');
      await h.sendQueued('David Alfonso');
      const reply=await h.sendQueued('Carrera 79C #2-17');
      expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(h.conv.sessionData.cart).toEqual(cart);
      expect(reply).toMatch(/confirmar/);
      if(configured) expect(reply).toContain(details);
      else expect(reply).toMatch(/no tengo.*(?:cuenta|titular).*confirmados/i);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create.mock.calls[0][0].address).toContain('Transferencia');
    });
  }
  it(`switch cash to transfer at review ${menu[0].id} ${agent}`,async()=>{
    const h=setup(menu,agent,true);
    h.conv.customerName='David Alfonso';
    Object.assign(h.conv.sessionData,{address:'Carrera 79C #2-17',addressConfirmed:true,paymentMethod:'cash'});
    await h.sendQueued(`Quiero un ${menu[0].name}`);
    await h.sendQueued('no más');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    const cart=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued('Mejor por transferencia');
    expect(reply).toContain(details);
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.sessionData.paymentMethod).toBe('transfer');
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}

for(const menu of catalogs) for(const agent of [false,true]) {
  for(const method of ['transferencia','efectivo']) it(`ordinary choice without duplicate accounts ${menu[0].id} ${agent} ${method}`,async()=>{
    const h=setup(menu,agent,true);
    h.conv.customerName='David Alfonso';
    Object.assign(h.conv.sessionData,{address:'Carrera 79C #2-17',addressConfirmed:true});
    await h.sendQueued(`Quiero un ${menu[0].name}`);
    await h.sendQueued('no más');
    expect(h.conv.state).toBe('awaiting_payment');
    const cart=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued(method);
    expect(reply?.split(details).length).toBe(method==='transferencia'?2:1);
    expect(h.conv.state).toBe('awaiting_final_confirm');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
