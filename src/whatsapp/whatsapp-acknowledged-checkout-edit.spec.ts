import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {id:'option-dish',product:{name:'Bao De Hongos',attributes:[{attributeName:'Salsa',options:['Teriyaki','Ponzu']}]},value:'Teriyaki'},
  {id:'plain-drink',product:{name:'Jugo De Lulo',attributes:[] as any[]},value:null},
  {id:'option-pizza',product:{name:'Pizza Del Huerto',attributes:[{attributeName:'Masa',options:['Fina','Gruesa']}]},value:'Gruesa'},
] as const;
type Menu=typeof menus[number];

function setup(f:Menu,enabled:boolean,state:string,orderType:'delivery'|'pickup'='delivery'){
  const p={id:87201,code:87201,name:f.product.name,price:18000,availableNow:true,hasAttributes:f.product.attributes.length>0,attributes:f.product.attributes as any[]};
  const h=harness([p] as any,enabled);h.conv.state=state as any;
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
  const cart=[{productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:2,
    ...(f.value?{attributes:[{attributeName:f.product.attributes[0].attributeName,attributeValue:f.value}]}:{})}];
  Object.assign(h.conv.sessionData,{cart,orderType,fulfillmentChosen:true,
    address:orderType==='pickup'?'Recoge en el local':'Calle 10 #20-30',addressConfirmed:true,
    phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'contraentrega',deliveryFeeCalculated:orderType==='pickup'?0:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8720,dailyOrderNumber:92});
  (h.service.ordersService as any).findTodayOrdersByPhone=async()=>[];
  return {h,before:structuredClone(h.conv.sessionData)};
}

const asks=[
  {id:'ack-then-unit-details',say:'listo, torre 2 apto 301',check:(d:any)=>expect(d.address).toBe('Calle 10 #20-30, Torre 2 apto 301')},
  {id:'ack-then-new-address',say:'va, a la carrera 15 #20-30',check:(d:any)=>expect(d.address).toBe('carrera 15 #20-30')},
  {id:'ack-then-reference',say:'perfecto, entrégalo en la portería',check:(d:any)=>{expect(d.address).toBe('Calle 10 #20-30 — entrégalo en la portería');expect(`${d.address} ${d.customerNotes||''}`).not.toMatch(/perfecto/i);}},
  {id:'ack-but-change',say:'listo pero tráeme cambio de 50 mil',check:(d:any)=>expect(d.cashChangeFor).toBe('cambio de 50 mil')},
  {id:'ack-and-urgency',say:'va y que llegue rápido',check:(d:any)=>expect(d.customerNotes).toBe('que llegue rápido')},
  {id:'ack-then-recipient',say:'listo, es para mi mamá',check:(d:any)=>expect(d.customerNotes).toBe('es para mi mamá')},
  {id:'ack-then-name',say:'listo, el nombre es Laura',check:(_d:any,h:any)=>expect(h.conv.customerName).toBe('Laura')},
  {id:'order-goes-with-payment',say:'el pedido va con transferencia',check:(d:any)=>expect(d.paymentMethod).toBe('transfer')},
  {id:'ack-then-pickup',say:'ok, mejor para recoger',check:(d:any)=>expect(d.orderType).toBe('pickup')},
  {id:'bare-pickup',say:'para recoger',check:(d:any)=>expect(d.orderType).toBe('pickup')},
  {id:'ack-then-one-less',say:'listo, quita uno',check:(d:any)=>expect(d.cart[0].quantity).toBe(1)},
  {id:'ack-then-one-more',say:'va, agrega otro',check:(d:any)=>expect(d.cart[0].quantity).toBe(3)},
] as const;

describe('An acknowledgement word followed by a checkout edit applies the edit and never approves the order', () => {
  for (const f of menus) for (const enabled of [false,true]) {
    for (const a of asks) it(`${f.id} ${a.id} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,'awaiting_final_confirm');
      const reply=await h.sendQueued(a.say);
      const d=h.conv.sessionData;
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.state).toBe('awaiting_final_confirm');
      a.check(d,h);
      expect(d.cart.map((r:any)=>r.productId)).toEqual(before.cart.map((r:any)=>r.productId));
      expect(reply).toMatch(/confirmar/i);
      expect(reply).not.toMatch(/n[uú]mero de orden|no encontr[eé]|qu[eé] se te antoja/i);
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto=h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(d.cart[0].quantity);
    });
  }
});

const contrasts=['ack-plus-courtesy','ack-plus-confirm','already-delivery','pickup-to-delivery','one-less-at-one'] as const;
describe('Acknowledged edits stay inside their scope', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of contrasts) {
    it(`${f.id} ${scenario} agent=${enabled}`, async () => {
      if(scenario==='ack-plus-courtesy'||scenario==='ack-plus-confirm'){
        const {h}=setup(f,enabled,'awaiting_final_confirm');
        await h.sendQueued(scenario==='ack-plus-courtesy'?'listo, gracias':'dale, confirmo');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      } else if(scenario==='already-delivery'){
        const {h,before}=setup(f,enabled,'awaiting_final_confirm');
        const reply=await h.sendQueued('mejor a domicilio');
        expect(reply).toMatch(/ya est[aá] a domicilio/i);
        expect(h.conv.state).toBe('awaiting_final_confirm');
        expect(h.conv.sessionData.address).toBe(before.address);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      } else if(scenario==='pickup-to-delivery'){
        const {h}=setup(f,enabled,'awaiting_final_confirm','pickup');
        const reply=await h.sendQueued('mejor a domicilio');
        expect(h.conv.sessionData.orderType).toBe('delivery');
        expect(h.conv.state).toBe('awaiting_address');
        expect(reply).toMatch(/direcci[oó]n/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      } else {
        const {h}=setup(f,enabled,'awaiting_final_confirm');
        h.conv.sessionData.cart[0].quantity=1;
        const reply=await h.sendQueued('quita uno');
        expect(h.conv.sessionData.cart[0].quantity).toBe(1);
        expect(reply).toMatch(/solo queda/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      }
    });
  }
});
