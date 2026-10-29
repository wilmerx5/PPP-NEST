import { harness } from './whatsapp-accuracy.test-support';
const menus = [
 {family:'Ejecutivo Con Pollo',protein:'Pollo',key:'Presa',choice:'Pechuga'},
 {family:'Bandeja Con Tofu',protein:'Tofu',key:'Corte',choice:'Filete'},
 {family:'Plato Con Pescado',protein:'Pescado',key:'Corte',choice:'Lomo'},
];
function setup(m:typeof menus[number],agent:boolean,state:string,quantity:number,index=0){
 const attrs=[{attributeName:m.key,options:[m.choice,'Cubos']},{attributeName:'Bebida',options:['Limonada','Cola']}];
 const menu=[{id:89501,code:89501,name:m.family+' Frito',price:24000,hasAttributes:true,availableNow:true,attributes:attrs},{id:89502,code:89502,name:m.family+' Broaster',price:25000,hasAttributes:true,availableNow:true,attributes:attrs}];
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.ordersService.create=jest.fn();h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.conversationService.reopenForNewOrder=jest.fn().mockImplementation(async()=>{h.conv.state='building_cart';h.conv.sessionData={cart:[],orderType:'delivery'};});
 const line={productId:89501,code:89501,name:menu[0].name,quantity,unitPrice:24000,note:'Sin sal; bebida bajita de azúcar',attributes:[{attributeName:m.key,attributeValue:m.choice},{attributeName:'Bebida',attributeValue:'Limonada'}]};
 const other={...structuredClone(line),quantity:1,note:'Salsa aparte',attributes:[{attributeName:m.key,attributeValue:'Cubos'},{attributeName:'Bebida',attributeValue:'Cola'}]};
 h.conv.sessionData.cart=index?[other,line]:[line,other];h.conv.state=state;
 return {h,menu,line};
}

function mixed(m:typeof menus[number],agent:boolean,state:string,q:number){
 const {h,menu}=setup(m,agent,state,q);
 const target={id:89503,code:89503,name:({'Pollo':'Agua Mineral','Tofu':'Papas Rusticas','Pescado':'Te Frio'} as Record<string,string>)[m.protein],price:7000,hasAttributes:false,availableNow:true,attributes:[]};
 menu.push(target);return {h,menu,target};
}

for(const m of menus)for(const agent of [false,true])for(const payment of ['efectivo','transferencia'])for(const fault of ['unknown','insufficient','condition'])
it(`mixed recovery to final order ${m.family} ${agent} ${payment} ${fault}`,async()=>{
 const {h,target}=mixed(m,agent,'building_cart',3);
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:930,dailyOrderNumber:93});
 Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
 const before=structuredClone(h.conv.sessionData.cart);
 const bad=`quita ${fault==='insufficient'?'cinco':'dos'} de los de ${m.choice}${fault==='condition'?' si hay sopa':''} y agrega dos ${fault==='unknown'?'producto inexistente':target.name}`;
 await h.sendQueued(bad);expect(h.conv.sessionData.cart).toEqual(before);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued(`quita dos de los de ${m.choice} y agrega dos ${target.name}`);
 expect(h.conv.sessionData.cart).toEqual([{...before[0],quantity:1},before[1],{productId:target.id,code:target.code,name:target.name,quantity:2,unitPrice:target.price,attributes:[]}]);
 await h.sendQueued('no más, recojo en el local');expect(h.conv.state).toBe('awaiting_payment');
 await h.sendQueued(payment);expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);expect(h.conv.state).toBe('completed');
 const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(4);
 expect([...new Set(dto.items.map(i=>i.productId))].sort()).toEqual([before[0].productId,target.id].sort());
 expect(dto.items.filter(i=>i.productId===target.id)).toHaveLength(2);
 expect(dto.items.filter(i=>i.productId===before[0].productId)).toHaveLength(2);
 await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
});
