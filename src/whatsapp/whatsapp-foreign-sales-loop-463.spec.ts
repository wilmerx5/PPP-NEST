import { isForeignSalesPitch } from './whatsapp-foreign-sales';
import { harness, products } from './whatsapp-accuracy.test-support';
import { readFileSync } from 'fs';
import { join } from 'path';
const replay=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-foreign-sales-loop-463.json'),'utf8')).messages as string[];
for(const agent of [false,true])for(const existing of [false,true])it(`foreign sales loop does not buy or fuel replies ${agent}/${existing}`,async()=>{
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});h.service.ordersService.create=jest.fn().mockResolvedValue({id:463,dailyOrderNumber:463});h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 if(existing)await h.sendQueued('Un Arroz Con Pollo sin cebolla');
 const before=structuredClone(h.conv.sessionData.cart),start=h.replies.length;h.agent.runTurn.mockClear();h.service.aiService.classifyMessage.mockClear();h.service.aiService.generateTurn.mockClear();
 for(const message of replay){await h.sendQueued(message);expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();}
 await h.sendQueued('Mensaje (unsupported)',{messageType:'other'});
 expect(h.replies.slice(start)).toHaveLength(1);expect(h.replies[start]).not.toMatch(/\?|ll[aá]ma|3000000007/i);expect(h.agent.runTurn).not.toHaveBeenCalled();expect(h.service.aiService.classifyMessage).not.toHaveBeenCalled();expect(h.service.aiService.generateTurn).not.toHaveBeenCalled();
 await h.sendQueued('Quiero pedir un Arroz Con Pollo');
 expect(h.conv.sessionData.cart.reduce((n,p)=>n+p.quantity,0)).toBe(existing?2:1);
 await h.sendQueued('nada mas');await h.sendQueued('contraentrega');await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});

it('preserves the entire session and contact during a sales campaign', async () => {
 const h=harness(products,false);
 await h.sendQueued('Un Arroz Con Pollo sin cebolla');
 h.conv.sessionData.notesCollected=true;
 h.conv.sessionData.pendingPriceInquiry={cartSignature:'preserve',state:'awaiting_payment',productIds:[23]};
 const before=structuredClone(h.conv.sessionData);
 const name=h.conv.customerName;
 await h.sendQueued(replay[0]);
 const {foreignSales,...rest}=h.conv.sessionData;
 expect(rest).toEqual(before);expect(foreignSales).toBeDefined();expect(h.conv.customerName).toBe(name);
});

it('does not keep the number blocked after a real menu request',async()=>{
 const h=harness(products,false);
 await h.sendQueued(replay[0]);await h.sendQueued('menú');
 expect(h.conv.sessionData.foreignSales).toBeUndefined();
 expect(h.replies.length).toBeGreaterThan(1);
});

it('expires followup suppression after one hour and rate limits renewed notices for a day',async()=>{
 const h=harness(products,false);let now=Date.now();
 const clock=jest.spyOn(Date,'now').mockImplementation(()=>now);
 try {
  await h.sendQueued(replay[0]);const start=h.replies.length;
  now+=59*60_000;await h.sendQueued('sigue en linea?');expect(h.replies).toHaveLength(start);
  now+=2*60_000;await h.sendQueued('gracias');expect(h.replies.length).toBeGreaterThan(start);
  const next=h.replies.length;await h.sendQueued(replay[0]);expect(h.replies).toHaveLength(next);
  now+=24*60*60_000;await h.sendQueued(replay[0]);expect(h.replies).toHaveLength(next+1);
 } finally {clock.mockRestore();}
});

it('does not interfere with human takeover',async()=>{
 const h=harness(products,false);Object.assign(h.conv,{humanTakeover:true});
 await h.sendQueued(replay[0]);expect(h.conv.sessionData.foreignSales).toBeUndefined();expect(h.replies).toHaveLength(0);
});

for (const message of [
 'Soy asesor de planes móviles y quiero pedir un Arroz Con Pollo',
 'Quisiera pedir un combo para mi oficina de telefonía',
 '¿Puedo pagar con tarjeta de crédito?',
 'Quiero un plan de almuerzos para cinco personas',
 '¿Tienen primer plato gratis?',
 '¿Cuánto cuesta un pollo?',
]) it(`allows ordinary customer text: ${message}`,()=>expect(isForeignSalesPitch(message)).toBe(false));
for (const message of [
 'Soy asesor de planes móviles, tenemos 60GB gratis',
 'Ofrecemos planes pospago, primer mes gratis',
 'Vendemos planes de celular, conserva tu número',
]) it(`recognizes generic mobile sales: ${message}`,()=>expect(isForeignSalesPitch(message)).toBe(true));

for (const answer of ['sí','1','confirmar','por favor']) it(`does not let campaign replies confirm a customer's pending order: ${answer}`,async()=>{
 const h=harness(products,false);
 await h.sendQueued('Un Arroz Con Pollo');
 h.conv.state='awaiting_final_confirm';
 h.service.ordersService.create=jest.fn();
 const before=structuredClone(h.conv.sessionData);
 await h.sendQueued(replay[0]);const count=h.replies.length;
 await h.sendQueued(answer);
 const {foreignSales,...rest}=h.conv.sessionData;
 expect(rest).toEqual(before);expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.replies).toHaveLength(count);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});

it('resumes a plain food order and allows the following no to advance checkout',async()=>{
 const h=harness(products,false);
 await h.sendQueued(replay[0]);
 await h.sendQueued('Un Arroz Con Pollo');
 expect(h.conv.sessionData.cart).toHaveLength(1);expect(h.conv.sessionData.foreignSales).toBeUndefined();
 await h.sendQueued('no');expect(h.conv.state).not.toBe('browsing');
});
