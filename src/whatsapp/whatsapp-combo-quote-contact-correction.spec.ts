/** Refusals and contact corrections must retain the original purchase or quoted choices. */
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
    {key:'no',text:'no',id:99301,name:'Ana Torres',phone:'3001112233'},
    {key:'thanks',text:'no gracias',id:99301,name:'Ana Torres',phone:'3001112233'},
    {key:'plain',text:'sin combo',id:99301,name:'Ana Torres',phone:'3001112233'},
    {key:'name',text:'a nombre de Luis Perez',id:99304,name:'Luis Perez',phone:'3001112233'},
    {key:'phone',text:'mi celular es 301 222 3344',id:99304,name:'Ana Torres',phone:'3012223344'},
  ];
  for(const c of cases) it(`quote contact correction ${m.key}/${agent}/${c.key}`,async()=>{
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
      await h.sendQueued('a nombre de Ana Torres');
      await h.sendQueued('mi celular es 300 111 2233');
      const start=h.replies.length;await h.sendQueued(c.text);
      const answer=h.replies.slice(start).join('\n');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.customerName).toBe(c.name);
      expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain(c.phone);
      if(c.id===99301) {
        expect(h.conv.sessionData.pendingMatch).toBeFalsy();
        expect(answer).toContain(m.title);
        expect(answer).not.toContain(`Combo ${m.title}`);
        expect(answer).toMatch(/40[.,]000/);
        expect(h.conv.state).toBe('awaiting_payment');
        expect(answer).toMatch(/algo m[aá]s|pagas|pago|segu/i);
      } else {
        expect(answer).toMatch(c.key==='name'?/Luis Perez/i:/301/);
        expect(h.conv.sessionData.pendingMatch?.priceAcceptanceProductId).toBe(99304);
        await h.sendQueued('2');
      }
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:c.id,quantity:2,note:before[0].note,unitPrice:c.id===99304?34000:20000});
      if(c.id===99304) expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Agua'});
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.sessionData.contactPhone || h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:997,dailyOrderNumber:97});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.conv.state).toBe('completed');
      const dto=h.service.ordersService.create.mock.calls[0][0];
      expect(dto.phone.replace(/\D/g,'')).toContain(c.phone);
      expect(dto.customerName).toBe(c.name);
      const items=dto.items;expect(items).toHaveLength(2);
      for(const item of items){expect(item.productId).toBe(c.id);expect(item.note).toMatch(/sin cebolla/i);if(c.id===99304) expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Agua'});}
    } finally {writeFileSync(`/tmp/ppp-223-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,session:h.conv.sessionData,state:h.conv.state},null,2));}
  });
}
