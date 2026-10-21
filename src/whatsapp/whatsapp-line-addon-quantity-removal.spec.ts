import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {name:'Bao De Hongos',short:'bao',to:'al',attr:'Salsa',a:'Teriyaki',b:'Ponzu',addon:'Queso Extra',canon:'queso extra',plural:'quesos extra'},
  {name:'Pizza Del Huerto',short:'pizza',to:'a la',attr:'Masa',a:'Fina',b:'Gruesa',addon:'Champiñones Extra',canon:'champiñones extra',plural:'champiñones extra'},
  {name:'Batido De Mango',short:'batido',to:'al',attr:'Base',a:'Leche',b:'Agua',addon:'Adicional Proteína',canon:'proteína adicional',plural:'proteínas adicionales'},
];
type Menu=typeof menus[number];

function setup(f:Menu,enabled:boolean,state:string,seed:'none'|'per-line'|'combined'='none'){
  const p={id:87001,code:87001,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b,'Otra']}]};
  const addon={id:87002,code:87002,name:f.addon,price:3000,availableNow:true,hasAttributes:false,attributes:[] as any[]};
  const h=harness([p,addon] as any,enabled);h.conv.state=state as any;
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
  const line=(quantity:number,value:string)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,attributes:[{attributeName:f.attr,attributeValue:value}]});
  const extra=(quantity:number,note:string)=>({productId:addon.id,code:addon.code,name:addon.name,unitPrice:addon.price,quantity,note});
  const cart:any[]=[line(3,f.a),line(2,f.b)];
  if(seed==='per-line') cart.push(extra(3,`para ${f.name} ×3 (${f.a})`),extra(2,`para ${f.name} ×2 (${f.b})`));
  if(seed==='combined') cart.push(extra(5,`para ${f.name} ×3 (${f.a}) y ${f.name} ×2 (${f.b})`));
  Object.assign(h.conv.sessionData,{cart,orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,
    phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'contraentrega',deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8700,dailyOrderNumber:99});
  return {h,addon,before:structuredClone(h.conv.sessionData.cart)};
}

const asks=[
  {id:'explicit-total-verb-first',say:(f:Menu)=>`ponle 2 ${f.plural} a las de ${f.a}`,seed:'none',expect:{[0]:2}},
  {id:'explicit-total-inverted',say:(f:Menu)=>`las de ${f.a} con 2 ${f.plural}`,seed:'none',expect:{[0]:2}},
  {id:'double-per-unit',say:(f:Menu)=>`ponle doble ${f.canon} a las de ${f.b}`,seed:'none',expect:{[1]:4}},
  {id:'singular-product-then-verb',say:(f:Menu)=>`${f.to} ${f.short} de ${f.b} ponle ${f.canon}`,seed:'none',expect:{[1]:2}},
  {id:'singular-product-verb-first',say:(f:Menu)=>`ponle ${f.canon} ${f.to} ${f.short} ${f.b}`,seed:'none',expect:{[1]:2}},
  {id:'remove-sin-by-line',say:(f:Menu)=>`las de ${f.a} sin ${f.canon}`,seed:'per-line',expect:{[1]:2}},
  {id:'remove-quitale-by-line',say:(f:Menu)=>`quítale el ${f.canon} a las de ${f.a}`,seed:'per-line',expect:{[1]:2}},
  {id:'remove-ya-no-singular',say:(f:Menu)=>`ya no le pongas ${f.canon} ${f.to} ${f.short} de ${f.b}`,seed:'per-line',expect:{[0]:3}},
] as const;

const addonUnitsByLine=(cart:any[],f:Menu,addonId:number)=>{
  const out:Record<number,number>={};
  for(const r of cart.filter(r=>r.productId===addonId)){
    const forA=r.note?.includes(`(${f.a})`), forB=r.note?.includes(`(${f.b})`);
    if(forA&&!forB) out[0]=(out[0]||0)+r.quantity;
    else if(forB&&!forA) out[1]=(out[1]||0)+r.quantity;
    else out[-1]=(out[-1]||0)+r.quantity;
  }
  return out;
};

describe('Line-scoped priced add-ons: explicit quantity, singular references and removal by line', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const state of ['building_cart','awaiting_final_confirm']) {
    for (const a of asks) it(`${f.name} ${a.id} ${state} agent=${enabled}`, async () => {
      const {h,addon,before}=setup(f,enabled,state,a.seed);
      const reply=await h.sendQueued(a.say(f));
      const cart=h.conv.sessionData.cart;
      expect(cart.filter((r:any)=>r.productId!==addon.id)).toEqual(before.filter((r:any)=>r.productId!==addon.id));
      expect(addonUnitsByLine(cart,f,addon.id)).toEqual(a.expect);
      expect(reply).toContain(f.addon);
      expect(reply).not.toMatch(/no manejamos|lo dejo en la nota/i);
      expect(cart.some((r:any)=>r.productId!==addon.id&&r.note)).toBe(false);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if(state==='awaiting_final_confirm'){
        expect(h.conv.state).toBe('awaiting_final_confirm');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const items=h.service.ordersService.create.mock.calls[0][0].items;
        const units=Object.values(a.expect).reduce((s:number,n:number)=>s+n,0);
        expect(items.filter((i:any)=>i.productId===addon.id).reduce((s:number,i:any)=>s+(i.quantity||1),0)).toBe(units);
        expect(items.filter((i:any)=>i.productId!==addon.id).reduce((s:number,i:any)=>s+(i.quantity||1),0)).toBe(5);
      }
    });
  }
});

const contrasts=['remove-when-line-has-none','remove-from-combined-row','repeat-explicit'] as const;
describe('Line-scoped add-on edits stay inside their scope', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of contrasts) {
    it(`${f.name} ${scenario} agent=${enabled}`, async () => {
      const {h,addon,before}=setup(f,enabled,'awaiting_final_confirm',scenario==='remove-from-combined-row'?'combined':'none');
      if(scenario==='remove-when-line-has-none'){
        const reply=await h.sendQueued(`las de ${f.a} sin ${f.canon}`);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(reply).toMatch(/no tiene/i);
      } else if(scenario==='remove-from-combined-row'){
        await h.sendQueued(`quítale el ${f.canon} a las de ${f.b}`);
        const rows=h.conv.sessionData.cart.filter((r:any)=>r.productId===addon.id);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({quantity:3,note:`para ${f.name} ×3 (${f.a})`});
      } else {
        await h.sendQueued(`ponle 2 ${f.plural} a las de ${f.a}`);
        const reply=await h.sendQueued(`ponle 2 ${f.plural} a las de ${f.a}`);
        expect(addonUnitsByLine(h.conv.sessionData.cart,f,addon.id)).toEqual({[0]:2});
        expect(reply).toMatch(/ya ten[ií]a/i);
      }
      expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});
