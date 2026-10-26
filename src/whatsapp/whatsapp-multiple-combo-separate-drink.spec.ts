/** A separate drink after declining multiple combo presentations must not accept the replacement. */
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
    {key:'separate',text:'no, mejor una gaseosa 400ml Pepsi aparte',answer:/Gaseosa/i},
    {key:'separate',text:'no gracias, dame una gaseosa 400ml Pepsi por separado',answer:/Gaseosa/i},
    {key:'separate',text:'sin combo, una gaseosa 400ml Pepsi aparte por favor',answer:/Gaseosa/i},
  ];
  for(const c of cases) it(`multiple offer separate drink ${m.key}/${agent}/${c.text}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:"Incluye ensalada y bebida de 1.5L"};
    const h=harness([dish,combo,large,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine.productId).toBe(dish.id);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
      const before=structuredClone(h.conv.sessionData.cart);
      expect(before).toHaveLength(1);expect(before[0].quantity).toBe(2);
      const reply=await h.sendQueued(c.text);
      expect(reply).toMatch(c.answer);
      expect(reply).not.toMatch(/lo cambi[eé]|ahora.*combo/i);
      expect(h.conv.sessionData.cart).toHaveLength(2);
      expect(h.conv.sessionData.cart.find(line=>line.productId===dish.id)).toEqual(before[0]);
      expect(h.conv.sessionData.cart.find(line=>line.productId===drink.id)).toMatchObject({quantity:1,attributes:[{attributeName:'Sabor',attributeValue:'Pepsi'}]});
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.state).toBe('building_cart');
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:993,dailyOrderNumber:93});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items=h.service.ordersService.create.mock.calls[0][0].items;
      expect(items).toHaveLength(3);
      expect(items.filter((item:any)=>item.productId===drink.id)).toEqual([
        expect.objectContaining({attributes:expect.arrayContaining([{attributeName:'Sabor',attributeValue:'Pepsi'}])}),
      ]);
      const meals=items.filter((item:any)=>item.productId===dish.id);
      expect(meals).toHaveLength(2);
      for(const item of meals){expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Preparación',attributeValue:m.style});}
    } finally {
      writeFileSync(`/tmp/ppp-214-regression-${m.key}-${agent}-${cases.indexOf(c)}.json`,JSON.stringify({replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,pendingMatch:h.conv.sessionData.pendingMatch,pendingAttribute:h.conv.sessionData.pendingAttribute},null,2));
    }
  });
}
