/** Opt-in full-router diagnostics; failures remain visible outside the approved regression suite. */
import { writeFileSync } from 'fs';
import { harness } from './whatsapp-accuracy.test-support';
const menus = [
  { key: 'rice', title: 'Arroz Especial Con Medio Pollo', style: 'Frito' },
  { key: 'bowl', title: 'Bowl De Quinoa Con Tofu', style: 'Asado' },
  { key: 'pasta', title: 'Pasta Con Champinones', style: 'Salteados' },
];
const product = (id: number, name: string, price: number, description: string, attributes: {attributeName:string;options:string[]}[]) =>
  ({ id, code:id, name, price, description, attributes, availableNow:true, hasAttributes:attributes.length>0 });
for (const m of menus) for (const agent of [false, true]) {
  const prep={attributeName:'Preparación',options:[m.style,'Normal']};
  const dish=product(99301,m.title,20000,'Incluye ensalada',[prep]);
  const combo=product(99302,`Combo ${m.title}`,26000,'Incluye ensalada y bebida de 400ml',[prep,{attributeName:'Bebida',options:['Agua','Pepsi']}]);
  const drink=product(99303,'Gaseosa 400ml',4000,'Bebida individual',[{attributeName:'Sabor',options:['Agua','Pepsi']}]);
  const cases=[
    {key:'price',text:'¿Cuánto cuesta el combo?',answer:/26[.,]000/},
    {key:'content',text:'¿Con qué viene el combo?',answer:/ensalada/i},
    {key:'flavors',text:'¿Qué sabores de bebida tiene el combo?',answer:/Pepsi/i},
    {key:'separate',text:'no, mejor una gaseosa 400ml Pepsi aparte',answer:/Gaseosa/i},
    {key:'option_removed',text:'sí, el combo',answer:/Bebida|bebida|Pepsi/i},
  ];
  for(const c of cases) it(`offer interruption ${m.key}/${agent}/${c.key}`,async()=>{
    const h=harness([dish,combo,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine.productId).toBe(dish.id);
      const before=structuredClone(h.conv.sessionData.cart);
      expect(before).toHaveLength(1);expect(before[0].quantity).toBe(2);
      if(c.key==='option_removed') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,{...combo,attributes:[prep,{attributeName:'Bebida',options:['Agua','Uva']}]},drink]);
      const reply=await h.sendQueued(c.text);
      expect(reply).toMatch(c.answer);
      if(c.key==='separate') {
        expect(h.conv.sessionData.cart).toHaveLength(2);
        expect(h.conv.sessionData.cart.find(line=>line.productId===dish.id)).toEqual(before[0]);
        expect(h.conv.sessionData.cart.find(line=>line.productId===drink.id)).toMatchObject({quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Pepsi'}]});
        expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      } else {
        expect(h.conv.sessionData.cart).toEqual(before);
        if(c.key==='option_removed') {
          expect(h.conv.sessionData.pendingAttribute?.productId).toBe(combo.id);
          expect(h.conv.sessionData.pendingAttribute?.selected).not.toContainEqual({attributeName:'Bebida',attributeValue:'Pepsi'});
          await h.sendQueued('Uva');
        } else {
          expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[0]);
          await h.sendQueued('sí, el combo');
        }
        expect(h.conv.sessionData.cart).toHaveLength(1);
        expect(h.conv.sessionData.cart[0]).toMatchObject({productId:combo.id,quantity:2,note:before[0].note});
        expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.key==='option_removed'?'Uva':'Pepsi'});
      }
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:993,dailyOrderNumber:93});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items=h.service.ordersService.create.mock.calls[0][0].items;
      expect(items).toHaveLength(c.key==='separate'?3:2);
      const meals=items.filter((item:any)=>item.productId===(c.key==='separate'?dish.id:combo.id));
      expect(meals).toHaveLength(2);
      for(const item of meals){expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Preparación',attributeValue:m.style});}
    } finally {
      writeFileSync(`/tmp/ppp-210-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,pendingMatch:h.conv.sessionData.pendingMatch,pendingAttribute:h.conv.sessionData.pendingAttribute},null,2));
    }
  });
  it(`ambiguous presentation ${m.key}/${agent}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:'Incluye ensalada y bebida de 1.5L'};
    const h=harness([dish,combo,large,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      const reply=await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.cart.every(line=>line.productId===dish.id)).toBe(true);
      expect(reply).toContain('400ml');expect(reply).toContain('1.5L');
      expect(h.conv.sessionData.pendingMatch?.candidates.map(item=>item.id).sort()).toEqual([combo.id,large.id]);
      expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
      expect(reply).toMatch(/elige|cu[aá]l|n[uú]mero|prefieres/i);
    } finally {
      writeFileSync(`/tmp/ppp-210-${m.key}-${agent}-ambiguous.json`,JSON.stringify({replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,pendingMatch:h.conv.sessionData.pendingMatch},null,2));
    }
  });

}
