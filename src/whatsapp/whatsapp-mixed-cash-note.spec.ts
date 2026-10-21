import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {id:'one-row-option',products:[{name:'Bao De Hongos',attributes:[{attributeName:'Salsa',options:['Teriyaki','Ponzu']}]}],
    rows:[[0,2,'Teriyaki']],named:{say:'la salsa aparte y cambio de 50 mil',note:'la salsa aparte',row:0}},
  {id:'two-rows-same-product',products:[{name:'Pizza Del Huerto',attributes:[{attributeName:'Masa',options:['Fina','Gruesa']}]}],
    rows:[[0,3,'Fina'],[0,1,'Gruesa']],named:{say:'sin cebolla la gruesa y cambio de 50 mil',note:'sin cebolla la gruesa',row:1}},
  {id:'two-plain-products',products:[{name:'Jugo De Lulo',attributes:[] as any[]},{name:'Arepa De Queso',attributes:[] as any[]}],
    rows:[[0,2,null],[1,1,null]],named:{say:'sin hielo el jugo y cambio de 50 mil',note:'sin hielo el jugo',row:0}},
] as const;
type Menu=typeof menus[number];

function setup(f:Menu,enabled:boolean,state:string,payment='contraentrega'){
  const products=f.products.map((p,i)=>({id:86901+i,code:86901+i,name:p.name,price:18000,availableNow:true,hasAttributes:p.attributes.length>0,attributes:p.attributes as any[]}));
  const h=harness(products as any,enabled);h.conv.state=state as any;
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
  const cart=f.rows.map(([pi,quantity,value])=>{const p=products[pi];return {productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,
    ...(value?{attributes:[{attributeName:p.attributes[0].attributeName,attributeValue:value}]}:{})};});
  Object.assign(h.conv.sessionData,{cart,orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,
    phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:payment,deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8690,dailyOrderNumber:97});
  return {h,before:structuredClone(h.conv.sessionData.cart)};
}

const asks=[
  {id:'removal-then-change',say:'sin cebolla y tráeme cambio de 50 mil',note:'sin cebolla',cash:'cambio de 50 mil',kind:'dish'},
  {id:'negated-then-vueltas',say:'que no tenga picante, y llevar vueltas de 20 mil',note:'que no tenga picante',cash:'cambio de 20 mil',kind:'dish'},
  {id:'packing-then-need',say:'bien empacado y necesito cambio de 100 mil',note:'bien empacado',cash:'cambio de 100 mil',kind:'dish'},
  {id:'bill-then-removal',say:'pago con billete de 100 mil, sin hielo',note:'sin hielo',cash:'cambio de 100 mil',kind:'dish'},
  {id:'change-then-urgency',say:'tráeme cambio de 100 mil y que llegue rápido',note:'que llegue rápido',cash:'cambio de 100 mil',kind:'order'},
  {id:'recipient-then-change',say:'es para mi mamá y traer cambio de 50 mil',note:'es para mi mamá',cash:'cambio de 50 mil',kind:'order'},
  {id:'named-line-then-change',cash:'cambio de 50 mil',kind:'named'},
] as const;

const leftover=/\b(?:tr[aá]eme|traer|traigan|llevar|necesito|cambio|vueltas|billete|pago)\b/i;

describe('A dish/order note plus cash change in one message: each part lands where it belongs', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const state of ['building_cart','awaiting_final_confirm']) {
    for (const a of asks) it(`${f.id} ${a.id} ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state);
      const say=a.kind==='named'?f.named.say:a.say;
      const note=a.kind==='named'?f.named.note:a.note;
      const targetRow=a.kind==='named'?f.named.row:a.kind==='dish'&&before.length===1?0:-1;
      const reply=await h.sendQueued(say);
      const d=h.conv.sessionData;
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(state==='awaiting_final_confirm'?[state]:['building_cart','awaiting_final_confirm']).toContain(h.conv.state);
      expect(d.cashChangeFor).toBe(a.cash);
      expect(d.cart.map((r:any)=>({...r,note:undefined}))).toEqual(before.map((r:any)=>({...r,note:undefined})));
      d.cart.forEach((r:any,i:number)=>expect(r.note).toBe(i===targetRow?note:undefined));
      if(targetRow>=0) expect(d.customerNotes).toBeUndefined();
      else expect(d.customerNotes).toBe(note);
      expect(reply).toContain(note);
      expect(reply).not.toMatch(/no encontr[eé]|autorizaci[oó]n para comprar/i);
      for (const r of d.cart) expect(r.note||'').not.toMatch(leftover);
      expect(d.customerNotes||'').not.toMatch(leftover);
      if(h.conv.state==='awaiting_final_confirm'){
        expect(reply).toMatch(/confirmar/i);
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto=h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items).toHaveLength(before.reduce((s:number,r:any)=>s+r.quantity,0));
        expect(dto.address).toContain(a.cash);
        if(targetRow>=0){
          const target=before[targetRow];
          expect(dto.items.filter((i:any)=>i.note===note)).toHaveLength(target.quantity);
        } else {
          expect(dto.items.every((i:any)=>!i.note)).toBe(true);
          expect(dto.address).toContain(note);
        }
      }
    });
  }
});

const contrasts=['non-cash-payment','repeat','cash-only'] as const;
describe('Mixed note + cash messages stay inside their scope', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of contrasts) {
    it(`${f.id} ${scenario} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,'awaiting_final_confirm',scenario==='non-cash-payment'?'transfer':'contraentrega');
      if(scenario==='non-cash-payment'){
        const reply=await h.sendQueued('es para mi mamá y traer cambio de 50 mil');
        expect(h.conv.sessionData.cashChangeFor).toBeUndefined();
        expect(h.conv.sessionData.paymentMethod).toBe('transfer');
        expect(h.conv.sessionData.customerNotes).toBe('es para mi mamá');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(reply).toMatch(/efectivo/i);
        expect(h.conv.state).toBe('awaiting_final_confirm');
      } else if(scenario==='repeat'){
        await h.sendQueued('tráeme cambio de 100 mil y que llegue rápido');
        await h.sendQueued('tráeme cambio de 100 mil y que llegue rápido');
        expect(h.conv.sessionData.customerNotes).toBe('que llegue rápido');
        expect(h.conv.sessionData.cashChangeFor).toBe('cambio de 100 mil');
      } else {
        await h.sendQueued('tráeme cambio de 50 mil');
        expect(h.conv.sessionData.cashChangeFor).toBe('cambio de 50 mil');
        expect(h.conv.sessionData.customerNotes||'').toBe('');
        expect(h.conv.sessionData.cart).toEqual(before);
      }
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});
