'use strict';

function buildPlan(products) {
  const find = name => products.find(p => p.name === name);
  const churrasco = find('Churrasco'), sobrebarriga = find('Sobrebarriga'), ribs = find('Costillas De Cerdo');
  const mojarra = find('Mojarra'), chicken = find('1 Pollo Frito'), broaster = find('1 Pollo Broaster');
  if (!churrasco || !sobrebarriga || !ribs || !mojarra || !chicken || !broaster) throw Error('REQUIRED_MENU_PRODUCTS_MISSING');
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
  const c3 = line(churrasco, 3, [], ['sin ensalada']);
  const m2 = line(mojarra, 2, option('Asada'));
  const arepas = value => [{ attributeName: 'Arepas', attributeValue: value }];
  const chicken3 = line(chicken, 3, arepas('Fritas'));
  const chicken1 = line(chicken, 1, arepas('Fritas'));
  const broaster2 = line(broaster, 2, arepas('Blancas'));
  const broaster1 = line(broaster, 1, arepas('Blancas'));
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
    { id: 'prepare-chicken-regression', text: 'Vacía este carrito para empezar otra prueba.', cart: [] },
    { id: 'seed-three-two-three', text: 'Tres churrascos sin ensalada, dos mojarras asadas y tres pollos fritos con las arepas fritas.', cart: [c3, m2, chicken3] },
    { id: 'only-one-chicken-preserve-other-dishes', text: 'Solo era un pollo', cart: [c3, m2, chicken1] },
    { id: 'read-cart-after-quantity-correction', text: '¿Cómo va el carrito?', cart: [c3, m2, chicken1] },
    { id: 'add-second-chicken-preparation', text: 'Agrega dos pollos broaster con arepas blancas.', cart: [c3, m2, chicken1, broaster2] },
    { id: 'ambiguous-chicken-quantity-preserve-all', text: 'Solo era un pollo', cart: [c3, m2, chicken1, broaster2], pendingQuantity: 1 },
    { id: 'choose-second-existing-chicken-line', text: '2', cart: [c3, m2, chicken1, broaster1], pendingQuantity: false },
    { id: 'remove-broaster-preserve-fried-chicken', text: 'Quita el pollo broaster; conserva el pollo frito, las mojarras y los churrascos.', cart: [c3, m2, chicken1] },
    { id: 'clear-cart', text: 'Vacía el carrito y empieza de cero.', cart: [] },
  ];
}

function knownVariantDraft(products) {
  return buildPlan(products)[2].cart.map(line => ({ ...line,
    quantity: line.attrs.some(a => a.attributeValue === 'Asada') ? 2 : line.quantity }));
}

function buildKnownVariantResumePlan(products) {
  const original = buildPlan(products);
  const restored = original[2].cart;
  return [
    { ...original[1], id: 'recheck-ribs-composition', cart: knownVariantDraft(products) },
    { id: 'recover-known-asada-quantity', text: 'Solo era una sobrebarriga asada', cart: restored },
    { id: 'duplicate-recovery-webhook', duplicatePrevious: true, cart: restored },
    ...original.slice(4, 13),
    { ...original[2], id: 'recheck-grouped-variants-total' },
    { ...original[3], id: 'duplicate-grouped-variants-webhook' },
    { ...original[12], id: 'prepare-chicken-after-grouped-recheck' },
    ...original.slice(13),
  ];
}

function knownCollapsedVariantDraft(products) {
  const original = buildPlan(products)[2].cart;
  return [{ ...original[0], note: [] }, { ...original[1], quantity: 4 }];
}

function buildCollapsedVariantResumePlan(products) {
  return [{ id: 'reset-verified-collapsed-test-draft', text: 'Vacía el carrito y empieza de cero.', cart: [] },
    ...buildPlan(products).slice(2)];
}

module.exports = { buildPlan, knownVariantDraft, buildKnownVariantResumePlan,
  knownCollapsedVariantDraft, buildCollapsedVariantResumePlan,
  knownVariantRemovalDraft: products => buildPlan(products)[4].cart,
  buildVariantRemovalResumePlan: products => buildPlan(products).slice(5),
  knownDishNoteDraft: products => buildPlan(products)[5].cart,
  buildDishNoteResumePlan: products => buildPlan(products).slice(6) };
