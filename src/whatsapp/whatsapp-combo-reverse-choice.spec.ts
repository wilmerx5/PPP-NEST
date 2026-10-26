/** Ambiguous combo offers require a presentation choice and preserve per-candidate options. */
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
    {key:'forward_drink',text:'¿Qué trae el grande? Dame el grande con Agua',id:99304,flavor:'Agua',query:/ensalada.*1.5L/i},
    {key:'code_drink',text:'dame el código 99304 con Agua',id:99304,flavor:'Agua'},
    {key:'volume_drink',text:'quiero el de 1,5 litros con Agua',id:99304,flavor:'Agua'},
    {key:'reverse_unknown_drink',text:'dame el grande con Mango, ¿qué trae?',id:99304,flavor:'Agua',query:/ensalada.*1.5L/i},
    {key:'conditional_unknown',text:'si elijo el familiar, ¿cuánto cuesta?',id:99304,flavor:'Pepsi',query:/cu[aá]l opci[oó]n/i},
    {key:'reverse_content',text:'dame el pequeño, ¿qué trae?',id:99302,flavor:'Pepsi',query:/ensalada.*400ml/i},
    {key:'reverse_drink',text:'quiero el grande con Agua, ¿qué sabores tiene?',id:99304,flavor:'Agua',query:/Pepsi/},
    {key:'drink',text:'dame el grande con Agua',id:99304,flavor:'Agua'},
    {key:'unknown_drink',text:'dame el grande con Mango',id:99304,flavor:'Agua'},
    {key:'conditional_price',text:'si elijo el pequeño, ¿cuánto cuesta?',id:99302,flavor:'Pepsi',query:/26[.,]000/},
    {key:'conditional_flavor',text:'si elijo el grande, ¿qué sabores tiene?',id:99304,flavor:'Pepsi',query:/Pepsi/},
  ];
  for(const c of cases) it(`reverse choice ${m.key}/${agent}/${c.key}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:'Presentación grande. Incluye ensalada y bebida de 1.5L'};
    const h=harness([dish,combo,large,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
      const before=structuredClone(h.conv.sessionData.cart), start=h.replies.length;
      await h.sendQueued(c.text);const answer=h.replies.slice(start).join('\n');
      if(c.query) expect(answer).toMatch(c.query);
      if(c.key.startsWith('conditional')||c.key.endsWith('unknown_drink')){
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
        expect(answer).toMatch(/elige|elegir|n[uú]mero|prefieres|opci[oó]n/i);
        await h.sendQueued(c.key.endsWith('unknown_drink')?'el grande con Agua':c.id===99302?'1':'2');
      }
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:c.id,quantity:2,note:before[0].note});
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.flavor});
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:997,dailyOrderNumber:97});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);
      for(const item of items){expect(item.productId).toBe(c.id);expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.flavor});}
    } finally {writeFileSync(`/tmp/ppp-217-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,session:h.conv.sessionData,state:h.conv.state},null,2));}
  });
}
