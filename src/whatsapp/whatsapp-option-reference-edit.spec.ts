import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {name:'Bao De Hongos',attr:'Salsa',a:'Teriyaki',b:'Ponzu',c:'Suave',item:'cilantro'},
  {name:'Pizza Del Huerto',attr:'Masa',a:'Fina',b:'Gruesa',c:'Integral',item:'aceitunas'},
  {name:'Batido De Mango',attr:'Base',a:'Leche',b:'Agua',c:'Avena',item:'hielo'},
];
type Menu=typeof menus[number];

function setup(f:Menu,enabled:boolean,state:string){
  const p={id:86301,code:86301,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b,f.c]}]};
  const h=harness([p],enabled);h.conv.state=state as any;
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
  const line=(quantity:number,value:string,note?:string)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,
    attributes:[{attributeName:f.attr,attributeValue:value}],note});
  Object.assign(h.conv.sessionData,{cart:[line(3,f.a,`sin ${f.item}`),line(2,f.b)],orderType:'delivery',fulfillmentChosen:true,
    address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,
    paymentMethod:'contraentrega',deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8630,dailyOrderNumber:99});
  return {h,p,before:structuredClone(h.conv.sessionData.cart)};
}
const value=(row:any)=>row.attributes?.[0]?.attributeValue;

const edits=[
  {id:'note-plural',say:(f:Menu)=>`las de ${f.a} bien empacadas`,row:0,note:'bien empacadas'},
  {id:'note-bare-singular',say:(f:Menu)=>`${f.b} bien calientes`,row:1,note:'bien calientes'},
  {id:'note-que',say:(f:Menu)=>`que las de ${f.a} vengan separadas porfa`,row:0,note:'vengan separadas'},
  {id:'note-para',say:(f:Menu)=>`para la de ${f.b} cubiertos`,row:1,note:'cubiertos'},
] as const;
const changes=[
  {id:'change-verb',say:(f:Menu)=>`cambia las de ${f.b} a ${f.c}`,to:(f:Menu)=>[f.a,f.c]},
  {id:'change-mejor',say:(f:Menu)=>`las de ${f.b} mejor ${f.a}`,to:(f:Menu)=>[f.a,f.a]},
  {id:'change-all',say:(f:Menu)=>`todas ${f.c}`,to:(f:Menu)=>[f.c,f.c]},
] as const;

describe('A row named by the option it already has is the row that changes', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const state of ['building_cart','awaiting_final_confirm']) {
    for (const e of edits) it(`${f.name} ${e.id} ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state);
      await h.sendQueued(e.say(f));
      const rows=h.conv.sessionData.cart;
      expect(rows).toHaveLength(2);
      expect(rows[1-e.row]).toEqual(before[1-e.row]);
      expect(rows[e.row]).toMatchObject({quantity:before[e.row].quantity,attributes:before[e.row].attributes});
      expect(rows[e.row].note).toContain(e.note);
      if(before[e.row].note) expect(rows[e.row].note).toContain(before[e.row].note);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if(state==='awaiting_final_confirm'){
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const items=h.service.ordersService.create.mock.calls[0][0].items;
        expect(items).toHaveLength(5);
        expect(items.filter((i:any)=>(i.note||'').includes(e.note))).toHaveLength(before[e.row].quantity);
      }
    });
    for (const c of changes) it(`${f.name} ${c.id} ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state);
      const reply=await h.sendQueued(c.say(f));
      const rows=h.conv.sessionData.cart;
      expect(rows.map(value)).toEqual(c.to(f));
      expect(rows.map(r=>r.quantity)).toEqual([3,2]);
      expect(rows.map(r=>r.note||'')).toEqual(before.map(r=>r.note||''));
      expect(reply).toContain(c.to(f)[1]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      if(state==='awaiting_final_confirm'){
        await h.sendQueued('confirmar');
        const items=h.service.ordersService.create.mock.calls[0][0].items;
        expect(items).toHaveLength(5);
        expect(items.filter((i:any)=>i.attributes.some((a:any)=>a.attributeValue===c.to(f)[1]))).toHaveLength(c.to(f)[0]===c.to(f)[1]?5:2);
      }
    });
  }
});

const contrasts=['unknown-option','catalog-retired','question','approval-word','fulfillment','pending-selection'] as const;
describe('Option references never guess outside their scope', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of contrasts) {
    it(`${f.name} ${scenario} agent=${enabled}`, async () => {
      const {h,p,before}=setup(f,enabled,'building_cart');
      if(scenario==='unknown-option'){
        const reply=await h.sendQueued(`cambia las de ${f.b} a Gigante`);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(reply).toMatch(/gigante/i);
      } else if(scenario==='catalog-retired'){
        p.attributes[0].options=[f.a,f.b];
        await h.sendQueued(`cambia las de ${f.b} a ${f.c}`);
        expect(h.conv.sessionData.cart).toEqual(before);
      } else if(scenario==='question'){
        await h.sendQueued(`¿las de ${f.a} vienen bien empacadas?`);
        expect(h.conv.sessionData.cart).toEqual(before);
      } else if(scenario==='approval-word'){
        await h.sendQueued(`${f.b} está bien`);
        expect(h.conv.sessionData.cart.map(r=>r.note||'')).toEqual(before.map(r=>r.note||''));
      } else if(scenario==='fulfillment'){
        await h.sendQueued(`las de ${f.a} para llevar`);
        expect(h.conv.sessionData.cart.some(r=>/llevar/i.test(r.note||''))).toBe(false);
        expect(h.conv.sessionData.cart.map(value)).toEqual(before.map(value));
      } else {
        await h.sendQueued(`Quítale el sin ${f.item} a uno`);
        h.conv.sessionData.cart[1].note=`sin ${f.item}`;
        h.conv.sessionData.pendingCartNoteEdit={sourceText:'x',cartSignature:JSON.stringify(h.conv.sessionData.cart),
          candidates:[{cartIndex:0,name:f.a},{cartIndex:1,name:f.b}],revision:{clearAll:false,remove:[`sin ${f.item}`]}};
        const pendingCart=structuredClone(h.conv.sessionData.cart);
        await h.sendQueued(`las de ${f.b} mejor ${f.a}`);
        expect(h.conv.sessionData.cart.map(value)).toEqual(pendingCart.map(value));
      }
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});
