import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {name:'Bao De Hongos',attr:'Salsa',a:'Teriyaki',b:'Ponzu',c:'Suave',item:'cilantro',addon:'Queso Extra',inv:'extra queso',canon:'queso extra',loose:'extra salsa'},
  {name:'Pizza Del Huerto',attr:'Masa',a:'Fina',b:'Gruesa',c:'Integral',item:'aceitunas',addon:'Champiñones Extra',inv:'extra de champiñones',canon:'champiñones extra',loose:'bien doradas'},
  {name:'Batido De Mango',attr:'Base',a:'Leche',b:'Agua',c:'Avena',item:'hielo',addon:'Adicional Proteína',inv:'extra proteína',canon:'proteína adicional',loose:'bien frío'},
];
type Menu=typeof menus[number];

function setup(f:Menu,enabled:boolean,state:string){
  const p={id:86401,code:86401,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b,f.c]}]};
  const addon={id:86402,code:86402,name:f.addon,price:3000,availableNow:true,hasAttributes:false,attributes:[] as any[]};
  const h=harness([p,addon] as any,enabled);h.conv.state=state as any;
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
  const line=(quantity:number,value:string,note?:string)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,
    attributes:[{attributeName:f.attr,attributeValue:value}],note});
  Object.assign(h.conv.sessionData,{cart:[line(3,f.a,`sin ${f.item}`),line(2,f.b)],orderType:'delivery',fulfillmentChosen:true,
    address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,
    paymentMethod:'contraentrega',deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8640,dailyOrderNumber:98});
  return {h,addon,before:structuredClone(h.conv.sessionData.cart)};
}

const asks=[
  {id:'inverted-con',say:(f:Menu)=>`las de ${f.a} con ${f.inv}`,rows:[0]},
  {id:'verb-first',say:(f:Menu)=>`ponle ${f.canon} a las de ${f.a}`,rows:[0]},
  {id:'a-las-verb',say:(f:Menu)=>`a las de ${f.b} agregale ${f.inv}`,rows:[1]},
  {id:'que-lleven',say:(f:Menu)=>`que las de ${f.a} lleven ${f.canon} porfa`,rows:[0]},
  {id:'bare-option',say:(f:Menu)=>`${f.b} con ${f.inv}`,rows:[1]},
  {id:'all-rows',say:(f:Menu)=>`échale ${f.inv} a todas`,rows:[0,1]},
] as const;

describe('A priced add-on named against cart rows is bought per unit, not noted for free', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const state of ['building_cart','awaiting_final_confirm']) {
    for (const a of asks) it(`${f.name} ${a.id} ${state} agent=${enabled}`, async () => {
      const {h,addon,before}=setup(f,enabled,state);
      const units=a.rows.reduce((sum,i)=>sum+before[i].quantity,0);
      const reply=await h.sendQueued(a.say(f));
      const cart=h.conv.sessionData.cart;
      expect(cart.slice(0,2)).toEqual(before);
      expect(cart).toHaveLength(3);
      expect(cart[2]).toMatchObject({productId:addon.id,quantity:units,unitPrice:3000});
      for (const i of a.rows) expect(cart[2].note).toContain(`(${before[i].attributes![0].attributeValue})`);
      expect(reply).toContain(f.addon);
      expect(reply).toContain(`×${units}`);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if(state==='awaiting_final_confirm'){
        expect(h.conv.state).toBe('awaiting_final_confirm');
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const items=h.service.ordersService.create.mock.calls[0][0].items;
        expect(items.filter((i:any)=>i.productId===addon.id).reduce((s:number,i:any)=>s+(i.quantity||1),0)).toBe(units);
        expect(items.filter((i:any)=>i.productId!==addon.id).reduce((s:number,i:any)=>s+(i.quantity||1),0)).toBe(5);
        expect(items.some((i:any)=>i.productId!==addon.id&&/extra|adicional/i.test(i.note||''))).toBe(false);
      }
    });
  }
});

const contrasts=['unavailable','not-in-catalog','question','repeat','pending-selection','removal-wording'] as const;
describe('Add-on references stay inside their scope', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of contrasts) {
    it(`${f.name} ${scenario} agent=${enabled}`, async () => {
      const {h,addon,before}=setup(f,enabled,'building_cart');
      if(scenario==='unavailable'){
        addon.availableNow=false;
        const reply=await h.sendQueued(`las de ${f.a} con ${f.inv}`);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(reply).toContain(f.addon);
      } else if(scenario==='not-in-catalog'){
        await h.sendQueued(`las de ${f.a} con ${f.loose}`);
        const cart=h.conv.sessionData.cart;
        expect(cart.some((r:any)=>r.productId===addon.id)).toBe(false);
        expect(cart[1]).toEqual(before[1]);
      } else if(scenario==='question'){
        await h.sendQueued(`¿las de ${f.a} llevan ${f.canon}?`);
        expect(h.conv.sessionData.cart).toEqual(before);
      } else if(scenario==='repeat'){
        await h.sendQueued(`las de ${f.a} con ${f.inv}`);
        const reply=await h.sendQueued(`las de ${f.a} con ${f.canon}`);
        const lines=h.conv.sessionData.cart.filter((r:any)=>r.productId===addon.id);
        expect(lines).toHaveLength(1);
        expect(lines[0].quantity).toBe(3);
        expect(reply).toMatch(/ya ten[ií]a/i);
      } else if(scenario==='pending-selection'){
        h.conv.sessionData.pendingCartNoteEdit={sourceText:'x',cartSignature:JSON.stringify(before),
          candidates:[{cartIndex:0,name:f.a},{cartIndex:1,name:f.b}],revision:{clearAll:false,remove:[`sin ${f.item}`]}} as any;
        await h.sendQueued(`las de ${f.b} con ${f.inv}`);
        expect(h.conv.sessionData.cart.some((r:any)=>r.productId===addon.id&&r.quantity===2&&/para/.test(r.note||''))).toBe(false);
      } else {
        await h.sendQueued(`las de ${f.a} sin ${f.canon}`);
        expect(h.conv.sessionData.cart.some((r:any)=>r.productId===addon.id)).toBe(false);
        expect(h.conv.sessionData.cart[1]).toEqual(before[1]);
      }
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});
