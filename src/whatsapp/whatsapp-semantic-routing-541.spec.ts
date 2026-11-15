import { harness } from './whatsapp-accuracy.test-support';
import type { AgentV1TurnResult } from './whatsapp-agent.service';

const catalogs = [['Arroz Con Pollo','Sopa De Ajiaco'],['Lasaña Vegetal','Crema De Tomate']];
function setup(names: string[]) {
  const menu = names.map((name,index)=>({id:54101+index,code:11+index,name,price:10000,availableNow:true,hasAttributes:false,attributes:[]}));
  const h = harness(menu,true);
  h.service.settingsService.semanticRoutingEnabled = () => true;
  h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
  h.service.conversationService.saveSemanticSession = jest.fn(async (_conv,expected,session,state,name) => {
    if (h.conv.state !== expected.state || JSON.stringify(h.conv.sessionData) !== JSON.stringify(expected.session)) return false;
    h.conv.sessionData = structuredClone(session);h.conv.state=state;
    if (name) h.conv.customerName=name;
    return true;
  });
  h.service.ordersService.create = jest.fn().mockResolvedValue({id:541,dailyOrderNumber:541});
  return {...h,menu};
}
function result(text: string, role: string, actions: AgentV1TurnResult['actions'] = {}, reply = '¿Qué prefieres aclarar?') {
  return {semanticIntent:{segments:[{text,role}]},fulfilledSemanticSegments:Object.keys(actions).length ? [text] : [],actions,reply,toolCalls:['interpret_message','get_cart']};
}

for (const names of catalogs) for (const state of ['building_cart','awaiting_name','awaiting_address','awaiting_payment','awaiting_final_confirm']) {
  for (const text of [
    'No te estoy pidiendo otro, te pregunto cuánto vale',
    'Estoy comparando primero, todavía no me agregues nada',
    'Cómo sería para cuatro personas, eso alcanza o me quedo corto',
  ]) it(`complete inquiry preserves cart and checkout ${names[0]} ${state} ${text}`, async () => {
    const h=setup(names);h.conv.state=state;
    h.conv.sessionData.cart=[{productId:54101,code:11,name:names[0],quantity:2,unitPrice:10000,attributes:[],note:'Sin sal'}];
    const before=structuredClone(h.conv.sessionData);
    h.agent.runTurn.mockResolvedValue(result(text,'inquiry',{},'El pedido conserva sus dos unidades. ¿Qué detalle quieres consultar?'));
    const reply=await h.sendQueued(text);
    expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);
    expect(h.agent.runTurn).toHaveBeenCalledTimes(1);
    expect(h.agent.runTurn.mock.calls[0][0]).toMatchObject({userMessage:text,semanticInterpretation:true});
    expect(reply).toContain('conserva sus dos unidades');
    expect(reply).not.toMatch(/no (?:tenemos|manejamos)|Listo ✅/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
for (const names of catalogs) for (const fault of ['no_contract','inquiry_add','unclear_add','partial_error','throw','dropped_context','stale','rejected_edit']) {
  it(`uncertain interpretation never falls through to a second purchase parser ${names[0]} ${fault}`, async () => {
    const h=setup(names);const text=`Déjame revisar, no he dicho que agregues ${names[0]}`;
    const before=structuredClone(h.conv.sessionData);
    let proposal:any=result(text,'purchase',{addItems:[{productId:54101,quantity:1}]},'Listo, agregado');
    if(fault==='no_contract')delete proposal.semanticIntent;
    if(fault==='inquiry_add')proposal.semanticIntent.segments[0].role='inquiry';
    if(fault==='unclear_add')proposal.semanticIntent.segments[0].role='unclear';
    if(fault==='partial_error')proposal.error='openai_timeout';
    if(fault==='dropped_context')proposal.semanticIntent.segments[0].text=names[0];
    if(fault==='rejected_edit')proposal.rejectedCartEdits=[{reason:'missing_or_ambiguous_cart_line'}];
    if(fault==='throw')h.agent.runTurn.mockRejectedValue(new Error('synthetic'));
    else if(fault==='stale')h.agent.runTurn.mockImplementation(async()=>{h.conv.state='awaiting_payment';return proposal;});
    else h.agent.runTurn.mockResolvedValue(proposal);
    const reply=await h.sendQueued(text);
    expect(h.conv.sessionData).toEqual(before);
    expect(reply).toMatch(/aclaras/i);expect(reply).not.toMatch(/agregado|no manejamos/i);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
}
for(const names of catalogs) it(`a complete purchase plan preserves quantities and proceeds through the normal final confirmation ${names[0]}`,async()=>{
  const h=setup(names);const text=`Veci, ayúdame hoy con dos ${names[0]} y una ${names[1]}`;
  Object.assign(h.conv.sessionData,{fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  h.agent.runTurn.mockResolvedValue(result(text,'purchase',{addItems:[{productId:54101,quantity:2,note:'Sin sal'},{productId:54102,quantity:1}]},''));
  await h.sendQueued(text);
  expect(h.conv.sessionData.cart.map(line=>[line.productId,line.quantity])).toEqual([[54101,2],[54102,1]]);
  await h.sendQueued('contraentrega');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([54101,54101,54102]);
});

for(const names of catalogs) it(`a deferred attribute choice retains its original quantity ${names[0]}`,async()=>{
  const h=setup(names);h.menu[0].name='Jugo Natural';h.menu[0].hasAttributes=true;h.menu[0].attributes=[{attributeName:'Sabor',options:['Mango','Mora']}] as never;
  const text='Ayúdame con dos jugos naturales';
  h.agent.runTurn.mockResolvedValue(result(text,'purchase',{addItems:[{productId:54101,quantity:2}]}));
  await h.sendQueued(text);
  expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:54101,quantity:2});
  expect(h.conv.sessionData.cart).toEqual([]);
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:54101,quantity:2,
    attributes:[{attributeName:'Sabor',attributeValue:'Mora'}]})]);
});
for(const names of catalogs) it(`an offer binds the following numeric selection to its catalog owner ${names[0]}`,async()=>{
  const h=setup(names);const text='Dame dos de esos, ¿cuál me recomiendas?';
  const proposal:any=result(text,'purchase');proposal.offeredProducts={productIds:[54101,54102],quantity:2};proposal.fulfilledSemanticSegments=[text];
  h.agent.runTurn.mockResolvedValue(proposal);
  await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([]);
  expect(h.conv.sessionData.pendingMatch).toMatchObject({intent:'order',quantity:2});
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:54102,quantity:2})]);
});
it('a commit acknowledged as lost is recovered from its persisted decision marker',async()=>{
  const h=setup(catalogs[0]);const text='Un arroz con pollo';
  h.agent.runTurn.mockResolvedValue(result(text,'purchase',{addItems:[{productId:54101,quantity:1}]}));
  h.service.conversationService.saveSemanticSession.mockImplementation(async(_conv,_expected,next,state)=>{
    h.conv.sessionData=structuredClone(next);h.conv.state=state;throw new Error('commit acknowledgement lost');
  });
  const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:54101,quantity:1})]);
  expect(reply).toContain('Arroz Con Pollo');expect(reply).not.toMatch(/repetirlo|sigue igual/i);
});
it('an uncertain failed write asks for verification without reporting a successful change',async()=>{
  const h=setup(catalogs[0]);const text='Un arroz con pollo';
  h.agent.runTurn.mockResolvedValue(result(text,'purchase',{addItems:[{productId:54101,quantity:1}]}));
  h.service.conversationService.saveSemanticSession.mockRejectedValue(new Error('uncertain write'));
  const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([]);expect(reply).toMatch(/no pude comprobar/i);expect(reply).not.toMatch(/listo|agregué/i);
});

it('two deferred products retain independent quantities and selected options',async()=>{
  const h=setup(catalogs[1]);
  h.menu.forEach((product,index)=>{product.name=['Jugo Natural','Jugo En Leche'][index];product.hasAttributes=true;product.attributes=[{attributeName:'Sabor',options:['Mango','Mora']}] as never;});
  const text='Dos del primero y tres del segundo';
  h.agent.runTurn.mockResolvedValue(result(text,'purchase',{addItems:[{productId:54101,quantity:2},{productId:54102,quantity:3}]}));
  await h.sendQueued(text);
  await h.sendQueued('1');
  expect(h.conv.sessionData.pendingAttribute).toMatchObject({productId:54102,quantity:3});
  await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual([
    expect.objectContaining({productId:54101,quantity:2,attributes:[{attributeName:'Sabor',attributeValue:'Mango'}]}),
    expect.objectContaining({productId:54102,quantity:3,attributes:[{attributeName:'Sabor',attributeValue:'Mora'}]}),
  ]);
  expect(h.conv.sessionData.pendingAttribute).toBeUndefined();
});
it('an informational list selection provides facts without purchasing',async()=>{
  const h=setup(catalogs[1]);const text='Cuáles platos tienes para comparar';
  const proposal:any=result(text,'inquiry');proposal.offeredProducts={productIds:[54101,54102],quantity:1};
  h.agent.runTurn.mockResolvedValue(proposal);await h.sendQueued(text);
  expect(h.conv.sessionData.pendingMatch).toMatchObject({intent:'info'});
  const reply=await h.sendQueued('2');
  expect(h.conv.sessionData.cart).toEqual([]);expect(reply).toContain(catalogs[1][1]);
});
it('a replacement choice preserves both units and the unrelated product',async()=>{
  const h=setup(catalogs[1]);
  h.conv.sessionData.cart=[{productId:54101,code:11,name:catalogs[1][0],quantity:2,unitPrice:10000,attributes:[],note:'Sin sal'},
    {productId:54102,code:12,name:catalogs[1][1],quantity:1,unitPrice:10000,attributes:[]}];
  h.menu.push({id:54103,code:13,name:'Lasaña De Hongos',price:12000,availableNow:true,hasAttributes:false,attributes:[]});
  const text='Cambia las dos lasañas por la otra preparación';const proposal:any=result(text,'edit');
  proposal.offeredProducts={productIds:[54103],quantity:2,replaceCartLineIndex:0};proposal.fulfilledSemanticSegments=[text];
  h.agent.runTurn.mockResolvedValue(proposal);await h.sendQueued(text);await h.sendQueued('1');
  expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([
    expect.objectContaining({productId:54103,quantity:2}),expect.objectContaining({productId:54102,quantity:1})]));
  expect(h.conv.sessionData.cart).toHaveLength(2);
});
