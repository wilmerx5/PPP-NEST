import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {name:'Bao De Hongos',attr:'Salsa',a:'Teriyaki',b:'Ponzu',c:'Suave',item:'cilantro'},
  {name:'Pizza Del Huerto',attr:'Masa',a:'Fina',b:'Gruesa',c:'Integral',item:'aceitunas'},
  {name:'Batido De Mango',attr:'Base',a:'Leche',b:'Agua',c:'Avena',item:'hielo'},
];
const scenarios=['replace-all','remove','replace-partial','two-attributes','catalog-changed','ambiguous-remove'] as const;

describe('Contradictory notes and paired attributes on already split units', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of scenarios) {
    it(`${f.name} ${scenario} agent=${enabled}`, async () => {
      const attributes=[{attributeName:f.attr,options:[f.a,f.b,f.c]},{attributeName:'Tamaño',options:['Normal','Grande']}];
      const p={id:86001,code:86001,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes};
      const h=harness([p],enabled);h.conv.state='awaiting_final_confirm';
      h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
      const line=(quantity:number,value:string,note?:string)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,
        attributes:[{attributeName:f.attr,attributeValue:value},{attributeName:'Tamaño',attributeValue:'Normal'}],note});
      const secondNote=scenario==='ambiguous-remove'?`sin ${f.item}`:'bien empacado';
      Object.assign(h.conv.sessionData,{cart:[line(3,f.a,`sin ${f.item}`),line(2,f.b,secondNote)],orderType:'delivery',fulfillmentChosen:true,
        address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,
        paymentMethod:'contraentrega',deliveryFeeCalculated:2000});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:8600,dailyOrderNumber:96});
      const before=structuredClone(h.conv.sessionData.cart);
      const confirmAndDto=async()=>{
        const total=await h.sendQueued('Cuánto es el total');expect(total).toMatch(/117[.,]000/);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(5);return dto;
      };

      if(scenario==='replace-all'||scenario==='remove') {
        const reply=await h.sendQueued(scenario==='remove'?`A las de ${f.a} quítales la nota`:`A las de ${f.a} mejor con ${f.item}`);
        expect(h.conv.sessionData.cart).toHaveLength(2);
        const [first,second]=h.conv.sessionData.cart;
        expect(second).toEqual(before[1]);
        expect(first).toMatchObject({quantity:3,attributes:before[0].attributes});
        expect(first.note||'').not.toMatch(new RegExp(`sin ${f.item}`,'i'));
        if(scenario==='replace-all'){expect(first.note).toMatch(new RegExp(`con ${f.item}`,'i'));expect(reply).toContain(`con ${f.item}`);}
        else expect(first.note).toBeFalsy();
        expect(h.conv.state).toBe('awaiting_final_confirm');
        const dto=await confirmAndDto();
        expect(dto.items.filter((i:any)=>(i.note||'').includes(`sin ${f.item}`))).toHaveLength(0);
        return;
      }
      if(scenario==='replace-partial') {
        const reply=await h.sendQueued(`A una de las de ${f.a} ponle ${f.item}, las otras dos siguen sin ${f.item}`);
        const rows=h.conv.sessionData.cart;
        expect(rows).toHaveLength(3);
        expect(rows).toEqual(expect.arrayContaining([before[1],{...before[0],quantity:2}]));
        const changed=rows.find(r=>r.quantity===1)!;
        expect(changed.attributes).toEqual(before[0].attributes);
        expect(changed.note||'').not.toMatch(new RegExp(`sin ${f.item}`,'i'));
        expect(changed.note).toMatch(new RegExp(f.item,'i'));
        expect(reply).toMatch(/1 de 3; las otras 2 siguen igual/);
        const dto=await confirmAndDto();
        expect(dto.items.filter((i:any)=>(i.note||'').includes(`sin ${f.item}`))).toHaveLength(2);
        return;
      }
      if(scenario==='two-attributes') {
        const reply=await h.sendQueued(`Cambia dos ${f.name} de ${f.a} a ${f.c} y tamaño Grande`);
        const rows=h.conv.sessionData.cart;
        expect(rows).toHaveLength(3);
        expect(rows).toEqual(expect.arrayContaining([before[1],{...before[0],quantity:1}]));
        const changed=rows.find(r=>r.attributes?.some(a=>a.attributeValue===f.c))!;
        expect(changed.quantity).toBe(2);
        expect(changed.attributes).toEqual(expect.arrayContaining([{attributeName:f.attr,attributeValue:f.c},{attributeName:'Tamaño',attributeValue:'Grande'}]));
        expect(changed.note).toBe(`sin ${f.item}`);
        expect(reply).toContain(f.c);expect(reply).toContain('Grande');
        const dto=await confirmAndDto();
        expect(dto.items.filter((i:any)=>i.attributes.some((a:any)=>a.attributeValue==='Grande'))).toHaveLength(2);
        return;
      }
      if(scenario==='catalog-changed') {
        const question=await h.sendQueued(`Cambia la ${f.attr} de una ${f.name} a ${f.c}`);
        expect(question).toContain(f.a);expect(question).toContain(f.b);
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeDefined();
        p.attributes[0].options=[f.a,f.b];
        const reply=await h.sendQueued('2');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingCartAttributeEdit).toBeUndefined();
        expect(reply).toContain(f.c);expect(reply).toMatch(/disponible|no (?:tenemos|hay|manejamos)/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        return;
      }
      // ambiguous-remove: both lines carry the same note, so one unnamed removal must ask and then resolve.
      const question=await h.sendQueued(`Quítale el sin ${f.item} a uno`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(question).toContain(f.a);expect(question).toContain(f.b);
      const reply=await h.sendQueued('2');
      const rows=h.conv.sessionData.cart;
      expect(rows).toHaveLength(3);
      expect(rows).toEqual(expect.arrayContaining([before[0],{...before[1],quantity:1}]));
      const cleared=rows.filter(r=>r.quantity===1&&!(r.note||'').includes(`sin ${f.item}`));
      expect(cleared).toHaveLength(1);
      expect(cleared[0].attributes).toEqual(before[1].attributes);
      expect(reply).toContain(f.b);expect(reply).toMatch(/1 de 2; la otra sigue igual/);
      const dto=await confirmAndDto();
      expect(dto.items.filter((i:any)=>(i.note||'').includes(`sin ${f.item}`))).toHaveLength(4);
    });
  }
});

const contrasts=['no-contradiction','question','pending-cancel','pending-confirm','pending-stale','pending-invalid','unknown-second-option','plain-final-note','phone-final'] as const;
describe('Note revisions do not mutate or confirm outside their scope', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of contrasts) {
    it(`${f.name} ${scenario} agent=${enabled}`, async () => {
      const attributes=[{attributeName:f.attr,options:[f.a,f.b,f.c]},{attributeName:'Tamaño',options:['Normal','Grande']}];
      const p={id:86101,code:86101,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes};
      const h=harness([p],enabled);h.conv.state='awaiting_final_confirm';
      h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
      const line=(quantity:number,value:string,note?:string)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,
        attributes:[{attributeName:f.attr,attributeValue:value},{attributeName:'Tamaño',attributeValue:'Normal'}],note});
      const shared=scenario.startsWith('pending');
      Object.assign(h.conv.sessionData,{cart:[line(3,f.a,shared?`sin ${f.item}`:'bien empacado'),line(2,f.b,shared?`sin ${f.item}`:'bien empacado')],orderType:'delivery',fulfillmentChosen:true,
        address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,
        paymentMethod:'contraentrega',deliveryFeeCalculated:2000});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:8610,dailyOrderNumber:97});
      const before=structuredClone(h.conv.sessionData.cart);
      if(scenario==='no-contradiction'){
        await h.sendQueued(`A las de ${f.a} mejor con ${f.item}`);
        expect(h.conv.sessionData.cart.find(r=>r.attributes![0].attributeValue===f.b)).toEqual(before[1]);
        expect(h.conv.sessionData.pendingCartNoteEdit).toBeUndefined();
      } else if(scenario==='question'){
        await h.sendQueued(`¿A las de ${f.a} les puedes quitar la nota?`);
        expect(h.conv.sessionData.cart).toEqual(before);
      } else if(scenario==='unknown-second-option'){
        await h.sendQueued(`Cambia dos ${f.name} de ${f.a} a ${f.c} y tamaño Gigante`);
        expect(h.conv.sessionData.cart).toEqual(before);
      } else if(scenario==='phone-final'){
        const summary=await h.sendQueued('3209876543');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.conv.sessionData.contactPhone).toMatch(/3209876543/);expect(summary).toMatch(/confirmar/i);
        await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.service.ordersService.create.mock.calls[0][0].phone).toMatch(/3209876543/);return;
      } else if(scenario==='plain-final-note'){
        h.conv.sessionData.cart=[line(5,f.a,'bien empacado')];
        const summary=await h.sendQueued('sin cebolla porfa');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.conv.state).toBe('awaiting_final_confirm');
        expect(summary).toMatch(/confirmar/i);
        expect(h.conv.sessionData.cart.some(r=>(r.note||'').includes('sin cebolla'))).toBe(true);
        await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(5);return;
      } else {
        const question=await h.sendQueued(`Quítale el sin ${f.item} a uno`);
        expect(question).toContain(f.a);expect(question).toContain(f.b);
        expect(h.conv.sessionData.pendingCartNoteEdit).toBeDefined();
        if(scenario==='pending-cancel'){
          await h.sendQueued('olvida ese cambio');
          expect(h.conv.sessionData.pendingCartNoteEdit).toBeUndefined();
        } else if(scenario==='pending-confirm'){
          const reply=await h.sendQueued('confirmar');
          expect(reply).toContain(f.a);expect(h.conv.sessionData.pendingCartNoteEdit).toBeDefined();
        } else if(scenario==='pending-stale'){
          h.conv.sessionData.cart.reverse();
          const changed=structuredClone(h.conv.sessionData.cart);
          const reply=await h.sendQueued('2');
          expect(reply).toMatch(/carrito cambi/i);expect(h.conv.sessionData.cart).toEqual(changed);
          expect(h.conv.sessionData.pendingCartNoteEdit).toBeUndefined();
          expect(h.service.ordersService.create).not.toHaveBeenCalled();return;
        } else {
          await h.sendQueued('9');expect(h.conv.sessionData.pendingCartNoteEdit).toBeDefined();
        }
        expect(h.conv.sessionData.cart).toEqual(before);
      }
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});
