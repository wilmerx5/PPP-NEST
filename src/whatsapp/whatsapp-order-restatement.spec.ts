import { harness, products } from './whatsapp-accuracy.test-support';
import { isUsableWhatsappCustomerName } from './whatsapp-session-intents';
for (const agent of [false,true]) {
  it(`order phrase must not become name ${agent}`, async()=>{
    const h=harness(undefined,agent);h.conv.customerName=null as any;
    await h.sendQueued('Es un pollo frito y uno a la broster');
    expect(h.conv.customerName).not.toBe('Es');
    expect(h.conv.sessionData.cart.map(line=>[line.code,line.quantity]).sort()).toEqual([[1,1],[4,1]]);
  });
  it(`real restatement is not a purchase ${agent}`,async()=>{
    const h=harness(undefined,agent);
    const names=['1 Pollo Frito','1 Pollo Broaster','Platano Con queso y Bocadillo'];
    h.conv.sessionData.cart=names.map((name,i)=>{
      const p=products.find((p:any)=>p.name.toLowerCase()===name.toLowerCase());
      if(!p)throw new Error(name);
      return {productId:p.id,code:p.code,name:p.name,quantity:i===2?2:1,unitPrice:p.price,attributes:[]};
    });
    const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued('Ósea 1 y 1 y los 2 plátanos');
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.replies.at(-1)).not.toMatch(/no manejamos|no tenemos/i);
  });
}
it('invalid fragment Es is not a saved customer name',()=>expect(isUsableWhatsappCustomerName('Es')).toBe(false));
const menus = [
 ['Taco Verde','Taco De Hongos','Agua Natural'],
 ['Pizza De Tomate','Pizza De Espinaca','Pan De Ajo'],
 ['Ramen De Miso','Ramen De Tofu','Te Verde'],
];
for(const names of menus) for(const agent of [false,true]) for(const state of ['building_cart','awaiting_payment']) {
 for(const prefix of ['O sea','Es decir']) {
  it(`recap ${names[0]} ${agent}/${state}/${prefix} survives to DTO`,async()=>{
   const menu=names.map((name,i)=>({id:99001+i,code:91+i,name,price:10000+i*1000,availableNow:true,attributes:[]}));
   const h=harness(menu,agent);h.conv.state=state;
   Object.assign(h.conv.sessionData,{cart:menu.map((p,i)=>({productId:p.id,code:p.code,name:p.name,quantity:i===2?2:1,unitPrice:p.price,attributes:[],note:'sin cebolla'})),orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
   const before=structuredClone(h.conv.sessionData.cart);
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
   h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
   for(let repeat=0;repeat<2;repeat++) {
    await h.sendQueued(`${prefix} uno y uno y los dos ${names[2]}`);
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(h.conv.state).toBe(state);
    expect(h.replies.at(-1)).toMatch(/esas cantidades ya están/);
    expect(h.replies.at(-1)).not.toMatch(/no manejamos|agregu[eé]/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
   }
   await h.sendQueued('nada más');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];
   expect(dto.items).toHaveLength(4);
   expect(dto.items.filter((item:any)=>item.productId===99003)).toHaveLength(2);
   expect(dto.items.every((item:any)=>item.note==='sin cebolla')).toBe(true);
  });
 }
}
for(const agent of [false,true]) for(const text of ['O sea uno y dos','O sea 0 y 1','Es decir 1 y 1 y dos platos desconocidos']) {
 it(`ambiguous recap asks instead of mutating ${agent}: ${text}`,async()=>{
  const h=harness([{id:99001,code:91,name:'Bowl Verde',price:10000,availableNow:true,attributes:[]}],agent);
  h.conv.state='awaiting_payment';
  h.conv.sessionData.cart=[{productId:99001,code:91,name:'Bowl Verde',quantity:3,unitPrice:10000,attributes:[],note:'sin sal'}];
  const before=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual(before);
  expect(h.conv.state).toBe('awaiting_payment');
  expect(h.replies.at(-1)).toMatch(/dime el nombre de cada producto/);
 });
}
for(const name of ['Li','Al','Ana','Esmeralda','Esteban','José']) {
 it(`legitimate short/name prefix remains accepted: ${name}`,()=>expect(isUsableWhatsappCustomerName(name)).toBe(true));
}
for(const agent of [false,true]) {
 it(`a genuine additional order after recap still adds ${agent}`,async()=>{
  const h=harness([{id:99001,code:91,name:'Bowl Verde',price:10000,availableNow:true,attributes:[]},{id:99002,code:92,name:'Bowl De Tofu',price:12000,availableNow:true,attributes:[]}],agent);
  h.conv.sessionData.cart=[{productId:99001,code:91,name:'Bowl Verde',quantity:1,unitPrice:10000,attributes:[]},{productId:99002,code:92,name:'Bowl De Tofu',quantity:1,unitPrice:12000,attributes:[]}];
  await h.sendQueued('O sea uno y uno');
  await h.sendQueued('Agrega un Bowl Verde adicional');
  expect(h.conv.sessionData.cart.filter(line=>line.productId===99001).reduce((total,line)=>total+line.quantity,0)).toBe(2);
  expect(h.conv.sessionData.cart.filter(line=>line.productId===99002).reduce((total,line)=>total+line.quantity,0)).toBe(1);
 });
 it(`legacy invalid recipient requires a real name before confirmation ${agent}`,async()=>{
  const h=harness(undefined,agent);
  h.conv.customerName='Es';h.conv.state='awaiting_payment';
  Object.assign(h.conv.sessionData,{cart:[{productId:23,code:23,name:'Arroz Con Pollo',quantity:1,unitPrice:29500,attributes:[]}],orderType:'pickup',fulfillmentChosen:true,addressConfirmed:true,address:'Recoge en el local',phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:987,dailyOrderNumber:98});
  await h.sendQueued('contraentrega');
  expect(h.conv.state).toBe('awaiting_name');
  expect(h.replies.at(-1)).toMatch(/nombre/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('Ana Ruiz');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].customerName).toBe('Ana Ruiz');
 });
}
