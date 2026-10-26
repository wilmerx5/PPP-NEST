/** Relative choices with a beverage must preserve ownership, options and checkout. */
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
    {key:'invalid',text:'el otro con Mango',id:99302,flavor:'Agua'},
    {key:'stock',text:'el otro con Agua',id:99304,flavor:'Agua'},
    {key:'removed',text:'el otro con Agua',id:99304,flavor:'Agua'},
    {key:'unique',text:'no ese, el otro con Agua',id:99302,flavor:'Agua'},
    {key:'courtesy',text:'la otra con Agua por favor',id:99302,flavor:'Agua'},
    {key:'ambiguous',text:'no ese el otro con Agua',id:99302,flavor:'Agua'},
    {key:'no_focus',text:'el otro con Agua',id:99302,flavor:'Agua'},
    {key:'price',text:'el otro con Agua',id:99302,flavor:'Agua'},
  ];
  for(const c of cases) it(`other combo beverage ${m.key}/${agent}/${c.key}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:'Presentación grande. Incluye ensalada y bebida de 1.5L'};
    const extra={...combo,id:99305,code:99305,price:29000,description:'Presentación familiar. Incluye ensalada y bebida de 1L'};
    const menu=[dish,combo,large,drink,...(c.key==='ambiguous'?[extra]:[])];
    const h=harness(menu,agent);h.cfg.ignoreBusinessHours=false;
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(c.key==='ambiguous'?3:2);
      const before=structuredClone(h.conv.sessionData.cart);
      h.service.catalogService.getMenuProducts.mockResolvedValue(menu.map(p=>p.id===99304?{...p,price:34000}:p));
      if(c.key!=='no_focus') {
        await h.sendQueued('el grande con Agua');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingMatch?.priceAcceptanceProductId).toBe(99304);
      }
      if(c.key==='price') h.service.catalogService.getMenuProducts.mockResolvedValue(menu.map(p=>({...p,price:p.id===99302?28000:p.id===99304?34000:p.price})));
      if(c.key==='stock') h.service.catalogService.getMenuProducts.mockResolvedValue(menu.map(p=>({...p,price:p.id===99304?34000:p.price,availableNow:p.id!==99302})));
      if(c.key==='removed') h.service.catalogService.getMenuProducts.mockResolvedValue(menu.filter(p=>p.id!==99302).map(p=>p.id===99304?{...p,price:34000}:p));
      const start=h.replies.length;await h.sendQueued(c.text);
      const answer=h.replies.slice(start).join('\n');
      if(['unique','courtesy'].includes(c.key)) {
        expect(answer).toMatch(/listo|cambi|agreg/i);
        expect(answer).toContain(m.title);
        expect(answer).not.toMatch(/no manejamos|no pude|necesito aclarar/i);
      }
      if(['ambiguous','no_focus','price','stock','removed','invalid'].includes(c.key)) {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(answer).toMatch(c.key==='price'?/28[.,]000/:['stock','removed'].includes(c.key)?/no.*disponible|agotad/i:/cu[aá]l|elige|n[uú]mero|aclara|opci[oó]n|sabor|bebida/i);
        expect(h.conv.sessionData.pendingMatch).toBeTruthy();
        await h.sendQueued(c.key==='price'?'sí':['stock','removed'].includes(c.key)?'2':'1 con Agua');
      }
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:c.id,quantity:2,note:before[0].note,unitPrice:c.id===99304?34000:c.key==='price'?28000:26000});
      if(c.flavor) expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.flavor});
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:997,dailyOrderNumber:97});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);
      for(const item of items){expect(item.productId).toBe(c.id);expect(item.note).toMatch(/sin cebolla/i);if(c.flavor) expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.flavor});}
    } finally {writeFileSync(`/tmp/ppp-226-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,session:h.conv.sessionData,state:h.conv.state},null,2));}
  });
}
