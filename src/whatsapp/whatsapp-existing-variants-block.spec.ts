import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {name:'Bao De Hongos',attr:'Salsa',a:'Teriyaki',b:'Ponzu',c:'Suave',note:'sin cilantro',extra:'sin cebolla'},
  {name:'Pizza Del Huerto',attr:'Masa',a:'Fina',b:'Gruesa',c:'Integral',note:'sin aceitunas',extra:'sin cebolla'},
  {name:'Batido De Mango',attr:'Base',a:'Leche',b:'Agua',c:'Avena',note:'sin hielo',extra:'sin azucar'},
];
describe('Existing variant rows retain their own options and notes',()=>{
  for(const f of menus)for(const enabled of [false,true])for(const scenario of ['option','note','line','ambiguous','too-many','invalid-line','then-address','same-option-notes','duplicate-note']){
    it(`${f.name} ${scenario} agent=${enabled}`,async()=>{
      const p={id:85001,code:85001,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b,f.c]}]};
      const h=harness([p],enabled);h.conv.state='awaiting_final_confirm';
      h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(p=>({...p,enabled:p.flow!=='mercadopago'}));
      const line=(quantity:number,value:string,note:string)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,attributes:[{attributeName:f.attr,attributeValue:value}],note});
      Object.assign(h.conv.sessionData,{cart:[line(3,f.a,f.note),line(2,scenario==='same-option-notes'?f.a:f.b,scenario==='duplicate-note'?f.note:'bien empacado')],orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'contraentrega',deliveryFeeCalculated:2000});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:8500,dailyOrderNumber:95});
      const before=structuredClone(h.conv.sessionData.cart);
      const scope=scenario==='line'?'unidad de la linea 2':scenario==='invalid-line'?'unidad de la linea 9':scenario==='ambiguous'?f.name:['note','same-option-notes','duplicate-note'].includes(scenario)?`${f.name} ${f.note}`:`${f.name} con ${f.a}`;
      const input=`Cambia la ${f.attr} de ${scenario==='too-many'?'cuatro':'una'} ${scope} a ${f.c} ${f.extra}`;
      let reply=await h.sendQueued(input);
      if(['ambiguous','too-many','invalid-line','duplicate-note'].includes(scenario)){
        expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/cu[aá]l|aclar/i);expect(h.service.ordersService.create).not.toHaveBeenCalled();
        if(scenario!=='ambiguous')return;
        reply=await h.sendQueued(`Cambia la ${f.attr} de una unidad de la linea 2 a ${f.c} ${f.extra}`);
      }
      const selected=['line','ambiguous'].includes(scenario)?1:0;
      expect(h.conv.sessionData.cart).toHaveLength(3);
      expect(h.conv.sessionData.cart).toEqual(expect.arrayContaining([before[1-selected],{...before[selected],quantity:before[selected].quantity-1}]));
      const modified=h.conv.sessionData.cart.find(l=>l.attributes?.some(a=>a.attributeValue===f.c))!;
      expect(modified.quantity).toBe(1);expect(modified.note).toContain(before[selected].note!);expect(modified.note).toContain(f.extra);
      expect(reply).toContain(f.c);expect(reply).toContain(f.extra);expect(reply).not.toMatch(/algo m[aá]s/i);
      expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
      let address=/20-30/;
      if(scenario==='then-address'){await h.sendQueued('Cambiar dirección a Carrera 22 #45-60');address=/45-60/;}
      await h.sendQueued('Cuánto es el total');expect(h.replies.at(-1)).toMatch(/117[.,]000/);
      await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.address).toMatch(address);expect(dto.items).toHaveLength(5);
      for(const [value,count] of [[f.c,1],[f.a,scenario==='same-option-notes'?4:selected===0?2:3],[f.b,scenario==='same-option-notes'?0:selected===1?1:2]])expect(dto.items.filter((i:any)=>i.attributes.some((a:any)=>a.attributeValue===value))).toHaveLength(count as number);
      expect(dto.items.filter((i:any)=>i.note?.includes(f.extra))).toHaveLength(1);
    });
  }
});

describe('Repeated subset edits after the cart has already split',()=>{
 for(const f of menus)for(const enabled of [false,true])for(const scenario of ['second-split','question-between','ambiguous-then-explicit','excess-then-explicit','view-between']){
  it(`${f.name} ${scenario} preserves six units agent=${enabled}`,async()=>{
   const p={id:85001,code:85001,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b,f.c]}]};
   const h=harness([p],enabled);h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
   h.conv.state='awaiting_final_confirm';
   h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(p=>({...p,enabled:p.flow!=='mercadopago'}));
   const line=(quantity:number,value:string,note:string)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,attributes:[{attributeName:f.attr,attributeValue:value}],note});
   Object.assign(h.conv.sessionData,{cart:[line(3,f.a,f.note),line(3,f.b,'bien empacado')],orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'contraentrega'});
   h.service.ordersService.create=jest.fn().mockResolvedValue({id:128,dailyOrderNumber:128});
   await h.sendQueued(`Cambia la ${f.attr} de dos ${f.name} con ${f.a} a ${f.c} ${f.extra}`);
   const before=structuredClone(h.conv.sessionData.cart);
   expect(before.reduce((sum,l)=>sum+l.quantity,0)).toBe(6);
   expect(before.find(l=>l.attributes?.some(a=>a.attributeValue===f.c))).toMatchObject({quantity:2});
   if(scenario==='question-between'){
    const reply=await h.sendQueued('Cuánto es el total');expect(reply).toMatch(/138[.,]000/);
    expect(h.conv.sessionData.cart).toEqual(before);
   }
   if(scenario==='ambiguous-then-explicit'){
    const reply=await h.sendQueued(`Cambia la ${f.attr} de una ${f.name} a ${f.a}`);
    expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/cu[aá]l|aclar/i);
   }
   if(scenario==='excess-then-explicit'){
    const reply=await h.sendQueued(`Cambia la ${f.attr} de tres ${f.name} con ${f.c} a ${f.b}`);
    expect(h.conv.sessionData.cart).toEqual(before);expect(reply).toMatch(/cu[aá]l|aclar|cantidad/i);
   }
   if(scenario==='view-between'){
    const reply=await h.sendQueued('déjame ver el carrito');
    expect(reply).toContain(f.name);expect(reply).toContain(f.extra);
    expect(h.conv.sessionData.cart).toEqual(before);
   }
   const reply=await h.sendQueued(`Cambia la ${f.attr} de una ${f.name} con ${f.c} a ${f.b}`);
   expect(reply).toContain(f.b);expect(reply).not.toMatch(/algo m[aá]s/i);
   const cart=h.conv.sessionData.cart;
   expect(cart.reduce((sum,l)=>sum+l.quantity,0)).toBe(6);
   expect(cart).toEqual(expect.arrayContaining([line(1,f.a,f.note),line(3,f.b,'bien empacado')]));
   const edited=cart.filter(l=>l.note?.includes(f.extra));
   expect(edited).toHaveLength(2);
   expect(edited.map(l=>l.quantity)).toEqual([1,1]);
   expect(edited.map(l=>l.attributes![0].attributeValue).sort()).toEqual([f.b,f.c].sort());
   for(const row of edited)expect(row.note).toContain(f.note);
   expect(h.conv.state).toBe('awaiting_final_confirm');expect(h.service.ordersService.create).not.toHaveBeenCalled();
   await h.sendQueued('confirmar');expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
   const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(6);
   for(const [value,count] of [[f.a,1],[f.b,4],[f.c,1]])expect(dto.items.filter(i=>i.attributes.some(a=>a.attributeValue===value))).toHaveLength(count as number);
   expect(dto.items.filter(i=>i.note?.includes(f.extra))).toHaveLength(2);
   expect(dto.items.filter(i=>i.note==='bien empacado')).toHaveLength(3);
  });
 }
});
