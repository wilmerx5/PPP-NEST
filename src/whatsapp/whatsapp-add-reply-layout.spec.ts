import { harness } from './whatsapp-accuracy.test-support';

const families = [
  ['Costillas De Cerdo', 'Sopa De Ajiaco', 'sin arroz'],
  ['Pizza Margarita', 'Pasta Alfredo', 'sin queso'],
  ['Bao De Hongos', 'Arroz Vegetal', 'sin cilantro'],
];
describe.each([false,true])('item-scoped addition confirmation, agent=%s', enabled => {
  it.each(families)('puts the note below %s / %s', async (first,second,note) => {
    const menu = [first,second].map((name,index)=>({id:86001+index,code:86001+index,name,price:20000,availableNow:true,hasAttributes:false,attributes:[]}));
    const h = harness(menu,enabled);
    h.service.ordersService.create = jest.fn();
    const reply = await h.send(`quiero un ${first} y un ${second} ${note}`);
    expect(h.cartRows().map(row=>row.id).sort()).toEqual([86001,86002]);
    expect(h.cartRows().find(row=>row.id===86002)?.note).toContain(note);
    const lines = reply!.split('\n');
    const one = lines.findIndex(line=>/^\d+\. /.test(line) && line.includes(first));
    const two = lines.findIndex(line=>/^\d+\. /.test(line) && line.includes(second));
    expect(one).toBeGreaterThan(-1); expect(two).toBeGreaterThan(-1);
    expect(lines[two+1]).toContain(note);
    expect(lines[one+1]).not.toContain(note);
    expect(reply).toMatch(/Algo más/);
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
  });
});

it('keeps each repeated product’s options and notes together, without older cart notes', () => {
  const h = harness([],false);
  const line = (flavor:string,note:string) => ({productId:86001,code:86001,name:'Combo Vegetal',quantity:2,unitPrice:20000,attributes:[{attributeName:'Bebida',attributeValue:flavor}],note});
  h.conv.sessionData.cart = [line('Agua','nota antigua'),line('Uva','sin tomate'),line('Pepsi','sin cebolla')];
  const before = structuredClone(h.conv.sessionData);
  const reply = h.service.buildCartAddReply(h.conv.sessionData,0,['Combo Vegetal ×2','Combo Vegetal ×2']);
  const groups = reply.split(/\n\d+\. /).slice(1);
  expect(groups).toHaveLength(2);
  expect(groups[0]).toContain('Uva'); expect(groups[0]).toContain('sin tomate'); expect(groups[0]).not.toContain('sin cebolla');
  expect(groups[1]).toContain('Pepsi'); expect(groups[1]).toContain('sin cebolla'); expect(groups[1]).not.toContain('sin tomate');
  expect(reply).not.toContain('nota antigua');
  expect(h.conv.sessionData).toEqual(before);
});
