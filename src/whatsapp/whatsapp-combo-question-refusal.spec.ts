/** Mixed questions and explicit choices must preserve quote ownership and cart integrity. */
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
  const combo=product(99302,`Combo ${m.title}`,26000,'Presentación pequeña. Incluye ensalada y bebida de 400ml',[prep,{attributeName:'Bebida',options:['Agua','Pepsi']}]);
  const drink=product(99303,'Gaseosa 400ml',4000,'Bebida individual',[{attributeName:'Sabor',options:['Agua','Pepsi']}]);
  const cases=[
    {key:'refuse_content',text:'¿Qué trae el grande? No gracias',id:99301,flavor:null,query:/ensalada.*1.5L/i},
    {key:'refuse_price',text:'No gracias, ¿cuánto cuesta el grande?',id:99301,flavor:null,query:/34[.,]000/},
    {key:'refuse_flavors',text:'Sin combo, ¿qué sabores tiene el pequeño?',id:99301,flavor:null,query:/Agua.*Pepsi/i},
    {key:'refuse_after',text:'¿Cuánto vale el pequeño? Sin combo',id:99301,flavor:null,query:/26[.,]000/},
    {key:'change_content',text:'¿Qué trae el pequeño? Dame el pequeño con Agua',id:99302,flavor:'Agua',query:/ensalada.*400ml/i},
    {key:'change_price',text:'quiero el pequeño con Agua, ¿cuánto cuesta?',id:99302,flavor:'Agua',query:/26[.,]000/},
  ];
  for(const c of cases) it(`question and refusal ${m.key}/${agent}/${c.key}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:'Presentación grande. Incluye ensalada y bebida de 1.5L'};
    const h=harness([dish,combo,large,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
      const before=structuredClone(h.conv.sessionData.cart);
      h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,price:34000},drink]);
      await h.sendQueued('el grande con Agua');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch?.priceAcceptanceProductId).toBe(99304);
      const start=h.replies.length;await h.sendQueued(c.text);
      const answer=h.replies.slice(start).join('\n');
      expect(answer).toMatch(c.query);
      if(c.key.startsWith('refuse')) {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(answer).toMatch(/conservo|dejo/i);
        expect(answer).toMatch(/algo m[aá]s/i);
      }
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:c.id,quantity:2,note:before[0].note,unitPrice:c.id===99301?20000:26000});
      if(c.flavor) expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.flavor});
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(h.conv.state).toBe('building_cart');
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:997,dailyOrderNumber:97});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.conv.state).toBe('completed');
      const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);
      for(const item of items){expect(item.productId).toBe(c.id);expect(item.note).toMatch(/sin cebolla/i);if(c.flavor) expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.flavor});}
    } finally {writeFileSync(`/tmp/ppp-227-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,session:h.conv.sessionData,state:h.conv.state},null,2));}
  });
}
