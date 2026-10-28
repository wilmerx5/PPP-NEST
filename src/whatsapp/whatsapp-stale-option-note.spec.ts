import {applyCartLineEdits} from './whatsapp-cart-edits';
import {harness} from './whatsapp-accuracy.test-support';
for(const [name,from,to] of [['Combo De Falafel','Te Frio','Limonada'],['Bento Vegetal','Agua','Te Verde'],['Pizza Familiar','Uva','Pepsi']]){
 it(`${name}: changing an option retires only its exact positive note clause`,()=>{
  const cart=[{productId:8841,code:8841,name,quantity:2,unitPrice:20000,attributes:[{attributeName:'Bebida',attributeValue:from}],note:`con ${from}, sin tomate`},
   {productId:8841,code:8841,name,quantity:1,unitPrice:20000,attributes:[{attributeName:'Bebida',attributeValue:from}],note:`con ${from}; sin cebolla`}];
  const next=applyCartLineEdits(cart,{updateAttributes:[{productId:8841,cartLineIndex:0,attributeName:'Bebida',attributeValue:to}]});
  expect(next[0].note).toBe('sin tomate');expect(next[0].quantity).toBe(2);expect(next[1]).toEqual(cart[1]);expect(cart[0].note).toContain(from);
 });
 for(const note of [`sin ${from}`,`con ${from} aparte`,`con ${from} y sin tomate`])it(`${name}: retains a distinct kitchen instruction ${note}`,()=>{
  const next=applyCartLineEdits([{productId:8841,code:8841,name,quantity:1,unitPrice:20000,attributes:[{attributeName:'Bebida',attributeValue:from}],note}],{updateAttributes:[{productId:8841,attributeName:'Bebida',attributeValue:to}]});
  expect(next[0].note).toBe(note);
 });
 it(`${name}: router preserves quantity and kitchen note after an agent option edit`,async()=>{
  const h=harness([{id:8841,code:8841,name,price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:[from,to]}]}] as never,true);
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.conv.state='awaiting_payment';
  h.conv.sessionData.cart=[{productId:8841,code:8841,name,quantity:2,unitPrice:20000,attributes:[{attributeName:'Bebida',attributeValue:from}],note:`con ${from}, sin tomate`}];
  h.service.agentService.runTurn.mockResolvedValue({reply:'Listo, cambié la bebida.',actions:{updateAttributes:[{productId:8841,attributeName:'Bebida',attributeValue:to}]},toolCalls:['set_attribute']});
  await h.sendQueued(`Cámbiame la bebida de los dos ${name} por ${to}, no agregues otra bebida`);
  expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({quantity:2,note:'sin tomate',attributes:[{attributeName:'Bebida',attributeValue:to}]})]);
  expect(h.replies.join('\n')).not.toContain(`con ${from}`);expect(h.conv.state).toBe('awaiting_payment');
 });
}
