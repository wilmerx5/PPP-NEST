import {harness} from './whatsapp-accuracy.test-support';
async function setup(base:string,agent:boolean){
 const style=base==='Pollo'?'Broaster':'Asadas',other=base==='Pollo'?'Frito':'Fritas';
 const menu=[['1/2',style,26000],['1',style,46000],['1/4',style,16000],['1',other,44000]].map(([size,prep,price],i)=>({id:41501+i,code:1+i,name:`${size} ${base} ${prep}`,price:Number(price),availableNow:true,hasAttributes:false,attributes:[]}));
 const h=harness(menu,agent);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);h.service.ordersService.create=jest.fn();
 await h.sendQueued(`Cuanto cuesta ${menu[0].name}`);expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(41501);expect(h.conv.sessionData.cart).toEqual([]);
 return {h,menu};
}
for(const base of ['Pollo','Costillas'])for(const agent of [false,true])for(const [text,target] of [[`Y un ${base.toLowerCase()}`,1],[`¿Y un ${base.toLowerCase()}?`,1],['y uno entero',1],['y el cuarto',2],['¿y el cuarto?',2]] as const)it(`quoted portion followup ${base}/${agent}/${text}`,async()=>{
 const {h,menu}=await setup(base,agent);const reply=await h.sendQueued(text);expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingMatch).toBeFalsy();expect(h.conv.sessionData.pendingAttribute).toBeFalsy();expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(menu[target].id);expect(reply).toContain(menu[target].name);expect(reply).toContain(target===1?'46.000':'16.000');expect(reply).not.toMatch(/Listo ✅/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
 await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:menu[target].id,quantity:1,unitPrice:menu[target].price})]);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();
});

for(const base of ['Pollo','Costillas'])for(const agent of [false,true]){
 for(const state of ['building_cart','awaiting_payment','awaiting_final_confirm'])for(const text of [`Y un ${base.toLowerCase()}`,'y uno entero','y el cuarto'])it(`quote preserves current cart and checkout ${base}/${agent}/${state}/${text}`,async()=>{
  const {h,menu}=await setup(base,agent);const original={productId:41504,code:4,name:menu[3].name,quantity:2,unitPrice:44000,attributes:[],note:'Sin sal'};h.conv.sessionData.cart=[original];h.conv.state=state;const reply=await h.sendQueued(text);
  expect(h.conv.sessionData.cart).toEqual([original]);expect(h.conv.state).toBe(state);expect(reply).toContain(text==='y el cuarto'?'16.000':'46.000');expect(h.service.ordersService.create).not.toHaveBeenCalled();
 });
 it(`explicit preparation remains a quote ${base}/${agent}`,async()=>{
  const {h,menu}=await setup(base,agent);const reply=await h.sendQueued('y un '+menu[3].name.replace(/^1 /,''));expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.sessionData.pendingAddOffer?.productId).toBe(41504);expect(reply).toContain('44.000');expect(reply).toContain(menu[3].name);
 });
 for(const change of ['price','stock','removed','duplicate'])it(`live portion quote ${base}/${agent}/${change}`,async()=>{
  const {h,menu}=await setup(base,agent);if(change==='price')menu[1].price=49000;else if(change==='stock'){h.cfg.ignoreBusinessHours=false;menu[1].availableNow=false;}else if(change==='removed')menu.splice(1,1);else menu.push({...menu[1],id:41509,code:9});
  const reply=await h.sendQueued(`Y un ${base.toLowerCase()}`);expect(h.conv.sessionData.cart).toEqual([]);expect(h.service.ordersService.create).not.toHaveBeenCalled();
  if(change==='price'){expect(reply).toContain('49.000');expect(h.conv.sessionData.pendingAddOffer?.price).toBe(49000);}else {expect(reply).toMatch(/no est[aá] disponible|no tengo.*presentaci[oó]n.*[uú]nica/i);expect(h.conv.sessionData.pendingAddOffer).toBeUndefined();await h.sendQueued('sí');expect(h.conv.sessionData.cart).toEqual([]);}
 });
 it(`explicit purchase still adds ${base}/${agent}`,async()=>{
  const {h,menu}=await setup(base,agent);await h.sendQueued('Quiero '+menu[1].name);expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:41502,quantity:1})]);
 });
}
