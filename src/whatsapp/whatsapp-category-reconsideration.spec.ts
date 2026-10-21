import { harness } from './whatsapp-accuracy.test-support';

for(const [first,second,missing,one,two] of [
 ['Pizzas','Pastas','Postres','Pizza Vegetal','Ravioles'],
 ['Carnes','Pescados','Sopas','Churrasco','Mojarra'],
 ['Postres','Bebidas','Hamburguesas','Tarta De Manzana','Té Verde'],
]){
 const menu=[
  {id:99701,code:99701,name:one,categoryName:first,price:17000,availableNow:true,attributes:[]},
  {id:99702,code:99702,name:two,categoryName:second,price:18000,availableNow:true,attributes:[]},
 ];
 for(const enabled of [false,true])for(const occupied of [false,true])for(const scenario of ['narrow','missingFirst','missingLast']){
  it(`${first}/${second} ${scenario} occupied=${occupied} agent=${enabled}`,async()=>{
   const h=harness(menu,enabled);
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
   h.service.ordersService.create=jest.fn();
   if(occupied)await h.sendQueued(`Quiero un ${one}`);
   const before=structuredClone(h.conv.sessionData.cart);
   let reply='';
   if(scenario==='narrow'){
    await h.sendQueued(`¿Qué tienen de ${first} o de ${second}?`);
    reply=(await h.sendQueued(`Mejor solo ${second}`))||'';
    expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([99702]);
   }else{
    const query=scenario==='missingFirst'?`¿Qué tienen de ${missing}? ¿Y de ${second}?`:`¿Qué tienen de ${second}? ¿Y de ${missing}?`;
    reply=(await h.sendQueued(query))||'';
    expect(reply.toLowerCase()).toContain(missing.toLowerCase());
    expect(reply).toMatch(/no (?:encuentro|tenemos|manejamos)/i);
    expect(h.conv.sessionData.pendingMatch?.candidates.map(p=>p.id)).toEqual([99702]);
   }
   expect(reply).toContain(two);
   expect(h.conv.sessionData.cart).toEqual(before);
   expect(h.conv.state).toBe('building_cart');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued('1');
   expect(h.conv.sessionData.cart).toHaveLength(before.length+1);
   expect(h.conv.sessionData.cart.find(p=>p.productId===99702)?.quantity).toBe(1);
  });
 }
}
