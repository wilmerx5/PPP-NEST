import {harness} from './whatsapp-accuracy.test-support';
async function setup(base:string,agent:boolean){
 const style=base==='Pollo'?'Broaster':'Asadas',other=base==='Pollo'?'Frito':'Fritas';
 const menu=[['1/2',style,26000],['1',style,46000],['1/4',style,16000],['1',other,44000],['1/2',other,24000],['1/4',other,14000]].map(([size,prep,price],i)=>({id:41601+i,code:1+i,name:`${size} ${base} ${prep}`,price:Number(price),availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
 await h.sendQueued(`Cuanto cuesta ${menu[0].name}`);expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(41601);expect(h.conv.sessionData.cart).toEqual([]);
 menu.push({id:41609,code:9,name:'1 Arroz Frito',price:99000,availableNow:true,hasAttributes:false,attributes:[]});
 return {h,menu,other};
}
for(const base of ['Pollo','Costillas'])for(const agent of [false,true])for(const [prefix,target] of [['y uno',3],['¿y uno',3],['y',4],['y medio',4],['y el cuarto',5]] as const)it(`short preparation quote ${base}/${agent}/${prefix}`,async()=>{
 const {h,menu,other}=await setup(base,agent);const reply=await h.sendQueued(prefix+' '+other+(prefix.startsWith('¿')?'?':''));expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingMatch).toBeFalsy();expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(menu[target].id);expect(reply).toContain(menu[target].name);expect(reply).toContain(target===3?'44.000':target===4?'24.000':'14.000');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:menu[target].id,quantity:1,unitPrice:menu[target].price})]);
});

for(const base of ['Pollo','Costillas'])for(const agent of [false,true]){
 for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const [prefix,target] of [['y uno',3],['y',4],['y el cuarto',5]] as const)it(`short style preserves cart ${base}/${agent}/${state}/${prefix}`,async()=>{
  const {h,menu,other}=await setup(base,agent);const original={productId:41602,code:2,name:menu[1].name,quantity:2,unitPrice:46000,attributes:[],note:'Sin sal'};h.conv.sessionData.cart=[original];h.conv.state=state;
  const reply=await h.sendQueued(prefix+' '+other);expect(h.conv.sessionData.cart).toEqual([original]);expect(h.conv.state).toBe(state);expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(menu[target].id);expect(reply).toContain(menu[target].name);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 for(const change of ['price','stock','removed','duplicate'])it(`live short preparation ${base}/${agent}/${change}`,async()=>{
  const {h,menu,other}=await setup(base,agent);if(change==='price')menu[3].price=49000;else if(change==='stock'){h.cfg.ignoreBusinessHours=false;menu[3].availableNow=false;}else if(change==='removed')menu.splice(3,1);else menu.push({...menu[3],id:41610,code:10});
  const reply=await h.sendQueued('y uno '+other);expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(change==='price'){expect(reply).toContain('49.000');expect(h.conv.sessionData.pendingAddOffer?.price).toBe(49000);}else {expect(reply).toMatch(/no est[aá] disponible|no tengo.*presentaci[oó]n.*[uú]nica/i);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);}
 });
 it(`singular style uses catalog gender aliases ${base}/${agent}`,async()=>{
  const {h,menu}=await setup(base,agent);const reply=await h.sendQueued('¿y uno frito?');expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(menu[3].id);expect(reply).toContain(menu[3].name);
 });
 it(`explicit style purchase still adds ${base}/${agent}`,async()=>{
  const {h,menu}=await setup(base,agent);await h.sendQueued('Quiero '+menu[3].name);expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:menu[3].id,quantity:1})]);
 });
}

for(const base of ['Pollo','Costillas'])for(const agent of [false,true])for(const prefix of ['y uno','y','y medio'])it(`reverse preparation comparison ${base}/${agent}/${prefix}`,async()=>{
 const {h,menu}=await setup(base,agent);await h.sendQueued('Cuanto cuesta '+menu[3].name);expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(menu[3].id);const originalStyle=base==='Pollo'?'broaster':'asadas';const target=prefix==='y medio'?0:1;
 const reply=await h.sendQueued(prefix+' '+originalStyle);expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(menu[target].id);expect(reply).toContain(menu[target].name);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
