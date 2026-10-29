import {normalizeCorrection} from './whatsapp-quantity-correction';
import {harness} from './whatsapp-accuracy.test-support';
// Paired controls distinguish contradictory ingredient instructions from unrelated notes.
const cases = [
 ['sin cebolla','poca cebolla',true], ['sin cebolla','menos cebolla',true],
 ['sin cebolla','con poca cebolla',true], ['sin cebolla','cebolla aparte',true],
 ['sin azúcar','bajita de azúcar',true], ['sin azúcar','poca azúcar',true],
 ['sin sal','bajito de sal',true], ['sin tomate','extra tomate',true],
 ['sin cebolla y sin tomate','con tomate',true], ['sin cebolla','salsa aparte; con cebolla',true],
 ['sin cebolla','salsa aparte',false], ['sin cebolla','poco picante',false],
 ['sin azúcar','sin hielo',false], ['sin sal','bien empacado',false],
 ['sin tomate','sin cebolla',false], ['sin cebolla','sin cebolla',false],
 ['sin cebolla y sin tomate','salsa aparte',false], ['sin azúcar','poca sal',false],
 ['sin cebolla','con salsa de tomate',false], ['sin tomate','con cebolla',false],
] as const;
for(const names of [['Bowl de garbanzos','Curry de lentejas'],['Pizza del huerto','Ravioles de ricota']])
for(const agent of [false,true]) it.each(cases)(`redirect conflict ${names[0]} agent=${agent}: %s / %s blocked=%s`,async(note,targetNote,blocked)=>{
 const h=harness(names.map((name,i)=>({id:89601+i,code:89601+i,name,price:18000,availableNow:true,attributes:[]})),agent);
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
 for(const name of names)await h.sendQueued(`quiero un ${name}`);
 h.conv.sessionData.cart[0].note='bien empacado';h.conv.sessionData.cart[1].note=targetNote;
 const original=structuredClone(h.conv.sessionData.cart);
 // Compound-note rows start at the selection boundary; they do not claim raw utterance parsing.
 if(note.includes(' y '))h.conv.sessionData.pendingSubsetKitchenNote={quantity:1,note,productIds:[89601,89602],byUnits:true};
 else await h.sendQueued(`uno ${note}`);
 await h.sendQueued('1');
 expect(h.conv.sessionData.lastKitchenNoteSelection).toBeTruthy();
 const selected=structuredClone(h.conv.sessionData.cart);
 const reply=await h.sendQueued('no, el otro');
 if(blocked){expect(h.conv.sessionData.cart).toEqual(selected);expect(reply).toMatch(/cu[aá]l|aclar|indicaci[oó]n/i);}
 else {
  expect(h.conv.sessionData.cart[0]).toEqual(original[0]);
  expect({...h.conv.sessionData.cart[1],note:undefined}).toEqual({...original[1],note:undefined});
  expect(normalizeCorrection(h.conv.sessionData.cart[1].note || '')).toBe(normalizeCorrection(targetNote===note?note:`${targetNote}; ${note}`));
  expect(reply).toContain(names[1]);
 }
 expect(h.conv.sessionData.lastKitchenNoteSelection).toBeFalsy();
 expect(h.conv.state).toBe('building_cart');expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
