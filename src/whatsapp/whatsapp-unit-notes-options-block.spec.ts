import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const families = [
  {name:'Bao De Hongos', attr:'Salsa', before:'Teriyaki', after:'Ponzu', negative:'Sin salsa', note:'sin cilantro'},
  {name:'Pizza Del Huerto', attr:'Masa', before:'Fina', after:'Gruesa', negative:'Sin gluten', note:'sin aceitunas'},
  {name:'Batido De Mango', attr:'Base', before:'Leche', after:'Agua', negative:'Sin lactosa', note:'sin hielo'},
];
describe('Notes and options belong to the same counted units', () => {
  for (const f of families) for (const enabled of [false,true]) for (const scenario of ['combined','prior-note','repeat','address','catalog-negative','negative-and-note','unsafe-extra']) {
    it(`${f.name} ${scenario} agent=${enabled}`, async () => {
      const p = {id:84001,code:84001,name:f.name,price:23000,availableNow:true,hasAttributes:true,
        attributes:[{attributeName:f.attr,options:[f.before,f.after,f.negative]}]};
      const h=harness([p],enabled);
      h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(p=>({...p,enabled:p.flow!=='mercadopago'}));
      h.conv.state='awaiting_final_confirm';
      const affected=['prior-note','address','negative-and-note'].includes(scenario)?3:2;
      const totalUnits=affected+2;
      const prior=scenario==='prior-note'?'bien empacado':undefined;
      Object.assign(h.conv.sessionData,{cart:[{productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity:totalUnits,
        attributes:[{attributeName:f.attr,attributeValue:f.before}],note:prior}],orderType:'delivery',fulfillmentChosen:true,
        address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,
        notesCollected:true,deliveryFeeCalculated:2000,paymentMethod:'contraentrega'});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:8400,dailyOrderNumber:94});
      const expected=scenario.startsWith('catalog-negative') || scenario==='negative-and-note'?f.negative:f.after;
      const suffix=scenario==='catalog-negative'?'':`${enabled ? ' y' : ''} ${f.note}`;
      const input=`Cambia la ${f.attr} de ${affected===3?'tres':'dos'} ${f.name} a ${expected}${suffix}`;
      if(scenario==='unsafe-extra'){
        const before=structuredClone(h.conv.sessionData.cart);
        const reply=await h.sendQueued(input+' y agrega otro');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(reply).toMatch(/aclar|cu[aá]l/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
      }
      const reply=await h.sendQueued(input);
      expect(reply).toContain(f.before);expect(reply).toContain(expected);expect(reply).toMatch(/×2/);
      expect(h.conv.sessionData.cart).toHaveLength(2);
      const [unchanged,changed]=h.conv.sessionData.cart;
      expect(unchanged).toMatchObject({quantity:2,attributes:[{attributeName:f.attr,attributeValue:f.before}]});
      expect(unchanged.note).toBe(prior);
      expect(changed).toMatchObject({quantity:affected,attributes:[{attributeName:f.attr,attributeValue:expected}]});
      if(scenario==='catalog-negative')expect(changed.note).toBeFalsy();
      else {expect(changed.note).toContain(f.note);expect(reply).toContain(f.note);}
      if(prior)expect(changed.note).toContain(prior);
      if(scenario==='repeat'){
        const before=structuredClone(h.conv.sessionData.cart);await h.sendQueued(input);expect(h.conv.sessionData.cart).toEqual(before);
      }
      let destination=/20-30/;
      if(scenario==='address'){
        await h.sendQueued('Cambiar dirección a Carrera 22 #45-60');destination=/45-60/;
        await h.sendQueued('Torre B apartamento 302');
      }
      const total=await h.sendQueued('Cuánto es el total');expect(total).toMatch(totalUnits===5?/117[.,]000/:/94[.,]000/);
      expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(totalUnits);expect(dto.address).toMatch(destination);
      const modified=dto.items.filter((item:any)=>item.attributes.some((a:any)=>a.attributeValue===expected));
      expect(modified).toHaveLength(affected);
      if(scenario!=='catalog-negative')expect(modified.every((item:any)=>item.note.includes(f.note))).toBe(true);
      expect(dto.items.filter((item:any)=>item.attributes.some((a:any)=>a.attributeValue===f.before)).every((item:any)=>!item.note?.includes(f.note))).toBe(true);
    });
  }
});
