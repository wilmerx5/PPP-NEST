import {kitchenDescriptionNote,splitKitchenDescription} from './whatsapp-kitchen-description';
import {interpretProductNote} from './whatsapp-product-intent';

describe('Anchored kitchen descriptions preserve wording without consuming purchases',()=>{
 it.each(['dorada, bien bonita que no esté tan gorda','bien cocinados, que no me vayan a salir crudos','bien cocinadas, que no me vayan a salir crudas','bien doradita, que no venga tan gruesa','delgadita','dorda, bien bonita que no esté tan torda','muy crocante','que no esté muy seca','que venga bien caliente','que no nos vaya a salir cruda'])('keeps literal preference %s',note=>{
  expect(kitchenDescriptionNote(note)).toBe(note);
 });
 it.each(['bien cocinada y una gaseosa','bien bonita más dos papas','que me agreguen un postre','que no esté tan cruda; y dos jugos','¿la sirven bien cocinada?','bien cocinada para calle 12 34 56','pollo a la plancha','sin ensalada','bien dorada con camarones','bien bonita y hamburguesa'])('does not absorb another intent: %s',source=>{
  expect(kitchenDescriptionNote(source)).toBeNull();
 });
 it('keeps courtesy out of a relative cooking note',()=>{
  expect(splitKitchenDescription('Quiero dos pollos pero bien cocinados, que no me vayan a salir crudos por favor')).toEqual({productText:'Quiero dos pollos',note:'bien cocinados, que no me vayan a salir crudos'});
 });
 it('requires an anchor for an unqualified adjective',()=>{
  expect(splitKitchenDescription('Quiero una berenjena delgadita')).toBeNull();
  expect(interpretProductNote('Quiero una Berenjena delgadita',[{id:1,name:'Berenjena'}])).toMatchObject({productId:1,note:'delgadita'});
 });
});

describe('Intensity preferences remain bounded and catalogue anchored',()=>{
 it.each(['no tan dulce','que no venga tan dulce','que no esté tan salado','no tan picante','que no esté tan ácida','que no venga tan grasosa','muy dulce','no muy picante','un poco salado','que no sea demasiado ácido'])('preserves wording: %s',note=>expect(kitchenDescriptionNote(note)).toBe(note));
 it.each(['no tan dulce y dos cafés','que no esté tan salado con camarones','que no venga tan grasosa para calle 12 34 56','¿puede venir no tan picante?','sin gluten garantizado','soy alérgico a la leche','que sea seguro para celíacos','que no esté tan ácida; y un postre'])('does not swallow another request or safety condition: %s',note=>expect(kitchenDescriptionNote(note)).toBeNull());
 it.each(['Dulce','Picante','Salado','Ácido','Grasoso'])('preserves a longer exact named SKU: %s',suffix=>{
  const products=[{id:1,name:'Especial'},{id:2,name:`Especial ${suffix}`}];
  expect(interpretProductNote(`Quiero un Especial ${suffix}`,products)).toBeNull();
 });
});
