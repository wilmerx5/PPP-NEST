import {harness} from './whatsapp-accuracy.test-support';
import {DEFAULT_PAYMENT_METHODS, isPaymentCapabilityQuestion, isStandalonePaymentCapabilityQuestion} from './whatsapp-payment-methods';

function setup(agent:boolean, mp:boolean, state='building_cart') {
  const menu=[{id:701,code:1,name:agent?'Pasta vegetal':'Arroz Con Pollo',price:20000,availableNow:true,hasAttributes:false,attributes:[]}];
  const h=harness(menu,agent);
  h.cfg.paymentMethods=structuredClone(DEFAULT_PAYMENT_METHODS).filter(m=>mp||m.id!=='mercadopago');
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:357});
  h.conv.state=state;
  h.conv.customerName=state==='awaiting_name'?'':'Cliente Demo';
  Object.assign(h.conv.sessionData,{cart:[{productId:701,name:menu[0].name,quantity:1,unitPrice:20000,note:'Sin cebolla'}],orderType:'delivery',paymentMethod:'cash',address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,fulfillmentChosen:true});
  return h;
}
for(const agent of [false,true]) for(const mp of [false,true]) {
  for(const state of ['building_cart','awaiting_name','awaiting_address','awaiting_phone','awaiting_payment','awaiting_final_confirm'])
  for(const question of ['Manejan datáfono?','¿Puedo pagar con tarjeta?'])
  it(`capability preserves checkout ${agent} ${mp} ${state} ${question}`,async()=>{
    const h=setup(agent,mp,state),before=structuredClone(h.conv.sessionData),name=h.conv.customerName;
    const reply=await h.sendQueued(question);
    expect(reply).toMatch(/no tengo confirmada.*datáfono/i);
    expect(reply).not.toMatch(/no tenemos datáfono|no.*recibimos tarjeta|escribe.*confirmar.*te pido/i);
    if(mp) expect(reply).toMatch(/link|enlace/i);
    else expect(reply).not.toMatch(/te mandamos.*link/i);
    expect(h.conv.state).toBe(state);expect(h.conv.sessionData).toEqual(before);expect(h.conv.customerName).toBe(name);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    if(state==='awaiting_name') expect(reply).toMatch(/nombre/i);
    if(state==='awaiting_address') expect(reply).toMatch(/dirección/i);
  });
  it(`explicit configured terminal ${agent} ${mp}`,async()=>{
    const h=setup(agent,mp);
    h.cfg.paymentMethods.push({id:'custom_terminal',label:'Datáfono en el local',keywords:['datafono'],optionText:'Datáfono solo al recoger en el local',flow:'immediate',enabled:true});
    const before=structuredClone(h.conv.sessionData);
    const reply=await h.sendQueued('Manejan datáfono?');
    expect(reply).toContain('Datáfono solo al recoger en el local');
    expect(reply).not.toMatch(/no tengo confirmada|no tenemos datáfono|no.*recibimos tarjeta/i);
    expect(h.conv.sessionData).toEqual(before);
  });
  it(`retains pending offer ${agent} ${mp}`,async()=>{
    const h=setup(agent,mp);
    h.conv.sessionData.pendingAddOffer={product:{id:701,name:'Arroz Con Pollo'},quantity:1,sourceText:'un arroz'} as never;
    const before=structuredClone(h.conv.sessionData);
    expect(await h.sendQueued('¿Tienen datáfono?')).toMatch(/datáfono/i);
    expect(h.conv.sessionData).toEqual(before);
  });
}
for(const text of ['¿Datáfono?','reciben tarjeta?','Manejan nequi','Manejan pago con tarjeta'])
 it(`colloquial capability ${text}`,()=>expect(isPaymentCapabilityQuestion(text)).toBe(true));
for(const text of ['Pago con nequi','Sería por transferencia','Quiero pagar con tarjeta','Dos arroz con pollo'])
 it(`choice is not capability ${text}`,()=>expect(isPaymentCapabilityQuestion(text)).toBe(false));

for(const text of ['Manejan datáfono y agrega un arroz','¿Puedo pagar con tarjeta? Quiero dos sopas','Manejan Nequi; mi nombre es Ana','Pago con tarjeta','Manejan datáfono, para Calle 10 #20-30'])
 it(`mixed request bypasses early interception ${text}`,()=>expect(isStandalonePaymentCapabilityQuestion(text)).toBe(false));
for(const agent of [false,true]) for(const choice of ['efectivo','transferencia'])
 it(`question then actual choice and confirmation ${agent} ${choice}`,async()=>{
   const h=setup(agent,false,'awaiting_payment');
   delete h.conv.sessionData.paymentMethod;
   h.cfg.localContext={transferInfoNote:'Cuenta TEST-357'};
   const before=structuredClone(h.conv.sessionData);
   await h.sendQueued('Manejan datáfono?');
   expect(h.conv.sessionData).toEqual(before);
   const reply=await h.sendQueued(choice);
   expect(h.conv.sessionData.paymentMethod).toBe(choice==='efectivo'?'cash':'transfer');
   expect(h.conv.state).toBe('awaiting_final_confirm');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   if(choice==='transferencia') expect(reply).toContain('Cuenta TEST-357');
   await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.items).toHaveLength(1);expect(dto.items[0]).toMatchObject({productId:701,note:'Sin cebolla'});
 });
