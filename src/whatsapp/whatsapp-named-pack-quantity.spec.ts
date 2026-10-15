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
    ['Un duo de tacos con colombiana','Duo De Tacos Al Pastor',1],
    ['Dos duos de tacos','Duo De Tacos Al Pastor',2],
    ['Un trio de tacos','Duo De Tacos Al Pastor',null],
    ['Un trio de tacos','Trio De Tacos Al Pastor',1],
    ['Somos un duo y queremos un taco','Duo De Tacos Al Pastor',null],
    ['Quiero seis arepas doradas','Tres Arepas Doradas',null],
  ])('%s / %s -> %s',(message,name,quantity)=>expect(namedPackOrderQuantity(String(message),String(name))).toBe(quantity));
});
