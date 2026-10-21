import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {id:'one-row-option',products:[{name:'Bao De Hongos',attributes:[{attributeName:'Salsa',options:['Teriyaki','Ponzu']}]}],rows:[[0,2,'Teriyaki']]},
  {id:'two-rows-same-product',products:[{name:'Pizza Del Huerto',attributes:[{attributeName:'Masa',options:['Fina','Gruesa']}]}],rows:[[0,3,'Fina'],[0,1,'Gruesa']]},
  {id:'two-plain-products',products:[{name:'Jugo De Lulo',attributes:[] as any[]},{name:'Arepa De Queso',attributes:[] as any[]}],rows:[[0,2,null],[1,1,null]]},
] as const;
type Menu=typeof menus[number];

function setup(f:Menu,enabled:boolean,state:string){
  const products=f.products.map((p,i)=>({id:87101+i,code:87101+i,name:p.name,price:18000,availableNow:true,hasAttributes:p.attributes.length>0,attributes:p.attributes as any[]}));
  const h=harness(products as any,enabled);h.conv.state=state as any;
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
  const cart=f.rows.map(([pi,quantity,value])=>{const p=products[pi];return {productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,
    ...(value?{attributes:[{attributeName:p.attributes[0].attributeName,attributeValue:value}]}:{})};});
  Object.assign(h.conv.sessionData,{cart,orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,
    phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,deliveryFeeCalculated:2000,
    ...(state==='awaiting_payment'?{}:{paymentMethod:'contraentrega'})});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8710,dailyOrderNumber:91});
  return {h,before:structuredClone(h.conv.sessionData.cart)};
}

const asks=[
  {id:'order-goes-under-name',say:'el pedido va a nombre de Laura Gómez',name:'Laura Gómez'},
  {id:'change-the-name-to',say:'cambia el nombre a Carlos',name:'Carlos'},
  {id:'the-name-is',say:'el nombre es Laura',name:'Laura'},
  {id:'correction-with-no',say:'no, el nombre es Carlos Pérez',name:'Carlos Pérez'},
  {id:'relation-prefix-dropped',say:'ponlo a nombre de mi esposa Laura',name:'Laura'},
  {id:'receiver-is-a-note',say:'que lo reciba Laura',note:'lo recibe Laura'},
] as const;

describe('A name change during checkout is acknowledged, keeps the step and never places the order', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const state of ['building_cart','awaiting_payment','awaiting_final_confirm']) {
    for (const a of asks) it(`${f.id} ${a.id} ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state);
      const reply=await h.sendQueued(a.say);
      const expectedName='name' in a?a.name:'Wilmer';
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.state).toBe(state);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.customerName).toBe(expectedName);
      if('note' in a){ expect(h.conv.sessionData.customerNotes).toBe(a.note); expect(reply).toContain(a.note); }
      else { expect(h.conv.sessionData.customerNotes).toBeUndefined(); expect(reply).toContain(`queda a nombre de *${a.name}*`); }
      expect(reply).not.toMatch(/no tenemos esos productos|no manejamos|pedido qued[oó] registrado/i);
      if(state==='awaiting_final_confirm'){
        expect(reply).toMatch(/confirmar/i);
        expect(reply).not.toMatch(/algo m[aá]s/i);
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto=h.service.ordersService.create.mock.calls[0][0];
        expect(dto.customerName).toBe(expectedName);
        expect(dto.items).toHaveLength(before.reduce((s:number,r:any)=>s+r.quantity,0));
        if('note' in a) expect(dto.address).toContain(a.note);
      }
    });
  }
});

const contrasts=['same-name-again','approval-plus-name','question-about-name','allergy-soy'] as const;
describe('Name changes stay inside their scope', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of contrasts) {
    it(`${f.id} ${scenario} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,'awaiting_final_confirm');
      if(scenario==='same-name-again'){
        const reply=await h.sendQueued('el nombre es Wilmer');
        expect(reply).toMatch(/ya est[aá] a nombre de \*Wilmer\*/i);
        expect(h.conv.customerName).toBe('Wilmer');
      } else if(scenario==='approval-plus-name'){
        const reply=await h.sendQueued('listo, a nombre de Laura');
        expect(h.conv.customerName).toBe('Laura');
        expect(reply).toMatch(/confirmar/i);
      } else if(scenario==='question-about-name'){
        await h.sendQueued('¿a nombre de quién quedó?');
        expect(h.conv.customerName).toBe('Wilmer');
      } else {
        await h.sendQueued('soy alérgico al maní');
        expect(h.conv.customerName).toBe('Wilmer');
      }
      expect(h.conv.sessionData.cart.map((r:any)=>({...r,note:undefined}))).toEqual(before.map((r:any)=>({...r,note:undefined})));
      expect(h.conv.state).toBe('awaiting_final_confirm');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});
