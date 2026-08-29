/**
 * Fixtures anonimizados del corpus humano (cliente ↔ personal).
 * Usados por tests — sin teléfonos ni datos de pago reales.
 */

/** Direcciones / conjuntos que DEBEN clasificarse como domicilio (con carrito). */
export const CORPUS_ADDRESS_ONLY_SAMPLES: string[] = [
  'Bosques de castilla',
  'Terrazas de Castilla lll',
  'Para Castilla reservado',
  'Castilla reservado Int 7 apto 155',
  'Portal de Castilla, torre 3 apartamento 304',
  'Aralia de Castilla, torre 5 apto 501',
  'Parques de Castilla calle 6D #80B - 89 torre 5 int 2 apto 402',
  'San Felipe Castilla Torre 7 Apto 425',
  'Tabaku central T4 1213',
  'Conjunto Residencial Tabaku Central Torre 1 Apto 1101',
  'Portería nuevo sol',
  'nuevo sol torre 8 apto 129',
  'Paseo de las Américas Int 3 apto 501',
  'Balcones de la alameda Torre 7apto901',
  'Altavista. Torre 6 apto 1706',
  'Conjunto toledo Torre 4 Apto 815',
  'Torres de Castelló Torre 3 apto 102',
  'Brisas de Castilla Casa 115',
  'Plazuela de san esteban, interior 2 apartamento 501',
  'Rincón de techo III',
  'Conjunto villa galante Torre 7 apto 114',
  'Dg 38 bis Sur#82-56',
  'Carrera 78 n #42 c 65 sur',
];

/** No deben ser dirección (platos / comandos). */
export const CORPUS_NOT_ADDRESS_SAMPLES: string[] = [
  'arroz con pollo',
  'un pollo frito',
  'borra el pedido y vacio el carrito',
  'para el combo no quiero arepas',
  'quiero un churrasco',
];

/** Pares typo → substring esperado tras applyLocalGlossary. */
export const CORPUS_GLOSSARY_SAMPLES: Array<{ raw: string; expect: RegExp }> = [
  { raw: 'Giger', expect: /ginger/i },
  { raw: 'broster', expect: /broaster/i },
  { raw: 'sobrebarriga a la placha', expect: /plancha/i },
  { raw: '1-sobre barriga dorada', expect: /sobrebarriga/i },
  { raw: 'Adicionar un plata', expect: /plátano/i },
  { raw: 'arroz chuno', expect: /arroz chino/i },
  { raw: 'jugo de marcuya', expect: /maracuya/i },
  { raw: 'sopa de menundencia', expect: /menudencias/i },
  { raw: 'buena snoches', expect: /buenas noches/i },
  { raw: 'uenas tardes', expect: /buenas tardes/i },
  { raw: 'Par pagarte por nequi', expect: /para pagarte/i },
  { raw: 'papá a la francesa', expect: /papa a la francesa/i },
  { raw: 'coca cola cero', expect: /coca cola zero/i },
  { raw: 'medio broaster medio frito', expect: /mixto/i },
  { raw: 'en vez de yuca más papa', expect: /sin yuca más papa/i },
  { raw: 'tmb una botella', expect: /también/i },
];

/** Mensajes multi-dato: deben parecer multi-plato o pedido compuesto. */
export const CORPUS_MULTI_ITEM_SAMPLES: string[] = [
  '1 arroz con pollo y 1 pollo frito por favor',
  'Me regalas una sopa de mondongo por favor un cuarto de pollo pierna pernil y unas costillas',
  '2 sopas de menudencias y 2 sopas de ajiaco',
  'Un arroz chino en combo y un ajiaco',
  'Si por favor una hamburguesa y un arroz paisa',
];

/** Notas de guarnición (con carrito) — no addItems. */
export const CORPUS_SIDE_NOTE_SAMPLES: string[] = [
  'sin ensalada x favor',
  'Sin ensalada y sin yuca',
  'en vez de yuca más papa salada',
  'sin salsas, más miel',
  'Sopa pequeña de ajiaco sin cilantro',
  'me puedes dar porfa el menú sin ensalada',
];
