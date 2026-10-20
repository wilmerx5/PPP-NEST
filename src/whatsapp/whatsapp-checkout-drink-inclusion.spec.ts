import { harness } from './whatsapp-accuracy.test-support';

// Real router, external services mocked: these cases do not measure model inference.
describe('Drink inclusion interrupts checkout without opening a purchase', () => {
  for (const [name,description,answer] of [
    ['Bowl Vegetal','Incluye gaseosa','Sí trae gaseosa'],
    ['Pizza Del Huerto','No incluye bebida','No trae gaseosa'],
    ['Arroz Marinero','Con bebida de 400ml','No tengo confirmado'],
  ]) for (const enabled of [false,true]) for (const state of ['awaiting_address','awaiting_payment','awaiting_final_confirm'] as const) {
    for (const named of [false,true]) it(`${name} ${state} named=${named} agent=${enabled}`, async () => {
      const p={id:89001,code:89001,name,description,price:23000,availableNow:true,attributes:[]};
      const h=harness([p],enabled);
      h.conv.state=state;
      Object.assign(h.conv.sessionData,{cart:[{productId:p.id,code:p.code,name,unitPrice:p.price,quantity:2,attributes:[],note:'bien empacado'}],orderType:'delivery',fulfillmentChosen:true,address:state==='awaiting_address'?undefined:'Calle 10 #20-30',addressConfirmed:state!=='awaiting_address',phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:state==='awaiting_final_confirm'?'contraentrega':undefined,deliveryFeeCalculated:2000});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:8900,dailyOrderNumber:96});
      const before=structuredClone(h.conv.sessionData.cart);
      const reply=await h.sendQueued(named?`el ${name} trae gaseosa?`:'traen gaseosa?');
      expect(reply).toContain(answer);
      expect(reply).toMatch(state==='awaiting_address'?/dirección/:state==='awaiting_payment'?/método de pago/:/confirmar/);
      expect(reply).not.toMatch(/Dime el.*número|¿.*Algo más/);
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if(state==='awaiting_address') await h.sendQueued('Calle 10 #20-30');
      if(state!=='awaiting_final_confirm') await h.sendQueued('contraentrega');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto=h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(2);
      expect(dto.items.every((i:any)=>i.productId===p.id && i.note==='bien empacado')).toBe(true);
      expect(dto.address).toContain('20-30');
    });
  }
});

for (const enabled of [false,true]) for (const scope of ['all','named','outside']) {
  it(`mixed cart answers ${scope} without replacing option/notes or choosing another dish, agent=${enabled}`, async()=>{
    const menu=[
      {id:89101,code:89101,name:'Bowl Verde',description:'Incluye gaseosa',price:25000,availableNow:true,attributes:[]},
      {id:89102,code:89102,name:'Pizza Roja',description:'Sin bebida',price:30000,availableNow:true,attributes:[]},
      {id:89103,code:89103,name:'Pasta Blanca',description:'Con ensalada',price:29000,availableNow:true,attributes:[]},
    ];
    const h=harness(menu,enabled); h.conv.state='awaiting_payment';
    h.conv.sessionData.cart=menu.slice(0,2).map((p,index)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:index+1,attributes:[],note:index?'sin aceitunas':'poco picante'}));
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued(scope==='all'?'traen gaseosa?':scope==='named'?'la Pizza Roja trae gaseosa?':'la Pasta Blanca trae gaseosa?');
    if(scope==='all') {expect(reply).toContain('Sí trae gaseosa: *Bowl Verde*');expect(reply).toContain('No trae gaseosa: *Pizza Roja*');}
    if(scope==='named') {expect(reply).toContain('No trae gaseosa: *Pizza Roja*');expect(reply).not.toContain('Bowl Verde');}
    if(scope==='outside') {expect(reply).toContain('No tengo confirmado si incluye gaseosa: *Pasta Blanca*');expect(reply).not.toContain('Bowl Verde');}
    expect(reply).toContain('método de pago');
    expect(h.conv.state).toBe('awaiting_payment');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.sessionData.pendingMatch).toBeFalsy();
  });
}
