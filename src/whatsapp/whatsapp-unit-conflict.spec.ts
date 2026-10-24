import {deliveryUnitConflict} from './whatsapp-address-parts';
test.each([
 ['Calle 10 #20-30 apto 402 apartamento 708',{label:'apartamento',values:['402','708']}],
 ['Calle 10 #20-30 torre A torre B',{label:'torre',values:['A','B']}],
 ['Calle 10 #20-30 int 2 interior 4',{label:'interior',values:['2','4']}],
 ['Calle 10 #20-30 apto 708 apartamento #708',null],
 ['Calle 10 #20-30 torre a torre A apartamento 708',null],
 ['Calle 10 #20-30 torre 3 apto 708, frente al parque',null],
])('detects conflicting unit values without confusing aliases: %s',(text,expected)=>{
 expect(deliveryUnitConflict(text)).toEqual(expected);
});
