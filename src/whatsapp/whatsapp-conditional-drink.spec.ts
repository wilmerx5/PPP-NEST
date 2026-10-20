import { harness } from './whatsapp-accuracy.test-support';

// Router regression, not a measurement of model inference. The conditional
// purchase is authorized only by explicit negative catalogue evidence.
for(const name of ['Bowl Del Huerto','Pizza Vegetal','Arroz Marinero']) for(const enabled of [false,true]) {
  for(const [description,evidence] of [['Incluye gaseosa','yes'],['No incluye bebida','no'],['Con ensalada','unknown']]) {
    for(const state of ['awaiting_payment','awaiting_final_confirm']) it(`${name} ${evidence} ${state} agent=${enabled}`,async()=>{
      const menu=[{id:90001,code:90001,name,description,price:25000,availableNow:true,attributes:[]},
        {id:90002,code:90002,name:'Gaseosa 400ml',price:4000,availableNow:true,attributes:[]}];
      const h=harness(menu,enabled); h.conv.state=state;
      Object.assign(h.conv.sessionData,{cart:[{productId:90001,code:90001,name,unitPrice:25000,quantity:2,attributes:[],note:'sin cebolla'}],orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:state==='awaiting_final_confirm'?'contraentrega':undefined,deliveryFeeCalculated:2000});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:9000,dailyOrderNumber:98});
      const original=structuredClone(h.conv.sessionData.cart[0]);
      const reply=await h.sendQueued(`el ${name} trae gaseosa? Si no, agrega una gaseosa 400ml`);
      expect(h.conv.sessionData.cart[0]).toEqual(original);
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(reply).toMatch(state==='awaiting_payment'?/método de pago/:/confirmar/);
      if(evidence==='no') {
        expect(h.conv.sessionData.cart).toHaveLength(2);
        expect(h.conv.sessionData.cart[1]).toMatchObject({productId:90002,quantity:1,unitPrice:4000});
        expect(reply).toMatch(/agreg|añad/i);
      } else {
        expect(h.conv.sessionData.cart).toEqual([original]);
        expect(reply).toMatch(evidence==='yes'?/sí trae/i:/no tengo confirmado/i);
      }
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if(state==='awaiting_payment') await h.sendQueued('1');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto=h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items.filter((i:any)=>i.productId===90001)).toHaveLength(2);
      expect(dto.items.filter((i:any)=>i.productId===90002)).toHaveLength(evidence==='no'?1:0);
      expect(dto.items.filter((i:any)=>i.productId===90001).every((i:any)=>i.note==='sin cebolla')).toBe(true);
    });
  }
}

for(const enabled of [false,true]) for(const scenario of ['two','included','mixed','unavailable','unspecified','closed']) {
  it(`conditional contrast ${scenario}, agent=${enabled}`,async()=>{
    const menu=[{id:90101,code:90101,name:'Bowl Verde',description:scenario==='included'?'Incluye gaseosa':'Sin bebida',price:20000,availableNow:true,attributes:[]},
      {id:90102,code:90102,name:'Gaseosa 400ml',price:4000,availableNow:scenario!=='unavailable',attributes:[]},
      {id:90103,code:90103,name:'Gaseosa 1.5L',price:8000,availableNow:true,attributes:[]},
      {id:90104,code:90104,name:'Pizza Roja',description:'Incluye gaseosa',price:30000,availableNow:true,attributes:[]}];
    const h=harness(menu,enabled); h.conv.state='awaiting_payment';
    h.conv.sessionData.cart=[{productId:90101,code:90101,name:'Bowl Verde',quantity:1,unitPrice:20000,attributes:[],note:'sin sal'}];
    if(scenario==='mixed') h.conv.sessionData.cart.push({productId:90104,code:90104,name:'Pizza Roja',quantity:1,unitPrice:30000,attributes:[],note:'sin cebolla'});
    if(scenario==='closed') {h.cfg.ignoreBusinessHours=false; h.service.businessService.getStatus=async()=>({isOpen:false});}
    const before=structuredClone(h.conv.sessionData.cart);
    const reply=await h.sendQueued(scenario==='unspecified'?'traen gaseosa? Si no, dame una':'traen gaseosa? Si no, agrega dos gaseosas 400ml');
    expect(h.conv.state).toBe('awaiting_payment');
    expect(reply).toContain('método de pago');
    if(scenario==='two') {
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(h.conv.sessionData.cart[1]).toMatchObject({productId:90102,quantity:2});
      expect(h.conv.sessionData.cart[0]).toEqual(before[0]);
    } else {
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(reply).toMatch(/no añadí/i);
    }
  });
}
