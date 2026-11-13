import type {
  WhatsappCartItem,
  AiOrderAction,
} from './types/whatsapp-session.types';
import type {
  WhatsappCatalogProduct,
  WhatsappCatalogService,
} from './whatsapp-catalog.service';
import { normalizeCorrection } from './whatsapp-quantity-correction';

type AttributeEdit = NonNullable<AiOrderAction['updateAttributes']>[number];
const normalize = (text: string) =>
  normalizeCorrection(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Bind a whole-line option edit to the customer's source, independently of a model index. */
export function hasExplicitCartAttributeOwner(
  text: string,
  cart: WhatsappCartItem[],
  edit: AttributeEdit,
  products: WhatsappCatalogProduct[],
  catalog: WhatsappCatalogService,
): boolean {
  const source =
    edit.cartLineIndex === undefined ? undefined : cart[edit.cartLineIndex];
  if (!source || source.productId !== edit.productId) return false;
  const message = normalize(text);
  if (
    cart.length > 1 &&
    /\b(?:no|excepto|deja|dejes|conserva|conserves)\b/.test(message)
  )
    return false;
  const named = new Set(
    cart
      .filter((line) =>
        catalog.productFullyNamedIn(text, [
          {
            id: line.productId,
            code: line.code,
            name: line.name,
            price: line.unitPrice,
          },
        ]),
      )
      .map((line) => line.productId),
  );
  if (named.size === 1 && !named.has(edit.productId)) return false;
  const candidates = cart.flatMap((line, index) => {
    const product = products.find((item) => item.id === line.productId);
    const acceptsValue = product?.attributes?.some(
      (attribute) =>
        !!catalog.matchAttributeOptionValue(
          edit.attributeValue,
          attribute.options,
        ),
    );
    return acceptsValue && (named.size !== 1 || named.has(line.productId))
      ? [index]
      : [];
  });
  if (!candidates.includes(edit.cartLineIndex!)) return false;
  const references = [
    ...message.matchAll(/\b(?:linea|fila|item|numero)\s+(\d+)\b/g),
  ];
  if (references.length)
    return (
      !/\b(?:no|excepto|deja|dejes|conserva|conserves)\b/.test(message) &&
      references.length === 1 &&
      Number(references[0][1]) === edit.cartLineIndex! + 1
    );
  if (candidates.length === 1) return true;
  if (/\b(?:ambos|ambas|todos|todas)\b/.test(message)) return true;
  const peers = candidates
    .filter((index) => index !== edit.cartLineIndex)
    .map((index) => cart[index]);
  const values = [
    ...(source.attributes || []).map((attribute) => attribute.attributeValue),
    source.note || '',
  ];
  return values.some((value) => {
    const current = normalize(value);
    if (
      !current ||
      current === normalize(edit.attributeValue) ||
      peers.some(
        (line) =>
          (line.attributes || []).some(
            (attribute) => normalize(attribute.attributeValue) === current,
          ) || normalize(line.note || '') === current,
      )
    )
      return false;
    const escaped = current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
      `\\b(?:de|entre|que tiene|que lleva|que va) (?:los |las |el |la )?(?:de )?${escaped}(?:s|es)?\\b`,
    ).test(message);
  });
}
