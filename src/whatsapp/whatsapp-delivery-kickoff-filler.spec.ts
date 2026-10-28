import { harness } from './whatsapp-accuracy.test-support';
import { isDeliveryLogisticsFluff } from './whatsapp-intent';

const phrases = ['Para que porfa para 1 domicilio', 'para 1 domicilio por favor', 'que porfa para un domicilio'];
for (const phrase of phrases) it(`logistics only: ${phrase}`, () => expect(isDeliveryLogisticsFluff(phrase)).toBe(true));
for (const phrase of ['para 1 domicilio para Calle 10 # 20-30', 'para domicilio a Edificio Aurora', 'para la casa 1', 'domicilio para Torre 1', 'para un domicilio y una sopa'])
  it(`does not erase a destination or another intent: ${phrase}`, () => expect(isDeliveryLogisticsFluff(phrase)).toBe(false));

for (const dish of ['Sopa De Lentejas', 'Bowl Vegetal', 'Pasta Primavera']) for (const agent of [false, true]) {
  const start = () => {
    const h = harness([{id:8801,code:8801,name:dish,price:20000,availableNow:true,hasAttributes:false,attributes:[]}] as never,agent);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
    return h;
  };
  it(`${dish}/${agent}: original kickoff leaves destination empty and accepts a later order`,async()=>{
    const h=start();
    await h.sendQueued(phrases[0]);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
    expect(h.conv.sessionData.cart).toEqual([]);
    expect(h.conv.sessionData.orderType).toBe('delivery');
    expect(h.replies.join('\n')).toMatch(/plato|c[oó]digo|pedir/i);
    expect(h.replies.join('\n')).not.toMatch(/Domicilio a \*/i);
    await h.sendQueued(`Un ${dish}`);
    expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:8801,quantity:1})]);
    expect(h.conv.sessionData.address).toBeFalsy();
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
  it(`${dish}/${agent}: kickoff preserves a genuine destination and existing cart`,async()=>{
    const h=start();
    await h.sendQueued(`Un ${dish}`);
    const cart=structuredClone(h.conv.sessionData.cart);
    Object.assign(h.conv.sessionData,{orderType:'delivery',address:'Calle 10 # 20-30',addressConfirmed:true});
    h.conv.state='awaiting_payment';
    await h.sendQueued(phrases[0]);
    expect(h.conv.sessionData.address).toBe('Calle 10 # 20-30');
    expect(h.conv.sessionData.cart).toEqual(cart);
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
