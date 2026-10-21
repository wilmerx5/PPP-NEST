import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {name:'Bao De Hongos',attr:'Salsa',a:'Teriyaki',b:'Ponzu',c:'Suave',note:'sin cilantro',extra:'sin cebolla'},
  {name:'Pizza Del Huerto',attr:'Masa',a:'Fina',b:'Gruesa',c:'Integral',note:'sin aceitunas',extra:'sin cebolla'},
  {name:'Batido De Mango',attr:'Base',a:'Leche',b:'Agua',c:'Avena',note:'sin hielo',extra:'sin azucar'},
];
describe('Counted option clarification preserves the requested units', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of ['number','ordinal','price','invalid','cancel','stale','confirm-pending','address','named','repeat']) {
    it(`${f.name} ${scenario} agent=${enabled}`, async () => {
      const p={id:85001,code:85001,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b,f.c]}]};
      const h=harness([p],enabled);h.conv.state='awaiting_final_confirm';
      h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(p=>({...p,enabled:p.flow!=='mercadopago'}));
      const line=(quantity:number,value:string,note:string)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,attributes:[{attributeName:f.attr,attributeValue:value}],note});
      Object.assign(h.conv.sessionData,{cart:[line(3,f.a,f.note),line(2,f.b,'bien empacado')],orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'contraentrega',deliveryFeeCalculated:2000});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:8500,dailyOrderNumber:95});
      const before=structuredClone(h.conv.sessionData.cart);
      const question=await h.sendQueued(`Cambia la ${f.attr} de una ${f.name} a ${f.c} ${f.extra}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(question).toContain(f.a);expect(question).toContain(f.b);
      expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
      if(scenario==='cancel') {
        await h.sendQueued('olvida ese cambio');
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
        expect(h.conv.sessionData.cart).toEqual(before);return;
      }
      if(scenario==='stale') {
        // Simulate a separate cart writer: a stale list must never address a different row.
        h.conv.sessionData.cart.reverse();
        const changed=structuredClone(h.conv.sessionData.cart);
        await h.sendQueued('2');
        expect(h.conv.sessionData.cart).toEqual(changed);
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
        expect(h.replies.at(-1)).toMatch(/cambi[oó]|nueva|nuevo/i);return;
      }
      if(scenario==='confirm-pending') {
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
      }
      if(scenario==='address') {
        await h.sendQueued('Cambiar dirección a Carrera 22 #45-60');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
      }
      if(scenario==='price') {
        await h.sendQueued('Cuánto es el total');
        expect(h.replies.at(-1)).toMatch(/117[.,]000/);
        expect(h.conv.sessionData.cart).toEqual(before);
      }
      if(scenario==='invalid') {
        await h.sendQueued('9');expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
      }
      const reply=await h.sendQueued(scenario==='ordinal'?'la segunda':scenario==='named'?'bien empacado':'2');
      expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
      expect(h.conv.sessionData.cart).toHaveLength(3);
      expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([before[0],{...before[1],quantity:1}]));
      const modified=h.conv.sessionData.cart.find(l=>l.attributes?.some(a=>a.attributeValue===f.c))!;
      expect(modified.quantity).toBe(1);expect(modified.note).toContain('bien empacado');expect(modified.note).toContain(f.extra);
      expect(reply).toContain(f.c);expect(reply).toContain(f.extra);
      expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if(scenario==='repeat') {
        const after=structuredClone(h.conv.sessionData.cart);
        await h.sendQueued(`Cambia la ${f.attr} de una ${f.name} a ${f.c} ${f.extra}`);
        expect(h.conv.sessionData.cart).toEqual(after);
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
      }
      await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(5);
      if(scenario==='address') expect(dto.address).toMatch(/45-60/);
      expect(dto.items.filter((i:any)=>i.attributes.some((a:any)=>a.attributeValue===f.c))).toHaveLength(1);
      expect(dto.items.filter((i:any)=>i.note?.includes(f.extra))).toHaveLength(1);
    });
  }
});
