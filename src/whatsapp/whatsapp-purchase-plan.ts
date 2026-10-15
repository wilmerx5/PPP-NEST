import type { AiOrderAction } from './types/whatsapp-session.types';
import type {
  WhatsappCatalogProduct,
  WhatsappCatalogService,
} from './whatsapp-catalog.service';

type Addition = NonNullable<AiOrderAction['addItems']>[number];
export type PurchaseQuantityEvidence = {
  product: { name: string; code?: number };
  aiQuantity?: number;
  sourceText?: string;
  quantitySource?: string;
  multiQtyOrder: boolean;
  forcedQty: number;
};
export type PurchasePlanDiagnostic = {
  code:
    | 'duplicate_proposals_merged'
    | 'purchase_filtered_as_side'
    | 'legacy_side_fallback'
    | 'quantity_recomputed'
    | 'validated_tool_purchase_preserved';
  productId: number;
  proposedQuantity?: number;
  resolvedQuantity?: number;
};
export type PreparedPurchase = {
  product: WhatsappCatalogProduct;
  quantity: number;
  note?: string;
  attributes?: NonNullable<Addition['attributes']>;
  sourceText?: string;
};
export type PurchasePlan = {
  lines: PreparedPurchase[];
  diagnostics: PurchasePlanDiagnostic[];
};
type PurchaseCatalog = Pick<
  WhatsappCatalogService,
  | 'looksLikeMultiItemOrderMessage'
  | 'countQuantityMentions'
  | 'extractProductModificationNote'
  | 'orderSegmentForProduct'
  | 'looksLikeClearlyMultiDishOrder'
  | 'productNameFitsUtterance'
  | 'resolveAttributesFromMessage'
  | 'fillDefaultAttributes'
  | 'extractQuantityFromSegment'
  | 'extractExplicitAttributeChoice'
>;

/** Preparation only: no state writes, transport, model calls or cart mutation.
 * The adapter supplies the existing evidence resolvers; diagnostics expose their overrides.
 * Business behavior is deliberately preserved in this first migration, including legacy side filtering.
 */
export function prepareValidatedPurchases(input: {
  additions: NonNullable<AiOrderAction['addItems']>;
  products: WhatsappCatalogProduct[];
  sourceText?: string;
  forcedQty: number;
  validatedToolActions?: boolean;
  catalog: PurchaseCatalog;
  resolveQuantity: (evidence: PurchaseQuantityEvidence) => number;
}): PurchasePlan {
  const {
    additions,
    products,
    sourceText,
    forcedQty,
    catalog,
    resolveQuantity,
  } = input;
  const diagnostics: PurchasePlanDiagnostic[] = [];
  const lines: PreparedPurchase[] = [];
  // The tool already validated SKU, quantity, options and scoped notes. Do not
  // reinterpret its complete accepted plan with a second language parser.
  if (input.validatedToolActions) {
    for (const item of additions) {
      const product = products.find(candidate => candidate.id === item.productId);
      if (!product) continue;
      lines.push({product,quantity:item.quantity ?? 1,note:item.note,
        attributes:structuredClone(item.attributes)});
      diagnostics.push({code:'validated_tool_purchase_preserved',productId:item.productId});
    }
    return {lines,diagnostics};
  }
  const multiQtyOrder =
    additions.length > 1 ||
    (!!sourceText &&
      (catalog.looksLikeMultiItemOrderMessage(sourceText) ||
        catalog.countQuantityMentions(sourceText) >= 2));
  const modNote = sourceText
    ? catalog.extractProductModificationNote(sourceText)
    : null;
  // Un plato + nota: no dejar que la IA meta acompañamientos (yuca/papa)
  let items = structuredClone(additions);
  const repeatedClauseQuantities = new Map<(typeof items)[number], number>();
  // The model may split "2 arroces" into two identical add_item calls.
  // Resolve the customer's single quantity once for each identical line.
  if (sourceText) {
    const grouped = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      const attrs = (item.attributes || [])
        .map(
          (a) =>
            `${a.attributeName.toLowerCase()}:${a.attributeValue.toLowerCase()}`,
        )
        .sort();
      const product = products.find((p) => p.id === item.productId);
      const ownSegment =
        product &&
        catalog.orderSegmentForProduct(
          sourceText,
          product,
          products,
          item.attributes,
        );
      const uniqueClause =
        !catalog.looksLikeClearlyMultiDishOrder(sourceText) ||
        ownSegment !== sourceText;
      const clauses =
        !uniqueClause && product && !item.note
          ? sourceText
              .split(
                /(?:\s+y\s+|,\s*|;\s*)(?=(?:(?:aparte|adem[aá]s)\s+)?(?:otr[oa]s?|un[oa]?s?|\d+|dos|tres|cuatro|cinco)\b)/i,
              )
              .filter((segment) => {
                const codes = [
                  ...segment.matchAll(/(?:#|c[oó]digo\s*)\s*(\d{1,4})\b/gi),
                ];
                return codes.length
                  ? codes.some((match) => Number(match[1]) === product.code)
                  : catalog.productNameFitsUtterance(product, segment);
              })
          : [];
      const choicesKey = (choices: typeof item.attributes) =>
        JSON.stringify(
          (choices || [])
            .map(
              (a) =>
                `${a.attributeName.toLowerCase()}:${a.attributeValue.toLowerCase()}`,
            )
            .sort(),
        );
      const sameChoices =
        clauses.length > 1 &&
        clauses.every((segment) => {
          const parsed = catalog.resolveAttributesFromMessage(
            product!,
            segment,
            [],
          );
          return (
            parsed.status !== 'invalid' &&
            choicesKey(
              catalog.fillDefaultAttributes(product!, parsed.attributes),
            ) ===
              choicesKey(
                catalog.fillDefaultAttributes(product!, item.attributes || []),
              ) &&
            !catalog.extractProductModificationNote(segment)
          );
        });
      const key = JSON.stringify([
        item.productId,
        attrs,
        (item.note || '').trim().toLowerCase(),
        uniqueClause || sameChoices ? null : grouped.size,
      ]);
      const previous = grouped.get(key);
      if (previous)
        diagnostics.push({
          code: 'duplicate_proposals_merged',
          productId: item.productId,
        });
      const combined = previous
        ? {
            ...previous,
            quantity: (previous.quantity || 1) + (item.quantity || 1),
          }
        : item;
      grouped.set(key, combined);
      if (sameChoices)
        repeatedClauseQuantities.set(
          combined,
          clauses.reduce(
            (sum, segment) => sum + catalog.extractQuantityFromSegment(segment),
            0,
          ),
        );
    }
    items = [...grouped.values()];
  }
  if (modNote && items.length > 1) {
    const beforeFilter = items;
    items = items.filter((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return false;
      const name = product.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const noteQ = modNote
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const sideToks = [
        'yuca',
        'papa',
        'papas',
        'patacon',
        'platano',
        'ensalada',
        'arroz',
      ];
      return !sideToks.some((t) => name.includes(t) && noteQ.includes(t));
    });
    for (const item of beforeFilter.filter((item) => !items.includes(item)))
      diagnostics.push({
        code: 'purchase_filtered_as_side',
        productId: item.productId,
      });
    if (!items.length) {
      items = structuredClone(additions.slice(0, 1));
      diagnostics.push({
        code: 'legacy_side_fallback',
        productId: items[0].productId,
      });
    }
  }
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    const itemSource =
      sourceText && multiQtyOrder
        ? catalog.orderSegmentForProduct(
            sourceText,
            product,
            products,
            item.attributes,
          )
        : sourceText;
    const qty =
      repeatedClauseQuantities.get(item) ??
      resolveQuantity({
        product,
        aiQuantity: item.quantity,
        sourceText,
        quantitySource: itemSource,
        multiQtyOrder,
        forcedQty,
      });
    // En multi-ítem: la nota de "con queso" solo aplica al plato que la menciona
    const itemNote =
      item.note?.trim() ||
      (multiQtyOrder ? undefined : modNote || undefined) ||
      undefined;
    const fromText = itemSource
      ? catalog.extractExplicitAttributeChoice(itemSource, product)
      : null;

    if (qty !== (item.quantity ?? 1))
      diagnostics.push({
        code: 'quantity_recomputed',
        productId: item.productId,
        proposedQuantity: item.quantity ?? 1,
        resolvedQuantity: qty,
      });
    lines.push({
      product,
      quantity: qty,
      note: itemNote,
      attributes: structuredClone(fromText || item.attributes),
      sourceText: itemSource,
    });
  }
  return { lines, diagnostics };
}

function purchaseNoteKey(note?: string | null): string {
  return (note || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/** Opt in only for a complete accepted batch; legacy/mixed/rejected proposals keep their existing path.
 * Same SKU and options stay distinct when every line has its own note. A blank note beside a noted twin stays legacy. */
export function hasCompleteToolPurchaseEvidence(
 attempts: readonly {productId:number;accepted:boolean}[] | undefined,
 additions: AiOrderAction['addItems'],
): boolean {
 if (!attempts?.length || !additions?.length || attempts.length!==additions.length || attempts.some(a=>!a.accepted)) return false;
 const remaining=attempts.map(a=>a.productId);
 const signatures=new Set<string>();
 const notesByVariant=new Map<string,string[]>();
 for(const item of additions){
  const attrs=(item.attributes||[]).map(a=>[a.attributeName,a.attributeValue]).sort();
  const note=purchaseNoteKey(item.note);
  const variant=JSON.stringify([item.productId,attrs]);
  const signature=JSON.stringify([item.productId,attrs,note]);
  if(signatures.has(signature))return false;signatures.add(signature);
  notesByVariant.set(variant,[...(notesByVariant.get(variant)||[]),note]);
  if(!Number.isInteger(item.quantity) || item.quantity!<1 || item.quantity!>10)return false;
  const index=remaining.indexOf(item.productId);if(index<0)return false;remaining.splice(index,1);
 }
 for(const notes of notesByVariant.values()) if(notes.length>1 && notes.some(note=>!note)) return false;
 return remaining.length===0;
}
