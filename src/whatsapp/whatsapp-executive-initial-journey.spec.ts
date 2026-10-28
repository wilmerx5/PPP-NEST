/** CHAT2510-05 initial messages, no personal source data. Isolated source fragment with an added catalog clarification and synthetic checkout. */
import {harness,products} from './whatsapp-accuracy.test-support';
for(const agent of [false,true])it(`initial two-executive source journey agent=${agent}`,async()=>{
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
 const messages=['Buenas tardes para un domicilio','Me puedes dar dos bandejas ejecutivos','De sopa sería los dos ajiacos pollo que la frito los dos y un pollo que sea pechuga y el otro colombina','Y de tomar limonada por f','Y me das un adicional de limonada'];
 const turns:unknown[]=[];
 for(const text of messages){await h.sendQueued(text);turns.push({text,reply:h.replies.at(-1),state:h.conv.state,session:structuredClone(h.conv.sessionData)});}
 expect((h.conv.sessionData as any).pendingUnitDistribution).toBeDefined();
 expect(foodChoice(turns,2)).toEqual(['Pierna Pernil']);
 expect(h.conv.sessionData.cart.filter(row=>/^Ejecutivo /i.test(row.name)).every(row=>row.attributes?.some(a=>a.attributeName==='Bebida'&&a.attributeValue==='Limonada'))).toBe(true);
 // The customer's two meals never authorize separate whole chickens or soup SKUs.
 const food=h.conv.sessionData.cart.filter(row=>!/^limonada/i.test(row.name));
 expect(food.every(row=>/^Ejecutivo /i.test(row.name))).toBe(true);
 expect(food.reduce((n,row)=>n+row.quantity,0)).toBe(2);
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued('uno con pechuga y el otro con colombina');
 expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingUnitDistribution).toBeDefined();
 // Added clarification uses catalog values; it does not equate colombina to a known cut.
 await h.sendQueued('uno con Ala, pechuga y el otro con Pierna Pernil');
 expect(h.conv.sessionData.pendingUnitDistribution).toBeUndefined();
 const meals=h.conv.sessionData.cart.filter(row=>row.productId===22);expect(meals.map(row=>row.quantity)).toEqual([1,1]);
 expect(meals.map(row=>row.attributes?.find(a=>a.attributeName==='Presa')?.attributeValue)).toEqual(['Ala, pechuga','Pierna Pernil']);
 expect(meals.every(row=>row.attributes?.some(a=>a.attributeName==='Sopa'&&a.attributeValue==='Ajiaco')&&row.attributes?.some(a=>a.attributeName==='Bebida'&&a.attributeValue==='Limonada'))).toBe(true);
 Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 await h.sendQueued('Para Calle 10 #20-30');await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(3);expect(dto.items.filter((row:{productId:number})=>row.productId===22)).toHaveLength(2);
 expect(dto.items.filter((row:{productId:number})=>row.productId!==22)).toHaveLength(1);

});

function foodChoice(turns:unknown[],index:number):string[]{return [...new Set<string>((turns[index] as any).session.cart.flatMap((p:any)=>(p.attributes||[]).filter((a:any)=>a.attributeName==='Presa').map((a:any)=>a.attributeValue)))];}
