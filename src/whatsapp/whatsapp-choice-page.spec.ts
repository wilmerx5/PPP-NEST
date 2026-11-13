import { formatWhatsappChoicePage } from './whatsapp-choice-page';

for (const size of [0, 1, 12, 13, 40])
  for (const long of [false, true])
    test(`all ${size} choices remain reachable, long labels ${long}`, () => {
      const rows = Array.from(
        { length: size },
        (_, i) => `${i + 1}. ${long ? '🍗'.repeat(900) : 'Plato ' + (i + 1)}`,
      );
      const before = [...rows],
        seen: number[] = [];
      let startIndex = 0;
      for (let attempts = 0; attempts <= size; attempts++) {
        const page = formatWhatsappChoicePage({
          question: '¿Cuál prefieres?',
          context: 'Contexto '.repeat(200),
          rows,
          startIndex,
          direction: attempts ? 'next' : undefined,
        });
        expect(page.text.length).toBeLessThanOrEqual(3800);
        seen.push(
          ...[...page.text.matchAll(/^(\d+)\./gm)].map((match) =>
            Number(match[1]),
          ),
        );
        expect(page.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
        startIndex = page.startIndex;
        if (!page.text.includes('*siguientes*')) break;
      }
      expect(seen).toEqual(Array.from({ length: size }, (_, i) => i + 1));
      expect(rows).toEqual(before);
    });

test('page boundaries survive changing context and previous navigation', () => {
  const rows = Array.from(
    { length: 40 },
    (_, i) => `${i + 1}. Opción ${i + 1}`,
  );
  const first = formatWhatsappChoicePage({
    question: '¿Cuál prefieres?',
    rows,
  });
  const next = formatWhatsappChoicePage({
    question: '¿Cuál prefieres?',
    rows,
    startIndex: first.startIndex,
    direction: 'next',
    context: 'Información '.repeat(150),
  });
  expect(next.startIndex).toBe(12);
  const previous = formatWhatsappChoicePage({
    question: '¿Cuál prefieres?',
    rows,
    startIndex: next.startIndex,
    direction: 'previous',
  });
  expect(previous).toEqual(first);
});

for (const invalid of [-10, 1.5, 999, NaN])
  test(`legacy or invalid page ${invalid} starts safely`, () => {
    const rows = Array.from({ length: 20 }, (_, i) => `${i + 1}. Plato`);
    expect(
      formatWhatsappChoicePage({
        question: '¿Cuál prefieres?',
        rows,
        startIndex: invalid,
      }).startIndex,
    ).toBe(0);
  });

test('oversized context keeps the question and navigation visible', () => {
  const page = formatWhatsappChoicePage({
    question: '¿' + 'Pregunta '.repeat(150) + '?',
    context: 'Información '.repeat(500),
    rows: Array.from(
      { length: 30 },
      (_, i) => `${i + 1}. ${'Dato '.repeat(300)}`,
    ),
  });
  expect(page.text.length).toBeLessThanOrEqual(3800);
  expect(page.text).toContain('…?');
  expect(page.text).toContain('*siguientes*');
});

for (const size of [601, 3300, 3301, 8000])
  test(`long context ${size} is preserved in bounded messages`, () => {
    const context = '🍗Información completa. '
      .repeat(size)
      .slice(0, size)
      .replace(/[\uD800-\uDBFF]$/, '')
      .padEnd(size, 'X');
    const page = formatWhatsappChoicePage({
      question: '¿Cuál prefieres?',
      context,
      rows: ['1. Opción'],
    });
    expect(page.contextMessages.join('')).toBe(context);
    for (const message of page.contextMessages) {
      expect(message.length).toBeLessThanOrEqual(3300);
      expect(message).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
    }
    expect(page.text).toContain('¿Cuál prefieres?');
    expect(page.text).toContain('1. Opción');
  });
