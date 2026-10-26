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
    {key:'forward_content',text:'que trae el grande dame el grande con Pepsi',flavor:'Pepsi',query:/ensalada.*1.5L/i},
    {key:'reverse_content',text:'dame el grande con Pepsi que trae',flavor:'Pepsi',query:/ensalada.*1.5L/i},
    {key:'forward_price',text:'cuanto cuesta el grande quiero el grande con Pepsi',flavor:'Pepsi',query:/34[.,]000/},
    {key:'reverse_flavor',text:'quiero el grande con Pepsi que sabores tiene',flavor:'Pepsi',query:/Agua.*Pepsi/i},
    {key:'conditional',text:'si elijo el grande cuanto cuesta',flavor:'Agua',query:/34[.,]000/},
    {key:'invalid',text:'dame el grande con Mango que trae',flavor:'Agua',query:/ensalada.*1.5L/i},
  ];
  for(const c of cases) it(`unpunctuated quote choice ${m.key}/${agent}/${c.key}`,async()=>{
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
      if(c.key==='invalid') expect(answer).toMatch(/No pude resolver esa bebida/i);
      if(c.key==='conditional'||c.key==='invalid') {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingMatch?.priceAcceptanceProductId).toBe(99304);
        expect(h.conv.sessionData.pendingMatch?.offeredChoices?.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Agua'});
        expect(answer).toMatch(/elige|elegir|n[uú]mero|prefieres|opci[oó]n/i);
        await h.sendQueued('2');
      }
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99304,quantity:2,note:before[0].note,unitPrice:34000});
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.flavor});
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
      for(const item of items){expect(item.productId).toBe(99304);expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.flavor});}
    } finally {writeFileSync(`/tmp/ppp-224-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,session:h.conv.sessionData,state:h.conv.state},null,2));}
  });
}
