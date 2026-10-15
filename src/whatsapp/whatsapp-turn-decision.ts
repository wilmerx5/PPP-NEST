import { dialogueProductReferences } from './whatsapp-dialogue-context';
import { createHash } from 'crypto';
import type {
  AiOrderAction,
  WhatsappSessionData,
} from './types/whatsapp-session.types';
import type { PurchasePlan } from './whatsapp-purchase-plan';

type Choice = { attributeName: string; attributeValue: string };
type Line = {
  productId: number;
  quantity?: number;
  note?: string;
  attributes?: Choice[];
};
export type DecisionLine = {
  productId: number;
  quantity: number;
  optionsFingerprint: string;
  hasNote: boolean;
  noteFingerprint: string;
};
export type DecisionSnapshot = {
  state: string;
  cart: DecisionLine[];
  pending: string[];
  productReferences: number[];
};
export type DecisionStage = {
  stage: 'proposed' | 'catalog_validated' | 'reconciled' | 'prepared';
  additions: DecisionLine[];
  operationKeys: string[];
  diagnostics: PurchasePlan['diagnostics'];
};
export type InquiryDecision = {
  kind: 'price' | 'composition';
  productIds: number[];
};
export type TurnDecision = {
  version: 1;
  before: DecisionSnapshot;
  stages: DecisionStage[];
  inquiries: InquiryDecision[];
  after: DecisionSnapshot;
  failed: boolean;
  observedUnitDelta: Array<{ productId: number; quantity: number }>;
  unitComparison?: {
    status: 'matches' | 'pending_choice' | 'different' | 'not_comparable';
    expected: Array<{ productId: number; quantity: number }>;
  };
};
export type TurnDecisionFrame = {
  before: DecisionSnapshot;
  stages: DecisionStage[];
  inquiries: InquiryDecision[];
};

const fingerprint = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const decisionLines = (lines: readonly Line[]): DecisionLine[] =>
  lines.map((line) => ({
    productId: Number.isFinite(line.productId) ? line.productId : 0,
    quantity: Number.isFinite(line.quantity) ? line.quantity! : 1,
    optionsFingerprint: fingerprint(
      JSON.stringify(
        (Array.isArray(line.attributes) ? line.attributes : [])
          .filter((choice) => choice && typeof choice === 'object')
          .map((choice) => [choice.attributeName, choice.attributeValue])
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ),
    ),
    hasNote: typeof line.note === 'string' && !!line.note.trim(),
    noteFingerprint: fingerprint(
      typeof line.note === 'string' ? line.note : '',
    ),
  }));

/** A bounded diagnostic contract, not a new classifier or authorization to mutate an order.
 * No message, address, name, phone, note or option text is retained in the trace.
 */
export function captureDecisionSnapshot(
  state: string,
  session: WhatsappSessionData,
): DecisionSnapshot {
  return {
    state,
    cart: decisionLines(session.cart),
    productReferences: dialogueProductReferences(session),
    pending: Object.keys(session)
      .filter((key) => key.startsWith('pending') && !!session[key])
      .sort(),
  };
}

export function beginTurnDecision(
  state: string,
  session: WhatsappSessionData,
): TurnDecisionFrame {
  return {
    before: captureDecisionSnapshot(state, session),
    stages: [],
    inquiries: [],
  };
}

/** Set only by a handler that actually selected this inquiry route. */
export function captureInquiryDecision(
  frame: TurnDecisionFrame | undefined,
  kind: InquiryDecision['kind'],
  productIds: number[],
): void {
  if (!frame) return;
  const inquiry = { kind, productIds: [...new Set(productIds)] };
  const existing = frame.inquiries.findIndex((item) => item.kind === kind);
  if (existing >= 0) frame.inquiries[existing] = inquiry;
  else frame.inquiries.push(inquiry);
}

export function captureActionDecision(
  frame: TurnDecisionFrame | undefined,
  stage: DecisionStage['stage'],
  actions?: AiOrderAction,
): void {
  if (!frame || frame.stages.length >= 32) return;
  frame.stages.push({
    stage,
    additions: decisionLines(actions?.addItems || []),
    operationKeys: Object.keys(actions || {})
      .filter((key) => actions?.[key] !== undefined)
      .sort(),
    diagnostics: [],
  });
}

export function capturePurchaseDecision(
  frame: TurnDecisionFrame | undefined,
  plan: PurchasePlan,
): void {
  if (!frame || frame.stages.length >= 32) return;
  frame.stages.push({
    stage: 'prepared',
    additions: decisionLines(
      plan.lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        note: line.note,
        attributes: line.attributes,
      })),
    ),
    operationKeys: ['addItems'],
    diagnostics: structuredClone(plan.diagnostics),
  });
}

export function finishTurnDecision(
  frame: TurnDecisionFrame,
  state: string,
  session: WhatsappSessionData,
  failed = false,
): TurnDecision {
  const after = captureDecisionSnapshot(state, session);
  const units = new Map<number, number>();
  for (const line of frame.before.cart)
    units.set(line.productId, (units.get(line.productId) || 0) - line.quantity);
  for (const line of after.cart)
    units.set(line.productId, (units.get(line.productId) || 0) + line.quantity);
  const observedUnitDelta = [...units]
    .filter(([, quantity]) => quantity !== 0)
    .sort(([a], [b]) => a - b)
    .map(([productId, quantity]) => ({ productId, quantity }));
  const plans = frame.stages.filter((stage) => stage.stage === 'prepared');
  let unitComparison: TurnDecision['unitComparison'];
  if (plans.length) {
    const expectedUnits = new Map<number, number>();
    for (const line of plans[0].additions)
      expectedUnits.set(
        line.productId,
        (expectedUnits.get(line.productId) || 0) + line.quantity,
      );
    const expected = [...expectedUnits]
      .sort(([a], [b]) => a - b)
      .map(([productId, quantity]) => ({ productId, quantity }));
    const mixed =
      plans.length !== 1 ||
      frame.stages.some((stage) =>
        stage.operationKeys.some((key) =>
          [
            'clearCart',
            'updateCartLines',
            'removeCartLines',
            'removeProductIds',
            'updateAttributes',
          ].includes(key),
        ),
      );
    const matches =
      JSON.stringify(expected) === JSON.stringify(observedUnitDelta);
    unitComparison = {
      expected,
      status: mixed
        ? 'not_comparable'
        : matches
          ? 'matches'
          : after.pending.some(
                (key) =>
                  key === 'pendingAttribute' || key === 'pendingMultiOrder',
              )
            ? 'pending_choice'
            : 'different',
    };
  }
  return {
    version: 1,
    before: structuredClone(frame.before),
    stages: structuredClone(frame.stages),
    inquiries: structuredClone(frame.inquiries),
    after,
    failed,
    observedUnitDelta,
    ...(unitComparison ? { unitComparison } : {}),
  };
}
