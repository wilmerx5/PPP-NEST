import {WhatsappCatalogService} from './whatsapp-catalog.service';
const menu=[{id:801,code:801,name:'Ramen De Miso',price:24000,availableNow:true,hasAttributes:false,attributes:[]},
 {id:802,code:802,name:'Maki Vegetal',price:18000,availableNow:true,hasAttributes:false,attributes:[]}];
const catalog=new WhatsappCatalogService({} as never);
describe('Selected cart rows bind code, label and count together',()=>{
 it('keeps explicit codes, counts and notes of two rows',()=>{
  const result=catalog.resolveExplicitCodeOrder('2 x Ramen De Miso (código #801), sin cebolla\n1 x Maki Vegetal (código 802)',menu)!;
  expect(result.confident.map(line=>({id:line.product.id,quantity:catalog.extractQuantityFromSegment(line.segment)}))).toEqual([{id:801,quantity:2},{id:802,quantity:1}]);
  expect(result.confident[0].note).toMatch(/sin cebolla/i);
 });
 it.each(['0 x Ramen De Miso (código 801)','2 x Ramen De Miso (código 802)'])('rejects zero or conflicting code identity: %s',bad=>{
  const result=catalog.resolveExplicitCodeOrder(bad+'\n1 x Maki Vegetal (código 802)',menu)!;
  expect(result.unresolved).toEqual([bad]);expect(result.confident).toHaveLength(1);
 });
 it('does not consume a compound one-line list as one annotated product',()=>{
  expect(catalog.resolveExplicitCodeOrder('2 x Ramen De Miso (código 801), 1 x Maki Vegetal (código 802)',menu)).toBeNull();
 });
 it('does not hide a third purchase inside the notes of a coded row',()=>{
  expect(catalog.resolveExplicitCodeOrder('2 x Ramen De Miso (código 801), y un maki\n1 x Maki Vegetal (código 802)',menu)).toBeNull();
 });
});

it('keeps every quantity and recipient in the actual nine-row vision capture',()=>{
 const {readFileSync}=require('fs');const {join}=require('path');
 const recorded=JSON.parse(readFileSync(join(__dirname,'../../scripts/fixtures/whatsapp-media-model-output-1510.json'),'utf8'));
 const text=recorded.results.find(r=>r.kind==='images'&&r.id==='large').output.textForBot;
 const rows=text.split('\n');expect(rows).toHaveLength(9);
 rows.forEach((line,index)=>{expect(line).toMatch(new RegExp(`^${index%3+1} [x×] Ramen`));expect(line).toContain(`persona ${index+1}`);});
});
