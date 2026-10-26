import {splitDeliveryAddressParts} from './whatsapp-address-parts';

describe('External destination and numeric internal delivery units',()=>{
 it.each([
  ['A Villa Galante entrada 43 apartamento 48','Villa Galante','entrada 43 apartamento 48'],
  ['Conjunto Los Pinos torre 3 apto 102','Conjunto Los Pinos','torre 3 apto 102'],
  ['Calle 10 #81A-20 casa 102','Calle 10 #81A-20','casa 102'],
  ['Carrera 81 b #6b 50, interior 4 apartamento 505','Carrera 81 b #6b 50','interior 4 apartamento 505'],
  ['Edificio Acacias bloque B','Edificio Acacias','bloque B'],
  ['Casa Blanca 2','Casa Blanca 2',''],
  ['Calle 48 sur 87 86','Calle 48 sur 87 86',''],
  ['Conjunto Los Pinos 2','Conjunto Los Pinos 2',''],
  ['entrada 43 apartamento 48','entrada 43 apartamento 48',''],
 ])('splits %s without losing its text', (source,base,details)=>expect(splitDeliveryAddressParts(source)).toEqual({base,details}));
});

import {applyLocalGlossary} from './whatsapp-local-glossary';
describe('Street alias canonicalization requires a clear numbered address',()=>{
 it.each(['Tv.','Tv','Trv','Transv.'])('normalizes %s only in address shape',prefix=>expect(applyLocalGlossary(`${prefix} 78C #6D-48`)).toBe('Transversal 78C #6D-48'));
 it('normalizes carrera alias in an inline delivery clause',()=>expect(applyLocalGlossary('Quiero un plato para Kr 78C #6D-48')).toBe('Quiero un plato para Carrera 78C #6D-48'));
 it.each(['Combo TV 78','Combo TV 78 #23','Kr 78'])('preserves ambiguous product/code text: %s',source=>expect(applyLocalGlossary(source)).toBe(source));
});


describe('Lettered internal access and ambiguous building names',()=>{
 it.each([
 ['Conjunto Los Olivos torre B apartamento 304B','Conjunto Los Olivos','torre B apartamento 304B'],
 ['Edificio Las Acacias bloque C','Edificio Las Acacias','bloque C'],
 ['Calle 10 #81A-20 interior 2A oficina 405','Calle 10 #81A-20','interior 2A oficina 405'],
 ['Residencial Los Cedros, casa 12A','Residencial Los Cedros','casa 12A'],
 ['Conjunto Los Olivos torre B-2 apto 304','Conjunto Los Olivos','torre B-2 apto 304'],
 ])('splits explicit access in %s',(source,base,details)=>expect(splitDeliveryAddressParts(source)).toEqual({base,details}));
 it.each(['Casa Blanca','Edificio Torre del Sol','Conjunto Torre B','torre B apartamento 304B','Conjunto Los Pinos 2','Calle 10 #81A-20','Conjunto Los Pinos torre B, Calle 10 #81A-20'])('does not invent an external destination from %s',source=>expect(splitDeliveryAddressParts(source)).toEqual({base:source,details:''}));
});

// A surname or longer word must not become a single-letter delivery unit.
import {deliveryUnitConflict, resolveDeliveryUnitConflict, mergeDeliveryUnitDetails} from './whatsapp-address-parts';
describe('Delivery unit label boundaries',()=>{
 it.each(['Ana Torres','Luis Casas','Pedro Pison','Elena Locales'])('does not split the name %s',name=>{
  expect(deliveryUnitConflict(`a nombre de ${name}\nCalle 10 #20-30 torre 4 casa 5 piso 2 local 8`)).toBeNull();
 });
 it.each(['torre4 torre5','torre A torre B','torre#4 torre#5','torre.4 torre.5'])('still detects conflicts in %s',units=>{
  expect(deliveryUnitConflict(`Ana Torres, Calle 10 #20-30 ${units}`)?.label).toBe('torre');
 });
 it('resolves the units without rewriting the surname',()=>{
  expect(resolveDeliveryUnitConflict('Ana Torres Calle 10 #20-30 torre4 torre5','torre','5')).toBe('Ana Torres Calle 10 #20-30 torre 5');
 });
});

it('updates a real tower without replacing a surname suffix',()=>{
 expect(mergeDeliveryUnitDetails('Ana Torres Calle 10 #20-30 torre 4','torre 5')).toBe('Ana Torres Calle 10 #20-30 torre 5');
});
