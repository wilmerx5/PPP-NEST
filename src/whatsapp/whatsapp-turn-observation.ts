import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import type { WhatsappSessionData } from './types/whatsapp-session.types';

type InferencePurpose =
  | 'agent'
  | 'classification'
  | 'assist'
  | 'audio'
  | 'vision';
type IgnoredReason = 'duplicate' | 'reaction' | 'disabled' | 'human_takeover';

type ObservedState = {
  state: string;
  cartFingerprint: string;
  hasPendingChoice: boolean;
};

export type WhatsappTurnSummary = {
  event: 'whatsapp_turn_summary';
  version: 1;
  turnId: string;
  at: string;
  messageType: string;
  conversationId?: number;
  acceptedMessages: number;
  processingSteps: number;
  agentInvocations: number;
  agentErrors: number;
  route: 'rules' | 'agent' | 'assist' | 'hybrid';
  inferenceAttempts: number;
  inferenceRequestFailures: number;
  inferenceByPurpose: Partial<Record<InferencePurpose, number>>;
  inferenceByModel: Record<string, number>;
  guardRejections: number;
  missingOptionChoices: number;
  ignoredReason?: IgnoredReason;
  stateBefore?: string;
  stateAfter?: string;
  hasPendingChoice?: boolean;
  cartChanged: boolean;
  ordersRegistered: number;
  failed: boolean;
  deliveryPipeline: 'completed' | 'failed' | 'not_observed';
  latencyMs: number;
};

type Observation = {
  active: boolean;
  summary: WhatsappTurnSummary;
  before?: ObservedState;
  after?: ObservedState;
};

const observations = new AsyncLocalStorage<Observation>();

function currentObservation(): Observation | undefined {
  const current = observations.getStore();
  return current?.active ? current : undefined;
}

/** One summary per queued turn, including its internal burst continuations. */
export async function observeWhatsappTurn<T>(
  messageType: string,
  run: () => Promise<T>,
  emit: (summary: WhatsappTurnSummary) => void,
  observesDelivery = false,
): Promise<T> {
  if (currentObservation() && !observesDelivery) return run();
  const started = Date.now();
  const observation: Observation = {
    active: true,
    summary: {
      event: 'whatsapp_turn_summary',
      version: 1,
      turnId: randomUUID(),
      at: new Date().toISOString(),
      messageType: [
        'text',
        'audio',
        'image',
        'location',
        'sticker',
        'other',
      ].includes(messageType)
        ? messageType
        : 'other',
      acceptedMessages: 0,
      processingSteps: 0,
      agentInvocations: 0,
      agentErrors: 0,
      route: 'rules',
      inferenceAttempts: 0,
      inferenceRequestFailures: 0,
      inferenceByPurpose: {},
      inferenceByModel: Object.create(null),
      guardRejections: 0,
      missingOptionChoices: 0,
      cartChanged: false,
      ordersRegistered: 0,
      failed: false,
      deliveryPipeline: 'not_observed',
      latencyMs: 0,
    },
  };
  return observations.run(observation, async () => {
    try {
      return await run();
    } catch (error) {
      observation.summary.failed = true;
      throw error;
    } finally {
      const { summary, before, after } = observation;
      summary.latencyMs = Date.now() - started;
      if (observesDelivery)
        summary.deliveryPipeline = summary.failed ? 'failed' : 'completed';
      const agentAttempts = summary.inferenceByPurpose.agent || 0;
      const otherAttempts = summary.inferenceAttempts - agentAttempts;
      summary.route =
        agentAttempts && otherAttempts
          ? 'hybrid'
          : agentAttempts
            ? 'agent'
            : otherAttempts
              ? 'assist'
              : 'rules';
      if (before && after) {
        summary.stateBefore = before.state;
        summary.stateAfter = after.state;
        summary.hasPendingChoice = after.hasPendingChoice;
        summary.cartChanged = before.cartFingerprint !== after.cartFingerprint;
      }
      observation.active = false;
      try {
        emit(structuredClone(summary));
      } catch {
        /* Logging cannot change an order or its error. */
      }
    }
  });
}

export function observeWhatsappState(
  conversationId: number,
  state: string,
  session: WhatsappSessionData,
): void {
  const current = currentObservation();
  if (!current) return;
  const snapshot: ObservedState = {
    state,
    cartFingerprint: createHash('sha256')
      .update(
        JSON.stringify(
          session.cart.map((line) => [
            line.productId,
            line.name,
            line.unitPrice,
            line.quantity,
            line.note || '',
            (line.attributes || [])
              .map((attribute) => [
                attribute.attributeName,
                attribute.attributeValue,
              ])
              .sort((left, right) =>
                JSON.stringify(left).localeCompare(JSON.stringify(right)),
              ),
          ]),
        ),
      )
      .digest('hex'),
    hasPendingChoice: Object.keys(session).some(
      (key) => key.startsWith('pending') && !!session[key],
    ),
  };
  if (Number.isFinite(conversationId))
    current.summary.conversationId = conversationId;
  current.before ||= snapshot;
  current.after = snapshot;
}

export function observeWhatsappProcessingStep(): void {
  const current = currentObservation();
  if (current) current.summary.processingSteps++;
}

export function observeWhatsappClaim(count: number): void {
  const current = currentObservation();
  if (current) current.summary.acceptedMessages += count;
}

export function observeWhatsappIgnored(reason: IgnoredReason): void {
  const current = currentObservation();
  if (current) current.summary.ignoredReason = reason;
}

export function observeWhatsappAgentInvocation(): void {
  const current = currentObservation();
  if (current) current.summary.agentInvocations++;
}

export function observeWhatsappAgentError(): void {
  const current = currentObservation();
  if (current) current.summary.agentErrors++;
}

export function observeWhatsappGuardRejection(
  missingOptionChoice = false,
): void {
  const current = currentObservation();
  if (!current) return;
  current.summary.guardRejections++;
  if (missingOptionChoice) current.summary.missingOptionChoices++;
}

export function observeWhatsappOrderRegistered(): void {
  const current = currentObservation();
  if (current) current.summary.ordersRegistered++;
}

/** Count provider attempts at their actual HTTP boundary, including retries. */
export async function observeWhatsappInference<T extends { ok: boolean }>(
  purpose: InferencePurpose,
  model: string,
  request: () => Promise<T>,
): Promise<T> {
  const current = currentObservation();
  if (!current) return request();
  const summary = current.summary;
  const modelName =
    typeof model === 'string' && /^[a-zA-Z0-9._:-]{1,100}$/.test(model)
      ? model
      : 'unknown';
  summary.inferenceAttempts++;
  summary.inferenceByPurpose[purpose] =
    (summary.inferenceByPurpose[purpose] || 0) + 1;
  summary.inferenceByModel[modelName] =
    (summary.inferenceByModel[modelName] || 0) + 1;
  try {
    const response = await request();
    if (!response.ok) summary.inferenceRequestFailures++;
    return response;
  } catch (error) {
    summary.inferenceRequestFailures++;
    throw error;
  }
}
