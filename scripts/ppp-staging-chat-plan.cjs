'use strict';

function buildPlan(products) {
  const find = name => products.find(p => p.name === name);
  const churrasco = find('Churrasco'), sobrebarriga = find('Sobrebarriga'), ribs = find('Costillas De Cerdo');
  if (!churrasco || !sobrebarriga || !ribs) throw Error('REQUIRED_MENU_PRODUCTS_MISSING');
  const line = (p, quantity, attrs = [], note = [], forbidNote = []) => ({
    productId: p.id, quantity, unitPrice: Number(p.price), attrs, note, forbidNote,
  });
  const option = value => [{ attributeName: 'Seleccion', attributeValue: value }];
  const c1 = line(churrasco, 1, [], ['sin ensalada']);
  const c2 = line(churrasco, 2, [], ['sin ensalada']);
  const asada = line(sobrebarriga, 1, option('Asada'));
  const salsa = line(sobrebarriga, 1, option('En Salsa'));
  const ribNote = line(ribs, 1, [], ['sin arroz']);
  const ribNormal = line(ribs, 1, [], [], ['sin arroz']);
  return [
    { id: 'lunch-meat-inquiry', text: 'Hola, ¿qué tienen para almorzar? ¿Hay algo con carne?', cart: [], reply: 'meat' },
    { id: 'ribs-composition', text: '¿Las costillas de cerdo traen ensalada?', cart: [], reply: 'ribs' },
    { id: 'multiple-products-variants-note', text: 'Quiero un churrasco sin ensalada y dos sobrebarrigas: una asada y otra en salsa.', cart: [c1, asada, salsa] },
    { id: 'duplicate-webhook', duplicatePrevious: true, cart: [c1, asada, salsa] },
    { id: 'absolute-quantity', text: 'Deja dos churrascos en total, no dos más.', cart: [c2, asada, salsa] },
    { id: 'remove-one-variant', text: 'Quita la sobrebarriga en salsa; conserva la asada y los churrascos.', cart: [c2, asada] },
    { id: 'append-dish-note', text: 'A los churrascos ponles también papas bien crocantes.', cart: [line(churrasco, 2, [], ['sin ensalada', 'crocantes']), asada] },
    { id: 'remove-one-note', text: 'Quita la nota de papas crocantes de los churrascos y conserva sin ensalada.', cart: [line(churrasco, 2, [], ['sin ensalada'], ['crocantes']), asada] },
    { id: 'change-attribute', text: 'Cambia la sobrebarriga asada a en salsa.', cart: [c2, salsa] },
    { id: 'add-product-with-note', text: 'Agrega unas costillas de cerdo sin arroz.', cart: [c2, salsa, ribNote] },
    { id: 'remove-product-preserve-others', text: 'Quita los churrascos, conserva la sobrebarriga y las costillas.', cart: [salsa, ribNote] },
    { id: 'restore-normal-dish', text: 'Quita solamente la nota sin arroz de las costillas.', cart: [salsa, ribNormal] },
    { id: 'clear-cart', text: 'Vacía el carrito y empieza de cero.', cart: [] },
  ];
}

module.exports = { buildPlan };
