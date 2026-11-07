import {harness} from './whatsapp-accuracy.test-support';
const requests=['Podrías confirmar si es posible','¿Puedes consultar si se puede?','Me puedes verificar si lo cambian','Puedes averiguar si es posible por favor','¿Lo puedes confirmar con cocina?'];
for(const dish of ['Pollo Broaster','Bandeja Vegetal'])for(const agent of [false,true])for(const state of ['building_cart','awaiting_name','awaiting_attribute'])for(const question of requests)it(`unverified change followup ${dish}/${agent}/${state}/${question}`,async()=>{
 const menu=[{id:41411,code:11,name:dish,price:24000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Limonada','Ginger']}]}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
 h.conv.state=state;h.conv.sessionData.cart=[{productId:41411,code:11,name:dish,quantity:1,unitPrice:24000,attributes:[{attributeName:'Bebida',attributeValue:'Ginger'}]}];
 if(state==='awaiting_attribute')h.conv.sessionData.pendingAttribute={productId:41411,code:11,name:dish,price:24000,quantity:1,attributes:menu[0].attributes,selected:[],sourceText:'otro '+dish};
 h.replies.push('Puede que te las hayan cambiado antes, pero no tengo confirmada esa sustitución. Sí tenemos una porción aparte; si quieres, puedes pedirla aparte.');
 const before=structuredClone(h.conv.sessionData),name=h.conv.customerName;const reply=await h.sendQueued(question);
 expect(reply).toMatch(/confirm|verific/i);expect(reply).toMatch(/no puedo.*cocina/i);expect(reply).toContain('3118866823');expect(reply).not.toMatch(/no entend[ií]|te paso|ya consult[eé]|ya confirm[eé]/i);
 expect(h.conv.sessionData).toEqual(before);expect(h.conv.state).toBe(state);expect(h.conv.customerName).toBe(name);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

function guardSetup(agent:boolean){
 const h=harness([{id:41421,code:21,name:'Arroz Vegetal',price:20000,availableNow:true,hasAttributes:false,attributes:[]}],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:414,dailyOrderNumber:414});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{cart:[{productId:41421,code:21,name:'Arroz Vegetal',quantity:1,unitPrice:20000,attributes:[]}],orderType:'pickup',fulfillmentChosen:true,paymentMethod:'cash',contactPhone:h.conv.phoneE164,phoneConfirmed:true,notesCollected:true});return h;
}
for(const agent of [false,true]){
 for(const previous of ['No tengo confirmada esa sustitución.','No puedo confirmarlo con cocina desde este chat. Para comprobar ese cambio, llama al local.'])it(`explicit final confirmation remains independent ${agent}/${previous}`,async()=>{
  const h=guardSetup(agent);h.conv.state='awaiting_final_confirm';h.replies.push(previous);const reply=await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(reply).toMatch(/registrado/i);
 });
 for(const previous of ['¿Algo más?','No tengo confirmado el horario de mañana.','Sí, puedes pedir ese cambio.'])it(`verification requires current uncertain change context ${agent}/${previous}`,async()=>{
  const h=guardSetup(agent);h.replies.push('No tengo confirmada esa sustitución.',previous);const cart=structuredClone(h.conv.sessionData.cart);const reply=await h.sendQueued('Podrías confirmar si es posible');expect(reply).not.toMatch(/no puedo confirmarlo con cocina desde este chat/i);expect(h.conv.sessionData.cart).toEqual(cart);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`repeated verification retains its context ${agent}`,async()=>{
  const h=guardSetup(agent);h.replies.push('No tengo confirmada esa sustitución.');await h.sendQueued('Podrías confirmar si es posible');const reply=await h.sendQueued('¿Puedes consultar si se puede?');expect(reply).toMatch(/no puedo.*cocina/i);expect(reply).not.toMatch(/no entend[ií]/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
}
