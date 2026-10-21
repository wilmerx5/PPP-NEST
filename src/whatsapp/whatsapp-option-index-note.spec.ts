import { harness } from './whatsapp-accuracy.test-support';
import { splitOptionIndexAnswer, trailingServingNote } from './whatsapp-kitchen-preference';

type Attribute = { attributeName: string; options: string[] };
type Product = { id: number; code: number; name: string; price: number; categoryName: string; availableNow: boolean; hasAttributes: boolean; attributes: Attribute[] };
type Menu = {
  id: string; dish: Product; temperatureDish: Product; filler: Product;
  indexNotes: Array<[string, number, string]>; nameNote: [string, string, string];
};

const product = (id: number, name: string, price: number, categoryName: string, attributes: Attribute[] = []): Product =>
  ({ id, code: id, name, price, categoryName, availableNow: true, hasAttributes: attributes.length > 0, attributes });

const menus: Menu[] = [
  { id: 'chicken combo',
    dish: product(410, 'Combo Alitas', 48000, 'Combos', [
      { attributeName: 'Arepas', options: ['Blancas', 'Fritas'] },
      { attributeName: 'Bebida', options: ['Colombiana', 'Manzana', 'Uva', 'Pepsi', 'Sprite', 'Ginger', 'Kola'] }]),
    temperatureDish: product(411, 'Limonada Natural', 7000, 'Bebidas', [{ attributeName: 'Servida', options: ['Al clima', 'Fría'] }]),
    filler: product(412, 'Alitas Bbq', 30000, 'Alitas'),
    indexNotes: [['2 que esté fría porfavor', 2, 'fría'], ['la 3 bien fría', 3, 'bien fría'], ['4, sin hielo por favor', 4, 'sin hielo']],
    nameNote: ['Sprite bien helada', 'Sprite', 'bien helada'] },
  { id: 'burger doneness first',
    dish: product(420, 'Combo Hamburguesa Doble', 36000, 'Hamburguesas', [
      { attributeName: 'Término', options: ['Medio', 'Tres cuartos', 'Bien asado'] },
      { attributeName: 'Gaseosa', options: ['Cola', 'Naranja', 'Limón', 'Uva'] }]),
    temperatureDish: product(421, 'Malteada', 12000, 'Bebidas', [{ attributeName: 'Temperatura', options: ['Helada', 'Al clima'] }]),
    filler: product(422, 'Papas Rústicas', 9000, 'Acompañantes'),
    indexNotes: [['1 bien fría por favor', 1, 'bien fría'], ['opción 4 al clima', 4, 'al clima'], ['3 sin hielo', 3, 'sin hielo']],
    nameNote: ['naranja que esté fría', 'Naranja', 'fría'] },
  { id: 'breakfast hot drink',
    dish: product(430, 'Desayuno Completo', 18000, 'Desayunos', [
      { attributeName: 'Huevos', options: ['Pericos', 'Fritos', 'Revueltos'] },
      { attributeName: 'Bebida', options: ['Café', 'Chocolate', 'Aromática', 'Té'] }]),
    temperatureDish: product(431, 'Jugo De Mora', 6000, 'Jugos', [{ attributeName: 'Preparación', options: ['En agua', 'En leche', 'Frío'] }]),
    filler: product(432, 'Arepa Con Queso', 5000, 'Adicionales'),
    indexNotes: [['2 bien caliente porfa', 2, 'bien caliente'], ['el 1, que esté tibio', 1, 'tibio'], ['4 sin azúcar por favor', 4, 'sin azúcar']],
    nameNote: ['chocolate bien caliente gracias', 'Chocolate', 'bien caliente'] },
];

describe('option index and serving note helpers', () => {
  it.each([
    ['2 que esté fría porfavor', { index: 2, rest: 'que esté fría' }],
    ['la 3, sin hielo', { index: 3, rest: 'sin hielo' }],
    ['2 por favor', { index: 2, rest: '' }],
    ['opción 4 al clima', { index: 4, rest: 'al clima' }],
  ])('«%s» splits into an option number and a remark', (text, expected) => {
    expect(splitOptionIndexAnswer(text)).toEqual(expected);
  });

  it.each(['2', 'dos que esté fría', 'quiero 2 combos', 'calle 2 sur'])('«%s» is not an option number with a remark', text => {
    expect(splitOptionIndexAnswer(text)).toBeNull();
  });

  it.each([
    ['Manzana bien fría por favor', { head: 'Manzana', note: 'bien fría' }],
    ['que esté fría', { head: '', note: 'fría' }],
    ['la naranja que me la manden helada', { head: 'la naranja que me la manden', note: 'helada' }],
    ['¿viene fría?', null],
    ['Manzana', null],
  ])('«%s» serving note', (text, expected) => {
    expect(trailingServingNote(text)).toEqual(expected);
  });
});

describe.each(menus)('$id: option number or name with a serving note', m => {
  describe.each([false, true])('agent %s', agent => {
    const start = (dish: Product = m.dish, selected: Array<{ attributeName: string; attributeValue: string }> | null = null) => {
      const h = harness([m.filler, m.dish, m.temperatureDish] as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      h.service.aiService.generateTurn = jest.fn().mockResolvedValue({ reply: '¿Cuál prefieres?', actions: {} });
      h.agent.runTurn.mockResolvedValue({ reply: '¿Qué se te antoja? Escribe el plato o el código.', actions: {}, toolCalls: [] });
      const prefilled = selected ?? (dish.attributes.length > 1
        ? [{ attributeName: dish.attributes[0].attributeName, attributeValue: dish.attributes[0].options[0] }] : []);
      h.conv.sessionData = { ...h.conv.sessionData, pendingAttribute: { productId: dish.id, name: dish.name, code: dish.code,
        price: dish.price, quantity: 1, attributes: dish.attributes, selected: prefilled } } as never;
      h.conv.state = 'awaiting_attribute' as never;
      return h;
    };
    const open = (dish: Product = m.dish) => dish.attributes[dish.attributes.length - 1];
    const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const line = (h: ReturnType<typeof harness>) => h.cartRows()[0] as { id: number; qty: number; note?: string; attrs: string[] } | undefined;

    it.each(m.indexNotes)('«%s» picks option %i and keeps «%s» as the note', async (text, index, note) => {
      const h = start();
      const reply = String(await h.sendQueued(text));
      const row = line(h);
      expect(h.conv.sessionData.pendingAttribute).toBeFalsy();
      expect(row?.id).toBe(m.dish.id);
      expect(row?.qty).toBe(1);
      expect(row?.attrs).toContain(`${open().attributeName}:${open().options[index - 1]}`);
      expect(plain(row?.note || '')).toContain(plain(note));
      expect(plain(reply)).toContain(plain(note));
    });

    it('a number with only courtesy picks that option without a note', async () => {
      const h = start();
      await h.sendQueued('2 por favor');
      const row = line(h);
      expect(row?.attrs).toContain(`${open().attributeName}:${open().options[1]}`);
      expect(row?.note).toBeFalsy();
    });

    it('a bare number still picks that option without a note', async () => {
      const h = start();
      await h.sendQueued('3');
      expect(line(h)?.attrs).toContain(`${open().attributeName}:${open().options[2]}`);
      expect(line(h)?.note).toBeFalsy();
    });

    it('the option name with a serving note keeps the note', async () => {
      const h = start();
      const [text, option, note] = m.nameNote;
      await h.sendQueued(text);
      const row = line(h);
      expect(row?.attrs).toContain(`${open().attributeName}:${option}`);
      expect(plain(row?.note || '')).toContain(plain(note));
    });

    it('a number beyond the listed options is not picked', async () => {
      const h = start();
      await h.sendQueued(`${open().options.length + 1} bien fría por favor`);
      expect(h.cartRows()).toHaveLength(0);
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.dish.id);
    });

    it('a question about an option is not taken as a pick', async () => {
      const h = start();
      await h.sendQueued('la 2 viene fría?');
      expect(h.cartRows()).toHaveLength(0);
      expect(h.conv.sessionData.pendingAttribute?.productId).toBe(m.dish.id);
    });

    it('a number followed by another option name is not resolved as that number with a note', async () => {
      const h = start();
      await h.sendQueued(`2 bien fría y ${open().options[0]}`);
      expect(line(h)?.attrs || []).not.toContain(`${open().attributeName}:${open().options[1]}`);
    });

    it('a temperature that is itself an option is chosen, not repeated as a note', async () => {
      const dish = m.temperatureDish;
      const h = start(dish, []);
      const option = dish.attributes[0].options.find(value => /fr[ií]|helad/i.test(value))!;
      await h.sendQueued(option.toLowerCase());
      const row = line(h);
      expect(row?.attrs).toContain(`${dish.attributes[0].attributeName}:${option}`);
      expect(row?.note || '').not.toMatch(/fr[ií]|helad/i);
    });

    it('on the first step a number with courtesy resolves exactly like the bare number', async () => {
      const bare = start(m.dish, []);
      const bareReply = String(await bare.sendQueued('2'));
      const polite = start(m.dish, []);
      const politeReply = String(await polite.sendQueued('2 por favor'));
      expect(polite.cartRows()).toEqual(bare.cartRows());
      expect(polite.conv.sessionData.pendingAttribute?.selected).toEqual(bare.conv.sessionData.pendingAttribute?.selected);
      expect(politeReply).toBe(bareReply);
      expect(JSON.stringify([polite.cartRows(), polite.conv.sessionData.pendingAttribute?.selected]))
        .toContain(`${m.dish.attributes[0].options[1]}`);
    });
  });
});
