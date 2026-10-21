import { harness } from './whatsapp-accuracy.test-support';
import { applyLocalGlossary } from './whatsapp-local-glossary';

type Family = { id: string; dishes: [string, string, string]; category: string; categoryWord: string; missing: string };

const families: Family[] = [
  { id: 'grill', dishes: ['Churrasco', 'Costilla Bbq', 'Limonada Natural'], category: 'Carnes', categoryWord: 'carne', missing: 'sushi' },
  { id: 'bakery', dishes: ['Croissant Jamon', 'Pan De Bono', 'Cafe Con Leche'], category: 'Panaderia', categoryWord: 'pan', missing: 'pizza' },
  { id: 'seafood', dishes: ['Mojarra Frita', 'Cazuela De Mariscos', 'Jugo De Mora'], category: 'Pescados', categoryWord: 'pescado', missing: 'hamburguesa' },
];

const menuOf = (f: Family) => f.dishes.map((name, i) => ({
  id: 700 + i, code: 70 + i, name, price: 12000 + i * 4000, categoryName: i < 2 ? f.category : 'Bebidas',
  availableNow: true, hasAttributes: false, attributes: [],
}));

const questions = [
  'buenos dias,  uqe me ofreces',
  'buenos dias, que me ofreces',
  'que me ofreces',
  'qué me ofreces?',
  'q me ofreces',
  'buenas, ke tienen',
  'buenas tardes, qe hay de comer',
  'hola, qué me ofrece',
];

const generic = /Escribe el \*plato\* o el \*código\*|No tenemos productos de (?:comer|comida)|no lo resuelvo/i;

describe.each(families)('$id: «qué me ofreces» (with typos and a greeting) is a menu question', f => {
  describe.each([false, true])('agent %s', agent => {
    const rig = () => {
      const h = harness(menuOf(f) as never, agent);
      h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
      return h;
    };

    it.each(questions)('«%s» is answered with the menu, not the generic nudge', async question => {
      const h = rig();
      const reply = String(await h.sendQueued(question));
      expect(reply).not.toMatch(generic);
      const showsMenu = reply.includes(f.category) || reply.includes(f.dishes[0]);
      if (!agent) expect(showsMenu).toBe(true);
      else expect(showsMenu || h.agent.runTurn.mock.calls.length > 0).toBe(true);
      expect(h.conv.sessionData.cart).toEqual([]);
    });

    it('contrast: an explicit order still adds the dish', async () => {
      const h = rig();
      await h.sendQueued(`quiero un ${f.dishes[0].toLowerCase()}`);
      expect(h.conv.sessionData.cart.map((l: any) => l.name)).toEqual([f.dishes[0]]);
    });

    it('contrast: asking for a dish that is not on the menu still says so', async () => {
      const h = rig();
      const reply = String(await h.sendQueued(`tienen ${f.missing}?`));
      expect(reply).toMatch(new RegExp(`No tenemos productos de ${f.missing}|no (?:tenemos|manejamos)`, 'i'));
      expect(h.conv.sessionData.cart).toEqual([]);
    });
  });
});

describe('glossary: «que» typos only before an offer verb', () => {
  it.each([
    ['uqe me ofreces', 'que me ofreces'],
    ['buenas, ke tienen', 'buenas, que tienen'],
    ['qe hay de comer', 'que hay de comer'],
    ['k recomiendas', 'que recomiendas'],
  ])('«%s» → «%s»', (input, expected) => expect(applyLocalGlossary(input)).toBe(expected));

  it.each(['q tal', 'ok q bien', 'el k 2', 'que me ofreces'])('«%s» is left as is', input => expect(applyLocalGlossary(input)).toBe(input));
});
