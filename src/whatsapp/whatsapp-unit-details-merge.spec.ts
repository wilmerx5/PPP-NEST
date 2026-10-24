import {mergeDeliveryUnitDetails} from './whatsapp-address-parts';

test.each([
 ['torre 3 apto 402','apartamento 708','torre 3 apartamento 708'],
 ['torre 3 apartamento 402','torre 5','torre 5 apartamento 402'],
 ['bloque B interior 2 apto 402','int 8','bloque B int 8 apto 402'],
 ['casa 12 piso 2','casa 19','casa 19 piso 2'],
 ['entrada A oficina 205','oficina # 310','entrada A oficina # 310'],
 ['torre 3 apto 402, frente al parque','apto 708','torre 3 apto 708, frente al parque'],
])('retains unmodified access details: %s + %s',(previous,incoming,expected)=>{
 expect(mergeDeliveryUnitDetails(previous,incoming)).toBe(expected);
});

test('adds a missing component without dropping supplied ones',()=>{
 expect(mergeDeliveryUnitDetails('torre 3 apto 402','interior 8')).toBe('torre 3 apto 402, interior 8');
});
