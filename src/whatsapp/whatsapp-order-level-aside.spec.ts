import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {id:'one-row-option',product:{name:'Bao De Hongos',attributes:[{attributeName:'Salsa',options:['Teriyaki','Ponzu']}]},rows:[[2,'Teriyaki']]},
  {id:'two-rows-options',product:{name:'Pizza Del Huerto',attributes:[{attributeName:'Masa',options:['Fina','Gruesa']}]},rows:[[3,'Fina'],[1,'Gruesa']]},
  {id:'plain-product',product:{name:'Jugo De Lulo',attributes:[] as any[]},rows:[[3,null]]},
] as const;
type Menu=typeof menus[number];

function setup(f:Menu,enabled:boolean,state:string,payment='contraentrega',withCart=true){
  const p={id:86601,code:86601,name:f.product.name,price:18000,availableNow:true,hasAttributes:f.product.attributes.length>0,attributes:f.product.attributes as any[]};
  const h=harness([p] as any,enabled);h.conv.state=state as any;
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
  const cart=withCart?f.rows.map(([quantity,value])=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,
    ...(value?{attributes:[{attributeName:f.product.attributes[0].attributeName,attributeValue:value}]}:{})})):[];
  Object.assign(h.conv.sessionData,{cart,orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,
    phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:payment,deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8660,dailyOrderNumber:96});
  return {h,before:structuredClone(h.conv.sessionData.cart)};
}

const asks=[
  {id:'vueltas-traer',say:'traer vueltas de 100 mil',cash:'cambio de 100 mil'},
  {id:'cambio-traeme-accent',say:'tráeme cambio de 50 mil',cash:'cambio de 50 mil'},
  {id:'cambio-necesito',say:'necesito cambio de 50 mil',cash:'cambio de 50 mil'},
  {id:'billete',say:'le pago con un billete de 100 mil',cash:'cambio de 100 mil'},
  {id:'recipient',say:'es para mi mamá',note:'es para mi mamá'},
  {id:'gift',say:'es un regalo',note:'es un regalo'},
  {id:'urgency',say:'por favor que llegue rápido',note:'que llegue rápido'},
  {id:'thanks',say:'muchas gracias'},
] as const;

describe('Order-level asides land on the order, never on a dish, a purchase or silence', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const state of ['building_cart','awaiting_final_confirm']) {
    for (const a of asks) it(`${f.id} ${a.id} ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state);
      const reply=await h.sendQueued(a.say);
      const d=h.conv.sessionData;
      expect(d.cart).toEqual(before);
      expect(h.conv.state).toBe(state);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(reply).not.toMatch(/autorizaci[oó]n para comprar|cuando quieras pedir|no est[aá] en tu carrito/i);
      if('cash' in a){ expect(d.cashChangeFor).toBe(a.cash); expect(d.customerNotes||'').toBe(''); expect(reply).toContain(a.cash); }
      else if('note' in a){ expect(d.customerNotes).toBe(a.note); expect(d.cashChangeFor).toBeUndefined(); expect(reply).toContain(a.note); }
      else { expect(d.customerNotes).toBeUndefined(); expect(reply).toMatch(/pedido sigue abierto/i); }
      if(state==='awaiting_final_confirm'){
        expect(reply).toMatch(/confirmar/i);
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto=h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items).toHaveLength(before.reduce((s,r)=>s+r.quantity,0));
        expect(dto.items.every((i:any)=>!i.note)).toBe(true);
        if('cash' in a) expect(dto.address).toContain(a.cash);
        if('note' in a) expect(dto.address).toContain(a.note);
      }
    });
  }
});

const contrasts=['non-cash-payment','pickup-phrase','repeat-note','empty-cart'] as const;
describe('Order-level asides stay inside their scope', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of contrasts) {
    it(`${f.id} ${scenario} agent=${enabled}`, async () => {
      if(scenario==='non-cash-payment'){
        const {h,before}=setup(f,enabled,'awaiting_final_confirm','transfer');
        const reply=await h.sendQueued('traigan cambio de 50 mil');
        expect(h.conv.sessionData.cashChangeFor).toBeUndefined();
        expect(h.conv.sessionData.paymentMethod).toBe('transfer');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(reply).toMatch(/efectivo/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      } else if(scenario==='pickup-phrase'){
        const {h}=setup(f,enabled,'building_cart');
        await h.sendQueued('es para llevar');
        expect(h.conv.sessionData.orderType).toBe('pickup');
        expect(h.conv.sessionData.customerNotes||'').not.toMatch(/llevar/i);
      } else if(scenario==='repeat-note'){
        const {h}=setup(f,enabled,'building_cart');
        await h.sendQueued('es para mi mamá');
        await h.sendQueued('es para mi mamá');
        expect(h.conv.sessionData.customerNotes).toBe('es para mi mamá');
      } else {
        const {h}=setup(f,enabled,'building_cart','contraentrega',false);
        await h.sendQueued('es para mi mamá');
        expect(h.conv.sessionData.customerNotes||'').not.toMatch(/mam/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      }
    });
  }
});
