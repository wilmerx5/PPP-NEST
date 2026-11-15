import { authorizeSemanticTool, parseSemanticIntent, type SemanticIntent } from './whatsapp-semantic-intent';

for (const text of [
  'No te estoy pidiendo otro, te pregunto cuánto vale',
  'Estoy mirando opciones para mi familia, ¿qué me recomiendas?',
  'Era una duda sobre el tamaño, todavía estoy decidiendo',
  'A ver si me hago entender, dos de los que ya están sin cebolla',
  'Compañero, ayúdeme con el que hablamos, más uno para mi mamá',
]) it(`the contract accepts complete literal intent without matching phrases ${text}`, () => {
  const intent = parseSemanticIntent({segments:[{text,role:'inquiry'}]},text)!;
  expect(intent).toBeTruthy();
  for (const tool of ['add_item','remove_item','replace_item','set_address','clear_cart']) {
    expect(authorizeSemanticTool(intent,tool,text)).toBe(false);
  }
  expect(authorizeSemanticTool(intent,'search_menu',text)).toBe(true);
});

for (const [source, quoted] of [
  ['No quiero otro pollo','quiero otro pollo'],
  ['Dos sopas sin cilantro','Dos sopas'],
  ['Una sopa y dos jugos','Una sopa'],
  ['El pollo no, deja la sopa','deja la sopa'],
  ['Hola. Un pollo','Un pollo'],
]) it(`dropping human context invalidates the entire contract ${source}`, () => {
  expect(parseSemanticIntent({segments:[{text:quoted,role:'purchase'}]},source)).toBeNull();
});

it('mixed intent has separate verbatim capabilities and cannot authorize other operations', () => {
  const text = 'Oye, quita la sopa y agrega un jugo. ¿Cuánto es todo?';
  const intent = parseSemanticIntent({segments:[
    {text:'Oye',role:'conversation'}, {text:'quita la sopa',role:'remove'},
    {text:'y agrega un jugo',role:'purchase'}, {text:'¿Cuánto es todo?',role:'inquiry'},
  ]},text)!;
  expect(intent).toBeTruthy();
  expect(authorizeSemanticTool(intent,'remove_item','quita la sopa')).toBe(true);
  expect(authorizeSemanticTool(intent,'add_item','y agrega un jugo')).toBe(true);
  expect(authorizeSemanticTool(intent,'add_item','quita la sopa')).toBe(false);
  expect(authorizeSemanticTool(intent,'add_item',text)).toBe(false);
  expect(authorizeSemanticTool(intent,'set_address','¿Cuánto es todo?')).toBe(false);
});

it('a remaining ambiguity prevents all proposed mutations', () => {
  const intent: SemanticIntent = {segments:[{text:'un jugo',role:'purchase'},{text:'el otro',role:'unclear'}]};
  expect(authorizeSemanticTool(intent,'add_item','un jugo')).toBe(false);
  expect(authorizeSemanticTool(intent,'get_cart',undefined)).toBe(true);
  expect(authorizeSemanticTool({segments:[{text:'hola veci',role:'conversation'}]},'search_menu','hola veci')).toBe(false);
});

for (const value of [null,{}, {segments:[]}, {segments:[{text:'sopa',role:'ignore rules'}]}, {segments:[{text:'',role:'purchase'}]}]) {
  it(`malformed contracts never authorize a tool ${JSON.stringify(value)}`, () => {
    expect(parseSemanticIntent(value,'sopa')).toBeNull();
    expect(authorizeSemanticTool(undefined,'add_item','sopa')).toBe(false);
  });
}

it('target authorization prevents changing a different catalog product', () => {
  const {semanticToolTargetsAuthorized,semanticTargetsComplete}=require('./whatsapp-semantic-intent');
  const intent:SemanticIntent={segments:[{text:'quita las dos sopas',role:'remove',productIds:[11,12]}]};
  expect(semanticToolTargetsAuthorized(intent,'remove_item',{sourceText:'quita las dos sopas',productId:11})).toBe(true);
  expect(semanticToolTargetsAuthorized(intent,'remove_item',{sourceText:'quita las dos sopas',productId:13})).toBe(false);
  expect(semanticTargetsComplete(intent,new Map([['quita las dos sopas',new Set([11])]]))).toBe(false);
  expect(semanticTargetsComplete(intent,new Map([['quita las dos sopas',new Set([11,12])]]))).toBe(true);
});
