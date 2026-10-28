import {resolveDescribedSidePhrase as resolve} from './whatsapp-described-side';
import {harness,products} from './whatsapp-accuracy.test-support';
it.each([
 ['papa salda','Con papa salada y arepa','papa salada'],
 ['pan torstado','Con pan tostado y bebida','pan tostado'],
 ['arroz basmti','Con arroz basmati y salsa','arroz basmati'],
 ['papa salda','Con papa salada y papa salsa',null],
 ['papa salda','Con papa salada o papa salta',null],
 ['papa salada','Con papa salada y papa salta','papa salada'],
 ['pap salda','Con papa salada',null],
 ['salda','Con papa salada',null],
 ['papa inexistente','Con papa salada',null],
 ['papa salda','Con papa francesa',null],
 ['papa salda','Papa salada, papa salada','papa salada'],
] as const)('description-grounded phrase %s / %s', (phrase,description,expected)=>expect(resolve(phrase,description)).toBe(expected));
for(const agent of [false,true])it(`CHAT2510-08 typo, selected drink and repeated request: ${agent}`,async()=>{
 const h=harness(products,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);h.service.ordersService.create=jest.fn().mockResolvedValue({id:999,dailyOrderNumber:99});
 Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 await h.sendQueued('Me regalas un combo de pollo frito con Pepsi');
 expect(h.conv.sessionData.cart.map(p=>[p.productId,p.quantity])).toEqual([[99,1]]);
 const attrs=structuredClone(h.conv.sessionData.cart[0].attributes);
 expect(attrs).toContainEqual({attributeName:'Bebida',attributeValue:'Pepsi'});
 await h.sendQueued('Con que viene el\nCombo\n?');expect(h.conv.sessionData.pendingMatch).toBeFalsy();
 const source='no, el combo  que ya te pedi, lo quiero con  en vez de papá salda me regalas yuca';
 await h.sendQueued(source);expect(h.conv.sessionData.cart).toHaveLength(1);
 expect(h.conv.sessionData.cart[0].note).toMatch(/sin papa salada.*con yuca/i);
 expect(h.conv.sessionData.cart[0].attributes).toEqual(attrs);
 const edited=structuredClone(h.conv.sessionData.cart);await h.sendQueued(source);expect(h.conv.sessionData.cart).toEqual(edited);
 await h.sendQueued('contraentrega');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(1);expect(dto.items[0]).toMatchObject({productId:99,note:edited[0].note,attributes:attrs});
});
