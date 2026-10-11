import {namedPackOrderQuantity} from './whatsapp-named-pack-quantity';
describe('Catalog names containing a pack count',()=>{
  it.each([
    ['Quiero tres hamburguesas clasicas','Tres  Hamburguesas Clasicas',1],
    ['Quiero 3 hamburguesas clásicas','Tres Hamburguesas Clasicas',1],
    ['Dos paquetes de tres arepas doradas','Tres Arepas Doradas',2],
    ['Quiero 3 combos de tres arepas doradas','Tres Arepas Doradas',3],
    ['Dos sopas y tres arepas doradas','Tres Arepas Doradas',1],
    ['Un dúo de bebidas naturales','Duo De Bebidas Naturales',1],
    ['Dos dúos de bebidas naturales','Duo De Bebidas Naturales',2],
    ['Quiero tres pollos fritos','1 Pollo Frito',null],
    ['Quiero seis arepas doradas','Tres Arepas Doradas',null],
  ])('%s / %s -> %s',(message,name,quantity)=>expect(namedPackOrderQuantity(String(message),String(name))).toBe(quantity));
});
