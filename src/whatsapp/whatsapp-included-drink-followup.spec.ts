import {harness} from './whatsapp-accuracy.test-support';
for(const name of ['Bento Oriental','Pasta Primavera','Wrap Vegetal'])for(const agent of [false,true])for(const fault of ['normal','label','polite','unknown','owners','pending','payment','question'])it(`${name}/${agent}/${fault}: included drink is not a separate purchase`,async()=>{
 const p={id:9401,code:41,name,price:20000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Cola','Agua']}]};
 const extra={id:9402,code:42,name:'Agua Embotellada',price:4000,availableNow:true,hasAttributes:false,attributes:[]};
 const h=harness([p,extra],agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.conv.sessionData.cart=[{productId:9401,code:41,name,quantity:2,unitPrice:20000,attributes:[{attributeName:'Bebida',attributeValue:'Cola'}],note:'Sin salsa'},{productId:9402,code:42,name:extra.name,quantity:1,unitPrice:4000,attributes:[]}];
 if(fault==='owners'){const other={...p,id:9403,code:43,name:'Otro Plato'};h.service.catalogService.getMenuProducts.mockResolvedValue([p,extra,other]);h.conv.sessionData.cart.push({...h.conv.sessionData.cart[0],productId:9403,code:43,name:other.name});}
 if(fault==='pending')h.conv.sessionData.pendingMatch={query:'otra compra',candidates:[],quantity:1,intent:'order'} as never;
 if(fault==='payment'){h.conv.state='awaiting_mp_payment';h.conv.sessionData.mpPreferenceId='synthetic-only';}
 const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(fault==='question'?'¿Y de tomar Agua?':`Y de tomar ${fault==='unknown'?'bebida desconocida':fault==='label'?'la bebida Agua':fault==='polite'?'me puedes enviar Agua':'Agua'} ${fault==='polite'?'?':'por f'}`);
 if(fault==='normal'||fault==='label'||fault==='polite'){
  expect(h.conv.sessionData.cart[0]).toMatchObject({quantity:2,note:'Sin salsa',attributes:[{attributeName:'Bebida',attributeValue:'Agua'}]});expect(h.conv.sessionData.cart[1]).toEqual(before[1]);expect(h.conv.sessionData.cart).toHaveLength(2);
  const changed=structuredClone(h.conv.sessionData.cart);await h.sendQueued('Y de tomar Agua por f');expect(h.conv.sessionData.cart).toEqual(changed);
  await h.sendQueued('Agrega un Agua Embotellada');expect(h.conv.sessionData.cart.filter(p=>p.productId===9402).reduce((n,p)=>n+p.quantity,0)).toBe(2);
 }else {
  expect(h.conv.sessionData.cart).toEqual(before);
  if(fault==='owners'){
   expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();await h.sendQueued('Otro Plato');
   expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Cola'});
   expect(h.conv.sessionData.cart.find(p=>p.productId===9403)?.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Agua'});
   expect(h.conv.sessionData.cart[1]).toEqual(before[1]);expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
  }
 }
});
