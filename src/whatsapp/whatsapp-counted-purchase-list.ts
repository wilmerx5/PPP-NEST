/** Keep catalog compounds intact while splitting explicit counted purchases. */
export function parseCountedPurchaseList<T>(text: string, resolve: (clause: string) => T | null, catalogPrefixEnd: (clause:string)=>number = ()=>0): T[] | null {
  const memo = new Map<string, T[] | null>();
  const visit = (tail: string): T[] | null => {
    if (memo.has(tail)) return memo.get(tail)!;
    const whole = resolve(tail);
    if (whole !== null) { const result = [whole]; memo.set(tail, result); return result; }
    const boundaries = [...tail.matchAll(/\s+y\s+(?:(?:ademas|tambien)\s+)?(?:(?:agrega|agregame|anade|anademe|ponme|dame)\s+)?(?=(?:un|una|uno|otro|otra|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+)\s)/g)];
    const protectedEnd=catalogPrefixEnd(tail);
    for (const boundary of boundaries.reverse()) {
      if (boundary.index!<protectedEnd) continue;
      const item = resolve(tail.slice(0, boundary.index).trim());
      if (item === null) continue;
      const rest = visit(tail.slice(boundary.index! + boundary[0].length));
      if (rest) { const result = [item, ...rest]; memo.set(tail, result); return result; }
    }
    memo.set(tail, null); return null;
  };
  return visit(text.trim());
}
