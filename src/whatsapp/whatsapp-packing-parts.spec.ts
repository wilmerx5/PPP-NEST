import {splitKitchenPreference} from './whatsapp-kitchen-preference';
describe('Part packing clauses never imply a second purchase',()=>{
 it.each(['medio pollo en caja diferente','la mitad en una caja aparte','una parte de arroz en bolsa separada'])('binds the packing note %s',note=>expect(splitKitchenPreference(`Quiero un Combo Familiar pero ${note}`)).toEqual({productText:'Quiero un Combo Familiar',note}));
 it.each(['Quiero un Combo Familiar y medio pollo en caja diferente','Quiero un Combo Familiar pero otro pollo en caja diferente','Quiero un Combo Familiar pero medio pollo y una bebida en caja diferente','¿El combo viene con medio pollo en caja diferente?'])('does not absorb another intent: %s',source=>expect(splitKitchenPreference(source)).toBeNull());
});
