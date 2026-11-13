/** Keep complete choice indexes available within WhatsApp's text-message limit. */
export function formatWhatsappChoicePage(input: {
  question: string;
  context?: string;
  rows: string[];
  startIndex?: number;
  direction?: 'next' | 'previous';
}): { text: string; startIndex: number; contextMessages: string[] } {
  const shorten = (text: string, limit: number) =>
    text.length <= limit
      ? text
      : text.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/, '') + '…';
  const rows = input.rows.map((row) => shorten(row, 1200));
  const starts = [0];
  let length = 0,
    count = 0;
  for (let index = 0; index < rows.length; index++) {
    if (count && (length + rows[index].length + 1 > 2100 || count === 12)) {
      starts.push(index);
      length = 0;
      count = 0;
    }
    length += rows[index].length + 1;
    count++;
  }
  let page = Math.max(0, starts.indexOf(input.startIndex ?? 0));
  if (input.direction === 'next') page = Math.min(starts.length - 1, page + 1);
  if (input.direction === 'previous') page = Math.max(0, page - 1);
  const startIndex = starts[page],
    endIndex = starts[page + 1] ?? rows.length;
  const question =
    input.question.length > 600 && input.question.endsWith('?')
      ? shorten(input.question, 599) + '?'
      : shorten(input.question, 600);
  const context = input.context || '';
  const contextMessages: string[] = [];
  if (context.length > 600) {
    let start = 0;
    while (start < context.length) {
      let end = Math.min(start + 3300, context.length);
      if (end < context.length && /[\uD800-\uDBFF]/.test(context[end - 1]))
        end--;
      contextMessages.push(context.slice(start, end));
      start = end;
    }
  }
  const header = [contextMessages.length ? '' : context, question]
    .filter(Boolean)
    .join('\n\n');
  const navigation = [
    page < starts.length - 1
      ? 'Escribe *siguientes* para ver más opciones.'
      : '',
    page > 0 ? 'Escribe *anteriores* para volver.' : '',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    startIndex,
    contextMessages,
    text:
      header +
      '\n' +
      rows.slice(startIndex, endIndex).join('\n') +
      (navigation ? '\n\n' + navigation : ''),
  };
}
