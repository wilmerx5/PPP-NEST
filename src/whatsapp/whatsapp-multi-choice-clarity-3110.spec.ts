import {harness} from './whatsapp-accuracy.test-support';
const numberFor=(reply:string,name:string)=>reply.split('\n').find(line=>line.includes(`*${name}*`))!.match(/^\d+/)![0];
const fixtures=[
  {request:'Para un pollo y medio',names:['1 Pollo Frito','1 Pollo Broaster','1/2 Pollo Frito','1/2 Pollo Broaster'],first:'1 Pollo Broaster',second:'1/2 Pollo Broaster'},
  {request:'quiero un bowl y una sopa',names:['Bowl De Pollo','Bowl De Tofu','Sopa De Verduras','Sopa De Lentejas'],first:'Bowl De Tofu',second:'Sopa De Lentejas'},
];
for(const f of fixtures)for(const agent of [false,true])for(const mode of ['numbers','names','invalid']) {
  it(`${f.request}; ${mode}; agent=${agent}`,async()=>{
    const menu=f.names.map((name,i)=>({id:95401+i,code:11+i,name,price:i<2?40000:25000,availableNow:true,hasAttributes:false,attributes:[]}));
    const h=harness(menu,agent);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:330,dailyOrderNumber:330});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    const first=String(await h.sendQueued(f.request));
    expect(h.conv.sessionData.pendingMultiOrder?.ambiguous).toHaveLength(2);
    expect(first).toContain(f.first);
    expect(first).not.toContain(f.second);
    expect(first).toMatch(/después|pendiente/i);
    expect(first.match(/^1[.️⃣]/gm)).toHaveLength(1);
    expect(first).not.toMatch(/❓|📝/);
    if(mode==='invalid') {
      const before=structuredClone(h.conv.sessionData);
      await h.sendQueued('9');
      expect(h.conv.sessionData.cart).toEqual(before.cart);
      expect(h.conv.sessionData.pendingMultiOrder?.ambiguous).toEqual(before.pendingMultiOrder?.ambiguous);
    }
    const next=String(await h.sendQueued(mode==='names'?f.first:numberFor(first,f.first)));
    expect(next).toContain(f.second);
    expect(h.conv.sessionData.pendingMultiOrder?.ambiguous).toHaveLength(1);
    expect(h.conv.sessionData.cart.map(row=>[row.productId,row.quantity])).toEqual([[95402,1]]);
    await h.sendQueued(mode==='names'?f.second:numberFor(next,f.second));
    expect(h.conv.sessionData.cart.map(row=>[row.productId,row.quantity])).toEqual([[95402,1],[95404,1]]);
    expect(h.conv.sessionData.pendingMultiOrder).toBeUndefined();
    await h.sendQueued('no mas');await h.sendQueued('contraentrega');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const receipt=await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    expect(h.service.ordersService.create.mock.calls[0][0].items.map(item=>item.productId)).toEqual([95402,95404]);
    expect(receipt).toContain('65.000');
  });
}
