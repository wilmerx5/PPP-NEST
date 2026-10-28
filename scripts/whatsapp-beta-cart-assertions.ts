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

/** Order DTOs may flatten quantities into individual items. Keep variant ownership. */
export function cartLinesFromOrderItems(items: unknown): ActualCartLine[] | null {
  if (!Array.isArray(items)) return null;
  const groups = new Map<string,ActualCartLine>();
  for (const item of items) {
    const quantity = item?.quantity ?? 1;
    if (!item || !Number.isInteger(item.productId) || !Number.isInteger(quantity) || quantity < 1 ||
        (item.note !== undefined && typeof item.note !== 'string') ||
        (item.attributes !== undefined && (!Array.isArray(item.attributes) || item.attributes.some((attr: any) =>
          typeof attr?.attributeName !== 'string' || typeof attr?.attributeValue !== 'string')))) return null;
    const attributes = [...(item.attributes || [])].sort((a,b)=>
      `${a.attributeName}:${a.attributeValue}`.localeCompare(`${b.attributeName}:${b.attributeValue}`));
    const key = JSON.stringify([item.productId,attributes,normalize(item.note || '')]);
    const line = groups.get(key);
    if (line) line.quantity += quantity;
    else groups.set(key,{productId:item.productId,quantity,attributes,note:item.note});
  }
  return [...groups.values()];
}

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
