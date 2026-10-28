import { twoUnitServingPlan } from './whatsapp-two-unit-serving-plan';

describe('bounded unit serving syntax',()=>{
  it.each([
    '¿Cuánto cuestan dos sopas una con arroz y la otra con arepa?',
    'No quiero dos sopas una con arroz y la otra con arepa',
    'Dos sopas una con arroz y la otra con arepa para Calle 10 #20-30',
    'Dos sopas una con arroz y la otra con arepa, y confirmar',
    'Dos sopas una con arroz y la otra con arepa, y una porción adicional de arroz, y otro pollo',
    'Dos sopas una con arroz o yuca y la otra con arepa',
    'Dos sopas una con arroz y la otra con arepa cuánto cuesta',
    'Dos sopas una con arroz y la otra con arepa cuánto tarda',
  ])('does not consume other intentions: %s',text=>expect(twoUnitServingPlan(text)).toBeNull());
  it('separates shared note, two unit clauses and an explicit purchase',()=>{
    expect(twoUnitServingPlan('Me regala dos Sopas bien calientes una con porción de arroz y la otra arepita, y una porción adicional de arroz')).toEqual({
      total:2,subject:'Sopas',shared:'bien calientes',notes:['con porción de arroz','con arepita'],extra:'una porción adicional de arroz',
    });
  });
});
