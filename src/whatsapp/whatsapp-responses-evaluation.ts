/** Responses protocol adapter. Does not perform HTTP or execute business tools.
 * Keeps Responses items intact between tool rounds, including encrypted reasoning.
 */
type Item = Record<string, unknown>;
type FunctionDefinition = { type: 'function'; function: {
  name: string; description?: string; parameters: Record<string, unknown>; strict?: boolean;
} };
export type EvaluationToolCall = { callId: string; name: string; arguments: Record<string, unknown> };
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class WhatsappResponsesEvaluation {
  private items: Item[];
  private pending: EvaluationToolCall[] = [];
  private readonly tools: Item[];

  constructor(private readonly model: string, messages: Array<{
    role: 'system' | 'developer' | 'user' | 'assistant'; content: string;
  }>, tools: FunctionDefinition[]) {
    if (!model.trim()) throw new Error('evaluation_model_required');
    this.items = copy(messages);
    this.tools = tools.map(tool => ({ type: 'function', ...copy(tool.function),
      // Existing PPP tools have optional fields. Do not implicitly require them.
      strict: tool.function.strict ?? false }));
  }

  request(options: { maxOutputTokens: number; reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
    toolChoice?: 'auto' | 'none' | { type: 'function'; name: string } }): Item {
    if (this.pending.length) throw new Error('evaluation_tool_results_required');
    if (!Number.isInteger(options.maxOutputTokens) || options.maxOutputTokens < 1) {
      throw new Error('evaluation_output_budget_required');
    }
    return copy({ model: this.model, store: false, input: this.items, tools: this.tools,
      max_output_tokens: options.maxOutputTokens, tool_choice: options.toolChoice ?? 'auto',
      ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort } } : {}) });
  }

  appendMessages(messages: Array<{ role: 'system' | 'developer' | 'user' | 'assistant'; content: string }>): void {
    if (this.pending.length) throw new Error('evaluation_tool_results_required');
    this.items.push(...copy(messages));
  }

  /** Atomic: an incomplete/refused/malformed proposal must expose no executable calls. */
  accept(response: { status?: string; output?: Item[] }): { text: string; calls: EvaluationToolCall[] } {
    if (this.pending.length) throw new Error('evaluation_tool_results_required');
    if (response.status !== 'completed' || !Array.isArray(response.output) || !response.output.length) {
      throw new Error('evaluation_response_incomplete');
    }
    const calls: EvaluationToolCall[] = [];
    const texts: string[] = [];
    const ids = new Set<string>();
    for (const item of response.output) {
      if (item.type === 'reasoning') continue;
      if (item.type === 'function_call') {
        if (typeof item.call_id !== 'string' || !item.call_id || ids.has(item.call_id) ||
          typeof item.name !== 'string' || !this.tools.some(t => t.name === item.name) ||
          typeof item.arguments !== 'string' || (item.status !== undefined && item.status !== 'completed')) {
          throw new Error('evaluation_invalid_tool_call');
        }
        let args: unknown;
        try { args = JSON.parse(item.arguments); } catch { throw new Error('evaluation_invalid_tool_arguments'); }
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('evaluation_invalid_tool_arguments');
        ids.add(item.call_id);
        calls.push({callId:item.call_id,name:item.name,arguments:args as Record<string,unknown>});
      } else if (item.type === 'message') {
        if (item.role !== 'assistant' || !Array.isArray(item.content) ||
          (item.status !== undefined && item.status !== 'completed')) throw new Error('evaluation_invalid_message');
        for (const part of item.content as Item[]) {
          if (part.type === 'refusal') throw new Error('evaluation_response_refused');
          if (part.type !== 'output_text' || typeof part.text !== 'string') throw new Error('evaluation_invalid_message');
          texts.push(part.text);
        }
      } else { throw new Error('evaluation_unsupported_output'); }
    }
    if (!calls.length && !texts.some(t => t.trim())) throw new Error('evaluation_empty_response');
    this.items.push(...copy(response.output));
    this.pending = copy(calls);
    return {text:texts.join('\n'),calls};
  }

  /** Results come from the isolated evaluator, never from this adapter executing tools. */
  toolResults(results: Array<{ callId: string; output: string }>): void {
    const expected = new Set(this.pending.map(call => call.callId));
    if (!expected.size || results.length !== expected.size ||
      new Set(results.map(result => result.callId)).size !== expected.size ||
      results.some(result => !expected.has(result.callId) || typeof result.output !== 'string')) {
      throw new Error('evaluation_tool_results_mismatch');
    }
    this.items.push(...results.map(result => ({type:'function_call_output',call_id:result.callId,output:result.output})));
    this.pending = [];
  }
}
