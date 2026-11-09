import { harness, products } from './whatsapp-accuracy.test-support';

const prior = {id:74001,code:74001,name:'Arroz Blanco',price:6000,hasAttributes:false};
const families = [
  { label:'PPP', menu:products, name:'Arroz Con Pollo', id:23 },
  { label:'bowl', menu:[{id:71001,code:71001,name:'Bowl De Garbanzos',price:19000,description:'Bowl vegetariano',hasAttributes:false}], name:'Bowl De Garbanzos', id:71001 },
  { label:'falafel', menu:[{id:72001,code:72001,name:'Falafel',price:17000,description:'Croquetas de garbanzo',hasAttributes:false}], name:'Falafel', id:72001 },
];
const pitch='Soy asesor de planes móviles. Tenemos planes pospago con primer mes gratis. ¿Te interesa?';
const prefixes=['Quiero pedir un','Quisiera ordenar un','Me gustaría pedir un','Hola, quisiera pedir un'];

function setup(family: typeof families[number], agent:boolean) {
  const h=harness([...family.menu,prior],agent);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:464,dailyOrderNumber:464});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  return h;
}
async function finish(h:ReturnType<typeof setup>) {
  const expected=structuredClone(h.conv.sessionData.cart);
  await h.sendQueued('nada mas');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items.map(p=>p.productId).sort()).toEqual(expected.flatMap(p=>Array(p.quantity).fill(p.productId)).sort());
  for(const line of expected)if(line.note)expect(dto.items.find(p=>p.productId===line.productId).note).toBe(line.note);
}

for(const family of families)for(const agent of [false,true])for(const prefix of prefixes)for(const phase of ['first','cart','payment','final']) {
  it(`named order intro ${family.label}/${agent}/${prefix}/${phase}`,async()=>{
    const h=setup(family,agent);
    if(phase!=='first') {
      await h.sendQueued('Un Arroz Blanco bien empacado');
      if(phase!=='cart')await h.sendQueued('nada mas');
      if(phase==='final')await h.sendQueued('contraentrega');
      if(phase!=='cart')expect(h.conv.state).toBe(phase==='final'?'awaiting_final_confirm':'awaiting_payment');
    }
    const before=structuredClone(h.conv.sessionData.cart);
    const counter=h.service.conversationService.countInboundMessages;
    if(phase==='first')h.service.conversationService.countInboundMessages=async()=>1;
    await h.sendQueued(`${prefix} ${family.name}`);
    h.service.conversationService.countInboundMessages=counter;
    expect(h.conv.sessionData.cart.map(p=>[p.productId,p.quantity]).sort()).toEqual([[family.id,1],...before.map(p=>[p.productId,p.quantity])].sort());
    expect(h.conv.sessionData.cart.filter(p=>p.productId===prior.id)).toEqual(before);
    expect(h.replies.at(-1)).toContain(family.name);
    expect(h.replies.at(-1)).not.toContain('Escribe el *plato*');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await finish(h);
  });
}

for(const family of families)for(const agent of [false,true]) {
  it(`prefixed purchase resumes after sales ${family.label}/${agent}`,async()=>{
    const h=setup(family,agent);
    await h.sendQueued('Un Arroz Blanco bien empacado');const before=structuredClone(h.conv.sessionData.cart);
    await h.sendQueued(pitch);const count=h.replies.length;
    await h.sendQueued('sigue en linea?');expect(h.replies).toHaveLength(count);expect(h.conv.sessionData.cart).toEqual(before);
    await h.sendQueued(`Quiero pedir un ${family.name}`);
    expect(h.conv.sessionData.foreignSales).toBeUndefined();
    expect(h.conv.sessionData.cart.find(p=>p.productId===family.id)).toMatchObject({quantity:1});
    expect(h.conv.sessionData.cart.filter(p=>p.productId===prior.id)).toEqual(before);
    expect(h.replies.at(-1)).toContain(family.name);await finish(h);
  });
  for(const question of [`¿Cómo viene ${family.name}?`,`Quiero saber cuánto vale ${family.name}`,`¿Puedo pedir ${family.name}?`,`Si quiero pedir un ${family.name}, ¿cuánto sería?`,`No quiero pedir ${family.name}`]) {
    it(`named inquiry or negation preserves cart ${family.label}/${agent}/${question}`,async()=>{
      const h=setup(family,agent);await h.sendQueued('Un Arroz Blanco bien empacado');const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(question);expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.replies.at(-1)).toBeTruthy();
    });
  }
}
for(const agent of [false,true])for(const phrase of ['Quiero pedir','Quisiera ordenar','Me gustaría hacer un pedido','Hola, para hacer un pedido']) {
  it(`unspecified order still asks for food ${agent}/${phrase}`,async()=>{
    const h=setup(families[1],agent);h.service.conversationService.countInboundMessages=async()=>1;
    await h.sendQueued(phrase);expect(h.conv.sessionData.cart).toEqual([]);expect(h.replies.at(-1)).toMatch(/qu[eé].*(?:antoja|pedir)|dime.*plato/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}

for(const family of families.slice(1))for(const agent of [false,true]) {
  it(`named unavailable dish remains unavailable ${family.label}/${agent}`,async()=>{
    const h=setup({...family,menu:family.menu.map(p=>({...p,availableNow:false}))},agent);
    h.cfg.ignoreBusinessHours=false;
    await h.sendQueued(`Quiero pedir un ${family.name}`);
    expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
    expect(h.replies.at(-1)).toMatch(/no|agotad|disponib|horario/i);
  });
}
