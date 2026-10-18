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
