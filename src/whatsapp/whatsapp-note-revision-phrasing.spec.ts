import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

const menus=[
  {name:'Bao De Hongos',attr:'Salsa',a:'Teriyaki',b:'Ponzu',item:'cilantro'},
  {name:'Pizza Del Huerto',attr:'Masa',a:'Fina',b:'Gruesa',item:'aceitunas'},
  {name:'Batido De Mango',attr:'Base',a:'Leche',b:'Agua',item:'hielo'},
];
type Menu=typeof menus[number];
const reversals=[
  (f:Menu)=>`ahora sí con ${f.item}`,(f:Menu)=>`mejor que sí lleven ${f.item}`,(f:Menu)=>`al final sí quiero ${f.item}`,
  (f:Menu)=>`las de ${f.a} sí con ${f.item}`,(f:Menu)=>`ponle ${f.item} a las de ${f.a}`,(f:Menu)=>`que las de ${f.a} sí lleven ${f.item}`,
];
const removals=[(f:Menu)=>`ya no sin ${f.item}`,(f:Menu)=>`quita el sin ${f.item} de las de ${f.a}`];

function setup(f:Menu,enabled:boolean,state:string,secondNote:string){
  const p={id:86201,code:86201,name:f.name,price:23000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.a,f.b]}]};
  const h=harness([p],enabled);h.conv.state=state as any;
  h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(m=>({...m,enabled:m.flow!=='mercadopago'}));
  const line=(quantity:number,value:string,note?:string)=>({productId:p.id,code:p.code,name:p.name,unitPrice:p.price,quantity,
    attributes:[{attributeName:f.attr,attributeValue:value}],note});
  Object.assign(h.conv.sessionData,{cart:[line(3,f.a,`sin ${f.item}`),line(2,f.b,secondNote)],orderType:'delivery',fulfillmentChosen:true,
    address:'Calle 10 #20-30',addressConfirmed:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,
    paymentMethod:'contraentrega',deliveryFeeCalculated:2000});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:8620,dailyOrderNumber:98});
  return {h,before:structuredClone(h.conv.sessionData.cart)};
}

describe('Note reversals phrased without the article-first form stay on the line that holds the note', () => {
  for (const f of menus) for (const enabled of [false,true]) for (const state of ['building_cart','awaiting_final_confirm']) {
    reversals.forEach((say,n)=>it(`${f.name} reversal#${n} ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state,'bien empacado');
      const reply=await h.sendQueued(say(f));
      const [first,second]=h.conv.sessionData.cart;
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(second).toEqual(before[1]);
      expect(first).toMatchObject({quantity:3,attributes:before[0].attributes});
      expect(first.note).toBe(`con ${f.item}`);
      expect(reply).toContain(`con ${f.item}`);
      expect(['building_cart','awaiting_final_confirm']).toContain(h.conv.state);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    }));
    removals.forEach((say,n)=>it(`${f.name} removal#${n} ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state,'bien empacado');
      await h.sendQueued(say(f));
      const [first,second]=h.conv.sessionData.cart;
      expect(second).toEqual(before[1]);
      expect(first).toMatchObject({quantity:3,attributes:before[0].attributes});
      expect(first.note||'').toBe('');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    }));
    it(`${f.name} every-line ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state,`sin ${f.item}`);
      await h.sendQueued(`échale ${f.item} a todas`);
      expect(h.conv.sessionData.cart).toEqual(before.map(row=>({...row,note:`con ${f.item}`})));
      expect(h.conv.sessionData.pendingCartNoteEdit).toBeUndefined();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    it(`${f.name} unnamed-ambiguous ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state,`sin ${f.item}`);
      const question=await h.sendQueued(`mejor con ${f.item}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(question).toContain(f.a);expect(question).toContain(f.b);
      expect(h.conv.sessionData.pendingCartNoteEdit).toBeDefined();
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart).toEqual([before[0],{...before[1],note:`con ${f.item}`}]);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    it(`${f.name} named-line-without-note ${state} agent=${enabled}`, async () => {
      const {h,before}=setup(f,enabled,state,'bien empacado');
      await h.sendQueued(`quita el sin ${f.item} de las de ${f.b}`);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
  }
});

describe('Final-step data never confirms by itself; closers still approve', () => {
  for (const f of menus) for (const enabled of [false,true]) {
    it(`${f.name} same-phone agent=${enabled}`, async () => {
      const {h}=setup(f,enabled,'awaiting_final_confirm','bien empacado');
      const summary=await h.sendQueued(h.conv.phoneE164.replace(/\D/g,'').slice(-10));
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(summary).toMatch(/confirmar/i);
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.create.mock.calls[0][0].items).toHaveLength(5);
    });
    it(`${f.name} closer-approves agent=${enabled}`, async () => {
      const {h}=setup(f,enabled,'awaiting_final_confirm','bien empacado');
      await h.sendQueued('así está bien');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    });
  }
});
