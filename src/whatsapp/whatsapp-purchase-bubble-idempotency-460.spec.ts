import { harness } from './whatsapp-accuracy.test-support';

const families = [
  ['1/2 Pollo Broaster', 'Combo De Pollo Mixto', 'Sopa De Mondongo Pequeña'],
  ['Burrito Vegetal', 'Combo De Bowl Vegetal', 'Crema De Tomate Pequeña'],
];
const purchase = (names: string[]) => names[0].startsWith('1/2') ? 'Me regalas porfa medio pollo a la Broaster' : `Me regalas porfa un ${names[0]}`;
function setup(names: string[], agent: boolean) {
  const menu = names.map((name, i) => ({ id: 46001+i, code: 46001+i, name,
    description: i===1?'Con papa y bebida incluida':'Preparado en casa', price: [26000,57000,9500][i],
    availableNow:true,hasAttributes:i===1||(i===0&&name.includes('Pollo')),attributes:i===0&&name.includes('Pollo')?[{attributeName:'Arepas',options:['Blancas','Fritas']}]:i===1?[{attributeName:'Bebida',options:['Colombiana','Coca cola']}]:[] }));
  const h=harness(menu,agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:460,dailyOrderNumber:460});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:1,source:'google_directions',geocodedAddress:'Calle 10 #20-30, Bogotá',customer:{lat:4.64,lng:-74.14}})};
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  const original=h.service.conversationService.claimInboundMessage,claimed=new Set<string>();
  h.service.conversationService.claimInboundMessage=jest.fn(async(input:any)=>{if(claimed.has(input.waMessageId))return null;claimed.add(input.waMessageId);return original(input);});
  let seq=0;
  const message=(id:string,text:string)=>({waId:'customer',phoneE164:h.conv.phoneE164,messageId:id,messageType:'text',text,timestamp:++seq,raw:{}});
  async function burst(entries:Array<[string,string]>) {
    jest.useFakeTimers();
    try {const waits=entries.map(([id,text])=>h.service.handleIncoming(message(id,text)));await jest.advanceTimersByTimeAsync(4000);await Promise.all(waits);}
    finally{jest.useRealTimers();}
  }
  async function delivery(entries:Array<[string,string]>,mode:string) {
    if(mode==='together')return burst(entries);
    if(mode==='separate'){for(const entry of entries)await burst([entry]);return;}
    if(mode==='partial-retry'){await burst([entries[0]]);await burst(entries);return;}
    // A fresh bubble arrives after the first message was claimed, while its turn is still processing.
    let release!:()=>void,entered!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;}),ready=new Promise<void>(resolve=>{entered=resolve;});
    const old=h.service.conversationService.claimInboundMessage;let blocked=false;
    h.service.conversationService.claimInboundMessage=jest.fn(async(input:any)=>{const result=await old(input);if(!blocked&&result){blocked=true;entered();await gate;}return result;});
    const first=h.service.handleIncoming(message(...entries[0]));
    const flush=h.service.flushInboundCoalesce('customer');await ready;
    const rest=entries.slice(1).map(([id,text])=>h.service.handleIncoming(message(id,text)));
    release();await flush;await first;await h.service.flushInboundCoalesce('customer');await Promise.all(rest);
  }
  return {h,burst,delivery};
}
for(const names of families)for(const agent of [false,true])for(const mode of ['together','separate','partial-retry','during-turn']) {
  it(`${names[0]} address bubble ${agent}/${mode}`,async()=>{
    const {h,burst,delivery}=setup(names,agent);
    await delivery([['buy',purchase(names)],['address','Calle 10 #20-30']],mode);
    expect(h.conv.sessionData.cart.map(p=>[p.productId,p.quantity])).toEqual([[46001,1]]);
    expect(h.conv.sessionData.address).toContain('20-30');expect(h.conv.sessionData.addressConfirmed).toBe(true);
    const before=structuredClone(h.conv.sessionData.cart),replies=h.replies.length;
    await burst([['buy',purchase(names)],['address','Calle 10 #20-30']]);
    expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies).toHaveLength(replies);
    await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(p=>p.productId)).toEqual([46001]);expect(dto.address).toContain('20-30');
  });
  it(`${names[1]} drink bubble ${agent}/${mode}`,async()=>{
    const {h,burst,delivery}=setup(names,agent);
    await delivery([['buy',`Un ${names[1]} y una ${names[2]}`],['drink','El combo con Coca-Cola por fa']],mode);
    expect(h.conv.sessionData.cart.map(p=>[p.productId,p.quantity]).sort()).toEqual([[46002,1],[46003,1]]);
    const combo=h.conv.sessionData.cart.find(p=>p.productId===46002),soup=h.conv.sessionData.cart.find(p=>p.productId===46003);
    expect(combo!.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Coca cola'});expect(soup!.note||'').not.toMatch(/coca/i);expect(soup!.attributes).toEqual([]);
    const before=structuredClone(h.conv.sessionData.cart),replies=h.replies.length;
    await burst([['buy',`Un ${names[1]} y una ${names[2]}`],['drink','El combo con Coca-Cola por fa']]);expect(h.conv.sessionData.cart).toEqual(before);expect(h.replies).toHaveLength(replies);
    await h.sendQueued('no mas');await h.sendQueued('Calle 10 #20-30');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.map(p=>p.productId).sort()).toEqual([46002,46003]);expect(dto.items.find(p=>p.productId===46003).note||'').not.toMatch(/coca/i);
  });
}
for(const names of families)for(const agent of [false,true])for(const scenario of ['repeat-value','another','two-units','two-combos','question','unknown']) {
  it(`${names[1]} scoped beverage guard ${agent}/${scenario}`,async()=>{
    const {h,burst}=setup(names,agent);
    await burst([['buy',`Un ${names[1]} y una ${names[2]}`]]);
    if(scenario==='two-units')await burst([['extra',`Otro ${names[1]}`]]);
    if(scenario==='two-combos'){
      // Add an independently priced second combo through the catalog/router.
      const menu=await h.service.catalogService.getMenuProducts();menu.push({...menu[1],id:46004,code:46004,name:'Combo De Pasta Integral'});
      await burst([['extra','Un Combo De Pasta Integral']]);
    }
    const before=structuredClone(h.conv.sessionData.cart),start=h.replies.length;
    if(scenario==='another'){
      await burst([['change',`Otro ${names[1]} con Coca-Cola`]]);
      expect(h.conv.sessionData.cart.filter(p=>p.productId===46002).reduce((n,p)=>n+p.quantity,0)).toBe(2);
    }else{
      const text=scenario==='question'?'¿El combo con Coca-Cola?':scenario==='unknown'?'El combo con Tamarindo':'El combo con Coca-Cola por fa';
      await burst([['change',text]]);
      const reply=h.replies.slice(start).join('\n');
      if(scenario==='repeat-value'){
        expect(reply).toMatch(/cambi[eé] la bebida incluida/i);expect(reply).not.toMatch(/no manejamos|no entend[ií]/i);
        const changed=structuredClone(h.conv.sessionData.cart);await burst([['repeat','El combo con Coca-Cola por fa']]);expect(h.conv.sessionData.cart).toEqual(changed);
        expect(changed.find(p=>p.productId===46002)!.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Coca cola'});
      }else{
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(reply).toMatch(scenario==='question'?/pedido sigue igual/i:/cu[aá]l plato|bebida incluida/i);
      }
    }
    expect(h.conv.sessionData.cart.filter(p=>p.productId===46003)).toEqual(before.filter(p=>p.productId===46003));
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('no mas');await h.sendQueued('Calle 10 #20-30');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items.filter(p=>p.productId===46003)).toHaveLength(1);expect(dto.items.filter(p=>p.productId===46002)).toHaveLength(['another','two-units'].includes(scenario)?2:1);
  });
}
for(const names of families)for(const agent of [false,true])for(const mode of ['together','separate']) {
  it(`${names[0]} new order after completed delivery ${agent}/${mode}`,async()=>{
    const {h,delivery}=setup(names,agent);
    // Mirror the persistence reset contract; the router still performs the reopen.
    h.service.conversationService.reopenForNewOrder=jest.fn(async()=>{const old=h.conv.sessionData;h.conv.state='building_cart';h.conv.sessionData={cart:[],orderType:'delivery',ignorePriorOrderHistory:true,fulfillmentChosen:false,addressConfirmed:false,phoneConfirmed:false,contactPhone:null,lastDeliveryAddress:old.lastDeliveryAddress||null};});
    await h.sendQueued(`Un ${names[2]}`);await h.sendQueued('no mas');await h.sendQueued('Calle 10 #20-30');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
    expect(h.conv.state).toBe('completed');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);h.service.ordersService.create.mockClear();
    await delivery([['new-buy',purchase(names)],['new-address','Calle 10 #20-30']],mode);
    expect(h.conv.sessionData.cart.map(p=>[p.productId,p.quantity])).toEqual([[46001,1]]);
    expect(h.conv.sessionData.address).toContain('20-30');await h.sendQueued('no mas');await h.sendQueued('3000000001');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.service.ordersService.create.mock.calls[0][0].items.map(p=>p.productId)).toEqual([46001]);
  });
}
