export type ExpectedCartLine = {
  id: number;
  quantity: number;
  attrs?: Array<{ key: string; value: string }>;
  note?: string[];
  forbidNote?: string[];
};
type ActualCartLine = {
  productId: number;
  quantity: number;
  attributes?: Array<{ attributeName: string; attributeValue: string }>;
  note?: string;
};
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// A single actual line must not satisfy two different expected lines. Match
// one-to-one, including a generic line next to a specifically annotated line.
export function matchesExpectedCartLines(expected: ExpectedCartLine[], actual: ActualCartLine[]): boolean {
  if (expected.length !== actual.length) return false;
  const candidates = expected.map(wanted => actual.flatMap((line, index) =>
    line.productId === wanted.id && line.quantity === wanted.quantity &&
    (wanted.attrs || []).every(a => (line.attributes || []).some(choice =>
      normalize(choice.attributeName) === normalize(a.key) && normalize(choice.attributeValue) === normalize(a.value))) &&
    (wanted.note || []).every(token => normalize(line.note || '').includes(normalize(token))) &&
    (wanted.forbidNote || []).every(token => !normalize(line.note || '').includes(normalize(token)))
      ? [index] : [])).sort((a, b) => a.length - b.length);
  const used = new Set<number>();
  function assign(position: number): boolean {
    if (position === candidates.length) return true;
    for (const index of candidates[position]) {
      if (used.has(index)) continue;
      used.add(index);
      if (assign(position + 1)) return true;
      used.delete(index);
    }
    return false;
  }
  return assign(0);
}
