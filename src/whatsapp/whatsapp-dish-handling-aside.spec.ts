import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {main:{name:'Bao De Hongos',attributes:[{attributeName:'Salsa',options:['Teriyaki','Ponzu']}]},value:'Teriyaki',side:'Ensalada César',short:'ensalada',art:'la',verb:'venga'},
  {main:{name:'Pizza Del Huerto',attributes:[{attributeName:'Masa',options:['Fina','Gruesa']}]},value:'Fina',side:'Sopa Del Día',short:'sopa',art:'la',verb:'venga'},
  {main:{name:'Hamburguesa Clásica',attributes:[] as any[]},value:null,side:'Papas Rústicas',short:'papas',art:'las',verb:'vengan'},
] as const;
type Menu=typeof menus[number];

function setup(f:Menu,enabled:boolean,state:string,two:boolean){
  const main={id:86801,code:86801,name:f.main.name,price:20000,availableNow:true,hasAttributes:f.main.attributes.length>0,attributes:f.main.attributes as any[]};
  const side={id:86802,code:86802,name:f.side,price:9000,availableNow:true,hasAttributes:false,attributes:[] as any[]};
  const h=harness([main,side] as any,enabled);h.conv.state=state as any;
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
  const cart:any[]=[{productId:main.id,code:main.code,name:main.name,unitPrice:main.price,quantity:2,
    ...(f.value?{attributes:[{attributeName:f.main.attributes[0].attributeName,attributeValue:f.value}]}:{})}];
  if(two) cart.push({productId:side.id,code:side.code,name:side.name,unitPrice:side.price,quantity:1});
  Object.assign(h.conv.sessionData,{cart,orderType:'delivery',fulfillmentChosen:true,address:'Calle 10 #20-30',addressConfirmed:true,
    phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,paymentMethod:'contraentrega',deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8680,dailyOrderNumber:94});
  return {h,before:structuredClone(cart)};
}

const asks=[
  {id:'side-comes-apart',say:(f:Menu)=>`que ${f.art} ${f.short} ${f.verb} aparte`,named:true},
  {id:'dressing-apart-for-side',say:(f:Menu)=>`el aderezo aparte para ${f.art} ${f.short}`,named:true},
  {id:'well-packed',say:()=>'bien empacado',named:false},
  {id:'no-spill',say:()=>'que no se riegue porfa',named:false},
  {id:'separate-bags',say:()=>'en bolsas separadas',named:false},
] as const;
const phrase=(said:string)=>said.replace(/\s+porfa$/,'');

describe('Packing asides go to the named dish, the only dish or the whole order', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const state of ['building_cart','awaiting_final_confirm']) for (const two of [true,false]) {
    for (const a of asks) it(`${f.main.name} ${a.id} ${two?'two-rows':'one-row'} ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state,two);
      const said=a.say(f);
      const reply=await h.sendQueued(said);
      const d=h.conv.sessionData;
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(d.cart.map((r:any)=>[r.productId,r.quantity,r.attributes])).toEqual(before.map(r=>[r.productId,r.quantity,r.attributes]));
      if(state==='awaiting_final_confirm') expect(h.conv.state).toBe('awaiting_final_confirm');
      const expectNote=phrase(said);
      if(a.named && !two){
        expect(d.cart).toEqual(before);
        expect(d.customerNotes||'').toBe('');
        expect(reply).toMatch(/no veo ese plato/i);
        return;
      }
      const target=a.named?1:two?null:0;
      if(target===null){
        expect(d.customerNotes).toBe(expectNote);
        expect(d.cart.every((r:any)=>!r.note)).toBe(true);
      } else {
        expect(d.cart[target].note).toBe(expectNote);
        d.cart.forEach((r:any,i:number)=>{ if(i!==target) expect(r.note).toBeUndefined(); });
        expect(d.customerNotes||'').toBe('');
      }
      expect(reply).toContain(expectNote);
      if(state==='awaiting_final_confirm'){
        await h.sendQueued('confirmar');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto=h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items).toHaveLength(two?3:2);
        if(target===null) expect(dto.address).toContain(expectNote);
        else expect(dto.items.filter((i:any)=>i.note===expectNote).map((i:any)=>i.productId)).toEqual(Array(before[target].quantity).fill(before[target].productId));
      }
    });
  }
});

const contrasts=['question','repeat','purchase-wording','napkins-final-step','pending-selection','arrival-condition'] as const;
describe('Packing asides stay inside their scope', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const scenario of contrasts) {
    it(`${f.main.name} ${scenario} agent=${enabled}`, async () => {
      const state=scenario==='repeat'||scenario==='napkins-final-step'?'awaiting_final_confirm':'building_cart';
      const {h,before}=setup(f,enabled,state,scenario!=='purchase-wording'&&scenario!=='arrival-condition');
      if(scenario==='question'){
        await h.sendQueued(`¿${f.art} ${f.short} ${f.verb} aparte?`);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.customerNotes||'').toBe('');
      } else if(scenario==='repeat'){
        await h.sendQueued('bien empacado');
        await h.sendQueued('bien empacado');
        expect(h.conv.sessionData.customerNotes).toBe('bien empacado');
      } else if(scenario==='purchase-wording'){
        await h.sendQueued(`una ${f.short} aparte`);
        expect(h.conv.sessionData.cart[0].note||'').not.toMatch(/aparte/i);
        expect(h.conv.sessionData.customerNotes||'').not.toMatch(/aparte/i);
      } else if(scenario==='napkins-final-step'){
        await h.sendQueued('con servilletas');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.customerNotes).toMatch(/servilletas/i);
      } else if(scenario==='arrival-condition'){
        await h.sendQueued('que llegue caliente por favor');
        expect(h.conv.sessionData.cart.map((r:any)=>r.note)).toEqual(before.map((r:any)=>r.note));
        expect(h.conv.sessionData.customerNotes).toBe('que llegue caliente');
      } else {
        h.conv.sessionData.pendingCartNoteEdit={sourceText:'x',cartSignature:JSON.stringify(before),
          candidates:[{cartIndex:0,name:f.main.name},{cartIndex:1,name:f.side}],revision:{clearAll:true,remove:[]}} as any;
        await h.sendQueued('bien empacado');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.customerNotes||'').not.toMatch(/empacado/i);
      }
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});
