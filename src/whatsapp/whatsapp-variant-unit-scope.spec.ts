import {variantUnitScope} from './whatsapp-variant-unit-scope';
const count=(word:string)=>({un:1,una:1,uno:1,dos:2,tres:3,cuatro:4}[word] ?? NaN);
describe('Explicit scope of a combo conversion is distinct from drink quantity',()=>{
 it.each([
  ['el Bowl damelo solo 2 en combo con Agua',{quantity:2}],
  ['el Bowl damelo en combo con Agua, pero solo dos',{quantity:2}],
  ['dos de los cuatro en combo con Agua',{quantity:2,statedTotal:4}],
  ['solo dos de las cuatro en combo',{quantity:2,statedTotal:4}],
  ['el Bowl en combo, solamente una unidad por favor',{quantity:1}],
  ['solo 0 en combo',{quantity:0}],
  ['solo 99 en combo',{quantity:99}],
 ])('parses %s',(text,expected)=>expect(variantUnitScope(text,count)).toEqual(expected));
 it.each(['el Bowl en combo con solo dos gaseosas','quiero un combo con dos papas','cuatro bowls con Agua','el Bowl en combo, pero solo dos litros','solo un Bowl, no en combo'])('does not reinterpret a side/drink count: %s',text=>expect(variantUnitScope(text,count)).toBeNull());
});
