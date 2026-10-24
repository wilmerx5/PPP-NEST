import {deliveryUnitConflict, resolveDeliveryUnitConflict} from './whatsapp-address-parts';
for (const [label,alias] of [['apartamento','apto'],['interior','int'],['torre','torre'],['bloque','bloque'],['casa','casa'],['piso','piso'],['local','local'],['entrada','entrada']]) {
 test(`resolves ${label} while preserving street and unrelated access details`,()=>{
  const source=`Calle 10 #20-30 ${alias} 708 ${label} 709, oficina 42`;
  const resolved=resolveDeliveryUnitConflict(source,label,'708');
  expect(deliveryUnitConflict(resolved)).toBeNull();
  expect(resolved).toContain('Calle 10 #20-30');
  expect(resolved).toContain(`${label} 708`);
  expect(resolved).not.toContain('709');
  expect(resolved).toContain('oficina 42');
 });
}
