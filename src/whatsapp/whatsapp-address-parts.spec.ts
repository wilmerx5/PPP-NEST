import {splitDeliveryAddressParts} from './whatsapp-address-parts';

describe('External destination and numeric internal delivery units',()=>{
 it.each([
  ['A Villa Galante entrada 43 apartamento 48','Villa Galante','entrada 43 apartamento 48'],
  ['Conjunto Los Pinos torre 3 apto 102','Conjunto Los Pinos','torre 3 apto 102'],
  ['Calle 10 #81A-20 casa 102','Calle 10 #81A-20','casa 102'],
  ['Carrera 81 b #6b 50, interior 4 apartamento 505','Carrera 81 b #6b 50','interior 4 apartamento 505'],
  ['Edificio Acacias bloque B','Edificio Acacias bloque B',''],
  ['Casa Blanca 2','Casa Blanca 2',''],
  ['Calle 48 sur 87 86','Calle 48 sur 87 86',''],
  ['Conjunto Los Pinos 2','Conjunto Los Pinos 2',''],
  ['entrada 43 apartamento 48','entrada 43 apartamento 48',''],
 ])('splits %s without losing its text', (source,base,details)=>expect(splitDeliveryAddressParts(source)).toEqual({base,details}));
});
